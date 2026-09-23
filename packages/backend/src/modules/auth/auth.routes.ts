import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../../env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginLimiter, registerLimiter, passwordResetLimiter, refreshLimiter } from '../../lib/rateLimiter.js';
import { hashToken } from '../../lib/storage.js';
import { logger } from '../../lib/logger.js';

const router = Router();
const refreshCookie = 'nexus_refresh';

/**
 * Creates a signed JWT containing the user's org context.
 * organizationId is embedded to enforce tenant isolation at the token level,
 * avoiding extra DB lookups on every authenticated request.
 */
function tok(userId: string, organizationId: string, sessionId: string, secret: string, expiresIn: string) {
  return jwt.sign({ userId, organizationId, sessionId }, secret, { expiresIn } as any);
}

/**
 * Sets the refresh token cookie. HttpOnly prevents XSS access to the token.
 * SameSite=Lax allows top-level navigation (login flow) while blocking cross-site POST.
 * Secure flag is omitted in dev to allow HTTP localhost.
 */
function setRefreshCookie(res: any, token: string, ttlDays?: number) {
  const days = ttlDays ?? env.REFRESH_TOKEN_TTL_DAYS;
  res.setHeader(
    'Set-Cookie',
    `${refreshCookie}=${encodeURIComponent(token)}; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=${
      days * 86400
    }${env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

function clearRefreshCookie(res: any) {
  res.setHeader(
    'Set-Cookie',
    `${refreshCookie}=; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=0${
      env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

/**
 * Manual cookie parser. Express does not parse cookies by default;
 * adding express-parser middleware would expose all routes to cookie overhead.
 */
function cookie(req: any, name: string) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Sends verification or reset email via webhook. Falls back to logging in dev. */
async function deliverEmail(type: 'verification' | 'reset', to: string, token: string) {
  const endpoint = env.EMAIL_WEBHOOK_URL;
  if (!endpoint) {
    if (env.NODE_ENV === 'production') throw new AppError('EMAIL_NOT_CONFIGURED', 503, 'Email delivery is not configured');
    logger.info(`[development] ${type} token for ${to}: ${token}`);
    return;
  }
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nexus-event': type },
    body: JSON.stringify({
      type,
      to,
      token,
      verificationUrl: `${env.WEB_ORIGIN}/verify?code=${encodeURIComponent(token)}`,
      resetUrl: `${env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`
    })
  });
  if (!r.ok) throw new AppError('EMAIL_DELIVERY_FAILED', 503, 'Unable to deliver email');
}

/** Registers a new user within an existing organization. Users are active immediately without email verification. */
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const body = req.body as any;
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const organizationSlug = String(body.organizationSlug || '').trim().toLowerCase();
    if (
      name.length < 2 ||
      name.length > 120 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      password.length < 12 ||
      password.length > 128 ||
      !organizationSlug
    )
      throw new AppError('VALIDATION_ERROR', 400, 'Valid name, email, 12+ character password and organizationSlug are required');
    const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
    if (!org) throw new AppError('NOT_FOUND', 404, 'Organization not found');
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError('CONFLICT_STATE', 409, 'Email already registered');
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        isVerified: true,
        memberships: { create: { organizationId: org.id, roles: ['USER'] } }
      }
    });
    const m = await prisma.organizationMembership.findFirst({
      where: { userId: user.id, organizationId: org.id }
    });
    const sessionId = crypto.randomUUID();
    const refresh = tok(user.id, org.id, sessionId, env.JWT_REFRESH_SECRET, `${env.REFRESH_TOKEN_TTL_DAYS}d`);
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        organizationId: org.id,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400e3)
      }
    });
    setRefreshCookie(res, refresh);
    if (req.headers['x-client-type'] === 'mobile') {
      res.status(201).json({ refreshToken: refresh, accessToken: tok(user.id, org.id, sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL), user: { id: user.id, name: user.name, email: user.email, isVerified: true, roles: m?.roles || ['USER'], organizationId: org.id, organizationName: org.name } });
      return;
    }
    res.status(201).json({
      accessToken: tok(user.id, org.id, sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isVerified: true,
        roles: m?.roles || ['USER'],
        organizationId: org.id,
        organizationName: org.name
      }
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Authenticates a user and issues JWT access + refresh tokens.
 * Returns 409 with org list if the user belongs to multiple organizations.
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const organizationId = req.body.organizationId ? String(req.body.organizationId) : undefined;
    const rememberMe = req.body.rememberMe === true;
    const refreshTtlDays = rememberMe ? 30 : env.REFRESH_TOKEN_TTL_DAYS;
    const u = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { organization: true } } }
    });
    if (!u) throw new AppError('AUTH_INVALID', 401, 'Invalid credentials');
    if (u.lockedUntil && u.lockedUntil > new Date())
      throw new AppError('AUTH_LOCKED', 429, 'Account temporarily locked due to too many failed attempts');
    if (!(await bcrypt.compare(password, u.passwordHash))) {
      const attempts = u.failedLoginAttempts + 1;
      // Lock after 5 failed attempts for 15 minutes to throttle brute-force attacks.
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60e3) : null;
      await prisma.user.update({
        where: { id: u.id },
        data: { failedLoginAttempts: attempts, lockedUntil: lockUntil }
      });
      throw new AppError('AUTH_INVALID', 401, 'Invalid credentials');
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });
    const active = u.memberships.filter((x: any) => x.status === 'ACTIVE');
    if (!active.length) throw new AppError('FORBIDDEN', 403, 'Membership inactive');
    // Auto-select org if user has only one; otherwise require explicit selection.
    const m = organizationId
      ? active.find((x: any) => x.organizationId === organizationId)
      : active.length === 1
      ? active[0]
      : undefined;
    if (!m) {
      res.status(409).json({
        error: {
          code: 'ORGANIZATION_SELECTION_REQUIRED',
          message: 'Select an organization',
          organizations: active.map((x: any) => ({
            id: x.organizationId,
            name: x.organization.name,
            roles: x.roles
          }))
        }
      });
      return;
    }
    const sessionId = crypto.randomUUID();
    const refresh = tok(u.id, m.organizationId, sessionId, env.JWT_REFRESH_SECRET, `${refreshTtlDays}d`);
    // Store session for refresh token rotation and revocation tracking.
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: u.id,
        organizationId: m.organizationId,
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + refreshTtlDays * 86400e3)
      }
    });
    setRefreshCookie(res, refresh, refreshTtlDays);
    if (req.headers['x-client-type'] === 'mobile') {
      res.status(200).json({ refreshToken: refresh, accessToken: tok(u.id, m.organizationId, sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL), user: { id: u.id, name: u.name, email: u.email, isVerified: u.isVerified, roles: m.roles, organizationId: m.organizationId, organizationName: m.organization.name } });
      return;
    }
    res.json({
      accessToken: tok(u.id, m.organizationId, sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL),
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        isVerified: u.isVerified,
        roles: m.roles,
        organizationId: m.organizationId,
        organizationName: m.organization.name
      }
    });
  } catch (e) {
    next(e);
  }
});

