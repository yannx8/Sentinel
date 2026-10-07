import type { MembershipRole } from '@sentinel/shared';
import type { User } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, forbidden } from '../http/errors';
import { resolveSession, type AuthState } from './sessions';

export type Tenant = {
  userId: string;
  membershipId: string;
  role: MembershipRole;
  isOwner: boolean;
  /** Display name used in audit payloads and notifications. */
  name: string;
  orgId: string;
  org: {
    displayName: string;
    timezone: string;
    defaultLocale: string;
    requireResolutionPhoto: boolean;
    showReporterPhone: boolean;
  };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augmentation requires a namespace
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthState;
      tenant?: Tenant;
      isPlatformAdmin?: boolean;
    }
  }
}

/** Attaches the session if present. Never rejects. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const auth = await resolveSession(req);
  if (auth) req.auth = auth;
  next();
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Sign in to continue');
  if (req.auth.user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'This account is suspended');
  next();
}

export function authOf(req: Request): AuthState {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Sign in to continue');
  return req.auth;
}

/**
 * Builds the tenant context for one organization (I13): the user, membership and
 * organization must all be active. A caller without a membership gets 404, as if
 * the organization did not exist. Platform admins are never tenants (I12).
 */
export async function resolveTenant(user: User, orgId: string | null): Promise<Tenant> {
  if (user.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'This account is suspended');
  if (await prisma.platformAdmin.count({ where: { userId: user.id } })) {
    throw forbidden('Platform accounts cannot use organization routes');
  }

  const membership = orgId
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)
      ? await prisma.membership.findUnique({
          where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
          include: { organization: true },
        })
      : null
    : await soleMembership(user.id);

  if (!membership) throw new AppError('NOT_FOUND', 'Organization not found');
  if (membership.status !== 'ACTIVE') {
    throw new AppError('MEMBERSHIP_INACTIVE', 'Your access to this organization has ended');
  }
  const org = membership.organization;
  if (org.status !== 'ACTIVE') throw new AppError('ORG_SUSPENDED', `${org.displayName} is suspended`);

  return {
    userId: user.id,
    membershipId: membership.id,
    role: membership.role,
    isOwner: membership.isOwner,
    name: `${user.firstName} ${user.lastName}`,
    orgId: org.id,
    org: {
      displayName: org.displayName,
      timezone: org.timezone,
      defaultLocale: org.defaultLocale,
      requireResolutionPhoto: org.requireResolutionPhoto,
      showReporterPhone: org.showReporterPhone,
    },
  };
}

/** Tenant guard for every organization route. The organization comes from the X-Org-Id header. */
export async function requireTenant(req: Request, _res: Response, next: NextFunction) {
  const { user } = authOf(req);
  req.tenant = await resolveTenant(user, req.get('x-org-id') ?? null);
  next();
}

async function soleMembership(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
    take: 2,
  });
  if (memberships.length !== 1) {
    throw new AppError('VALIDATION_FAILED', 'Choose an organization with the X-Org-Id header');
  }
  return memberships[0] ?? null;
}

export function tenantOf(req: Request): Tenant {
  if (!req.tenant) throw new AppError('UNAUTHENTICATED', 'Sign in to continue');
  return req.tenant;
}

export function requireRole(...roles: MembershipRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tenant = tenantOf(req);
    if (!roles.includes(tenant.role)) throw forbidden();
    next();
  };
}

export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  const tenant = tenantOf(req);
  if (tenant.role !== 'SUPERVISOR' || !tenant.isOwner) throw forbidden('Only the account owner can do this');
  next();
}

/** Platform guard: a platform admin with a TOTP-verified session. Mutually exclusive with tenant routes (I12). */
export async function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction) {
  const { user, session } = authOf(req);
  const admin = await prisma.platformAdmin.findUnique({ where: { userId: user.id } });
  if (!admin || user.status !== 'ACTIVE') throw forbidden();
  if (!session.mfaVerifiedAt) throw new AppError('MFA_REQUIRED', 'Enter your authenticator code to continue');
  req.isPlatformAdmin = true;
  next();
}
