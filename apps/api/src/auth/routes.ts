import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  totpSchema,
} from '@sentinel/shared';
import { Router } from 'express';
import { env } from '../env';
import { hashPassword, hashToken, newToken, verifyPassword, verifyTotp } from '../lib/crypto';
import { mail } from '../lib/mailer';
import { prisma } from '../lib/prisma';
import { clearSessionCookie, setSessionCookie } from '../http/cookies';
import { AppError } from '../http/errors';
import { authLimiter } from '../http/rate-limit';
import { parse } from '../http/validate';
import { buildMe } from '../modules/me';
import { authOf, requireUser } from './context';
import { createSession, revokeUserSessions } from './sessions';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 3600 * 1000;

// Compared against when the email is unknown, so timing does not reveal which accounts exist.
const dummyHash = hashPassword('sentinel-timing-equalizer');

export const authRoutes = Router();

authRoutes.post('/login', authLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash) {
    await verifyPassword(password, await dummyHash);
    throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError('ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes or reset your password.');
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data:
        failed >= MAX_FAILED_ATTEMPTS
          ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) }
          : { failedLoginCount: failed },
    });
    throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'This account is suspended');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const { token, session } = await createSession(user.id, req);
  setSessionCookie(res, token, session.expiresAt);
  res.json({ data: await buildMe(updated, session) });
});

authRoutes.post('/logout', async (req, res) => {
  if (req.auth) await prisma.session.delete({ where: { id: req.auth.session.id } }).catch(() => undefined);
  clearSessionCookie(res);
  res.status(204).end();
});

/** Second factor for platform admins. Marks the current session as verified. */
authRoutes.post('/totp', authLimiter, requireUser, async (req, res) => {
  const { user, session } = authOf(req);
  const { code } = parse(totpSchema, req.body);
  const admin = await prisma.platformAdmin.findUnique({ where: { userId: user.id } });
  if (!admin) throw new AppError('FORBIDDEN', 'Two-factor sign-in is not set up for this account');
  if (!verifyTotp(admin.totpSecret, code)) {
    throw new AppError('VALIDATION_FAILED', 'That code is not valid. Check the time on your device and try again.', {
      fields: { code: ['Invalid code'] },
    });
  }
  const verified = await prisma.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
  res.json({ data: await buildMe(user, verified) });
});

/** Always answers 202 so the response never reveals whether an account exists. */
authRoutes.post('/password/forgot', authLimiter, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.passwordHash && user.status === 'ACTIVE') {
    const token = newToken();
    await prisma.userToken.create({
      data: { userId: user.id, kind: 'PASSWORD_RESET', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    });
    await mail.passwordReset(user.email, user.locale, user.firstName, `${env.WEB_ORIGIN}/reset-password?token=${token}`);
  }
  res.status(202).json({ data: { ok: true } });
});

authRoutes.post('/password/reset', authLimiter, async (req, res) => {
  const { token, password } = parse(resetPasswordSchema, req.body);
  const record = await prisma.userToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.kind !== 'PASSWORD_RESET' || record.usedAt) {
    throw new AppError('TOKEN_INVALID', 'This link is no longer valid. Ask for a new one.');
  }
  if (record.expiresAt < new Date()) throw new AppError('TOKEN_EXPIRED', 'This link has expired. Ask for a new one.');

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, emailVerifiedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  res.json({ data: { ok: true } });
});

authRoutes.post('/password/change', authLimiter, requireUser, async (req, res) => {
  const { user, session } = authOf(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError('VALIDATION_FAILED', 'Your current password is incorrect', {
      fields: { currentPassword: ['Incorrect password'] },
    });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeUserSessions(user.id, session.id);
  res.json({ data: { ok: true } });
});