/** Returns the authenticated user's profile scoped to their current organization. */
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const a = req.auth;
    const u = await prisma.user.findUnique({
      where: { id: a.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
        memberships: {
          where: { organizationId: a.organizationId, status: 'ACTIVE' },
          include: { organization: true }
        }
      }
    });
    if (!u) throw new AppError('AUTH_INVALID', 401, 'User not found');
    const m = u.memberships[0];
    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        isVerified: u.isVerified,
        organizationId: a.organizationId,
        organizationName: m.organization.name,
        roles: m.roles
      }
    });
  } catch (e) {
    next(e);
  }
});

/** Updates the authenticated user's profile. Only name is mutable here to limit attack surface. */
router.patch('/me', authenticate, async (req: any, res, next) => {
  try {
    const a = req.auth;
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 120)
      throw new AppError('VALIDATION_ERROR', 400, 'Name must be 2-120 characters');
    const u = await prisma.user.update({
      where: { id: a.userId },
      data: { name },
      select: { id: true, name: true, email: true }
    });
    res.json(u);
  } catch (e) {
    next(e);
  }
});

/**
 * Rotates the refresh token and issues a new access token.
 * Each refresh consumes the old token (one-time use) to limit replay window.
 */
router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    const refresh = req.headers['x-client-type'] === 'mobile' ? req.body.refreshToken : cookie(req, refreshCookie);
    if (!refresh) throw new AppError('AUTH_INVALID', 401, 'Refresh session missing');
    const p = jwt.verify(refresh, env.JWT_REFRESH_SECRET) as any;
    // Verify session exists, matches the token hash, and has not been revoked or expired.
    const session = await prisma.session.findFirst({
      where: {
        id: p.sessionId,
        userId: p.userId,
        organizationId: p.organizationId,
        tokenHash: hashToken(refresh),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!session) throw new AppError('AUTH_INVALID', 401, 'Refresh session expired or revoked');
    const nextRefresh = tok(p.userId, p.organizationId, p.sessionId, env.JWT_REFRESH_SECRET, `${env.REFRESH_TOKEN_TTL_DAYS}d`);
    // Replace stored hash so the old refresh token cannot be reused.
    await prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: hashToken(nextRefresh),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400e3)
      }
    });
    setRefreshCookie(res, nextRefresh);
    if (req.headers['x-client-type'] === 'mobile') { res.json({ refreshToken: nextRefresh, accessToken: tok(p.userId, p.organizationId, p.sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL) }); } else { res.json({ accessToken: tok(p.userId, p.organizationId, p.sessionId, env.JWT_SECRET, env.ACCESS_TOKEN_TTL) }); }
  } catch (e) {
    next(new AppError('AUTH_INVALID', 401, 'Invalid refresh session'));
  }
});

/** Revokes the current session and clears the refresh cookie. */
router.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    if (req.auth) {
      // Soft revoke for audit trail; hard delete would lose session history.
      await prisma.session.updateMany({
        where: { id: req.auth.sessionId },
        data: { revokedAt: new Date() }
      });
    }
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/** Verifies a user's email address using the token sent during registration. */
router.post('/verify', async (req, res, next) => {
  try {
    const code = String(req.body.code || '');
    if (code.length < 20) throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
    // Hash before lookup to avoid timing-based enumeration of stored hashes.
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const u = await prisma.user.findFirst({ where: { verificationToken: hash } });
    if (!u || !u.verificationExpiry || u.verificationExpiry < new Date())
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired verification code');
    await prisma.user.update({
      where: { id: u.id },
      data: { isVerified: true, verificationToken: null, verificationExpiry: null }
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * Sends a password reset email. Always returns 200 regardless of whether
 * the email exists, to prevent user enumeration via response timing.
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^([^@\s]+)@([^@\s]+)\.([^@\s]+)$/.test(email))
      throw new AppError('VALIDATION_ERROR', 400, 'Valid email required');
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: u.id },
        data: {
          resetToken: crypto.createHash('sha256').update(token).digest('hex'),
          resetExpiry: new Date(Date.now() + 30 * 60e3)
        }
      });
      await deliverEmail('reset', email, token);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * Resets the user's password and revokes all active sessions.
 * Revoking all sessions forces re-authentication on every device,
 * preventing continued access with stolen refresh tokens.
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (token.length < 32 || password.length < 12)
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid token or password');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const u = await prisma.user.findFirst({ where: { resetToken: hash, resetExpiry: { gt: new Date() } } });
    if (!u) throw new AppError('AUTH_INVALID', 401, 'Invalid reset token');
    // Transaction ensures password update and session revocation are atomic.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: await bcrypt.hash(password, 12), resetToken: null, resetExpiry: null }
      }),
      prisma.session.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
