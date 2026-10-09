/**
 * Invitation links (docs/PRD.md 3.2). Public routes: the token in the URL is
 * the only credential, so every answer about a bad token is the same and the
 * routes sit behind the public rate limit.
 */
import type { User } from '../../generated/prisma/client';
import {
  acceptInvitationSchema,
  employeeProfileSchema,
  intervenantProfileSchema,
  type InvitationPreview,
  type MembershipRole,
} from '@sentinel/shared';
import { Router } from 'express';
import type { z } from 'zod';
import { createSession, type AuthState } from '../../auth/sessions';
import { hashPassword, hashToken } from '../../lib/crypto';
import { notify } from '../../lib/notify';
import { prisma, type Tx } from '../../lib/prisma';
import { setSessionCookie } from '../../http/cookies';
import { AppError, conflict, forbidden } from '../../http/errors';
import { publicLimiter } from '../../http/rate-limit';
import { parse } from '../../http/validate';
import { buildMe } from '../me';
import { currentStatuses, isUniqueViolation } from './service';

export type AcceptInvitationInput = z.output<typeof acceptInvitationSchema>;

const tokenInvalid = () =>
  new AppError('TOKEN_INVALID', 'This invitation is no longer valid. Ask your organization for a new one.');
const alreadyMember = () => conflict('You are already a member of this organization.');
const employeeElsewhere = () =>
  conflict(
    'You are already an employee of another organization on Sentinel. Ask that organization to end your access first.',
  );

/** The invitation behind a link, if it can still be accepted. The token comes straight from the URL. */
async function findOpenInvitation(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw tokenInvalid();
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { organization: { select: { displayName: true, status: true, defaultLocale: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.organization.status !== 'ACTIVE') {
    throw tokenInvalid();
  }
  if (invitation.expiresAt <= new Date()) {
    throw new AppError('TOKEN_EXPIRED', 'This invitation has expired. Ask your organization to send it again.');
  }
  return invitation;
}

export async function previewInvitation(token: unknown): Promise<InvitationPreview> {
  const invitation = await findOpenInvitation(token);
  const account = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
  return {
    organization: invitation.organization.displayName,
    role: invitation.role,
    email: invitation.email,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    existingAccount: account !== null,
  };
}

/** Maps a unique violation on Membership to what the person can act on. */
function membershipConflict(error: unknown, role: MembershipRole): unknown {
  if (!isUniqueViolation(error)) return error;
  // (organizationId, userId) is one membership per organization. Otherwise it is the I2 partial index.
  if (String(error.meta?.target ?? '').includes('organizationId')) return alreadyMember();
  return role === 'REPORTER' ? employeeElsewhere() : error;
}

/**
 * Profiles from what the supervisor entered at invite time. Sites and
 * specialties removed since then are dropped, and so is an employee code
 * another employee took in the meantime: neither should block joining.
 */
async function createProfiles(tx: Tx, orgId: string, membershipId: string, role: MembershipRole, stored: unknown) {
  const owned = { organizationId: orgId, membershipId };
  if (role === 'REPORTER') {
    const parsed = employeeProfileSchema.safeParse(stored);
    const profile = parsed.success ? parsed.data : employeeProfileSchema.parse({});
    const siteExists =
      profile.homeSiteId !== null &&
      (await tx.site.count({ where: { id: profile.homeSiteId, organizationId: orgId } })) > 0;
    const codeFree =
      profile.employeeCode !== undefined &&
      (await tx.employeeProfile.count({ where: { organizationId: orgId, employeeCode: profile.employeeCode } })) === 0;
    await tx.employeeProfile.create({
      data: {
        ...owned,
        employeeCode: codeFree ? (profile.employeeCode ?? null) : null,
        jobTitle: profile.jobTitle ?? null,
        department: profile.department ?? null,
        homeSiteId: siteExists ? profile.homeSiteId : null,
      },
    });
    return;
  }
  if (role === 'INTERVENANT') {
    const parsed = intervenantProfileSchema.safeParse(stored);
    const profile = parsed.success ? parsed.data : intervenantProfileSchema.parse({});
    const [specialties, sites] = await Promise.all([
      tx.specialty.findMany({
        where: { organizationId: orgId, id: { in: profile.specialtyIds } },
        select: { id: true },
      }),
      tx.site.findMany({ where: { organizationId: orgId, id: { in: profile.siteIds } }, select: { id: true } }),
    ]);
    await tx.intervenantProfile.create({ data: { ...owned, companyName: profile.companyName ?? null } });
    await tx.intervenantSpecialty.createMany({ data: specialties.map((s) => ({ ...owned, specialtyId: s.id })) });
    await tx.siteAccess.createMany({ data: sites.map((s) => ({ ...owned, siteId: s.id })) });
  }
}

/**
 * Joins the organization (3.2). An existing account must be signed in as the
 * invited email. A new account is created with the password chosen here.
 * Returns the user and whether the account was just created.
 */
export async function acceptInvitation(
  token: unknown,
  input: AcceptInvitationInput,
  auth: AuthState | undefined,
): Promise<{ user: User; newAccount: boolean }> {
  const invitation = await findOpenInvitation(token);
  const existing = await prisma.user.findUnique({
    where: { email: invitation.email },
    include: { platformAdmin: { select: { userId: true } } },
  });

  let passwordHash: string | null = null;
  if (existing) {
    if (!auth || auth.user.id !== existing.id) {
      throw new AppError('UNAUTHENTICATED', `Sign in as ${invitation.email} to accept this invitation.`);
    }
    if (existing.status !== 'ACTIVE') throw new AppError('UNAUTHENTICATED', 'This account is suspended');
    if (existing.platformAdmin) throw forbidden('Platform accounts cannot join an organization.');
  } else {
    if (!input.password) {
      const message = 'Choose a password of at least 10 characters to create your account.';
      throw new AppError('VALIDATION_FAILED', message, { fields: { password: [message] } });
    }
    passwordHash = await hashPassword(input.password);
  }

  const orgId = invitation.organizationId;
  const role = invitation.role;
  const user = await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Claimed first: a concurrent accept, a resend (new hash) or a revoke turns this into a no-op.
    const claimed = await tx.invitation.updateMany({
      where: {
        id: invitation.id,
        organizationId: orgId,
        tokenHash: invitation.tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
    if (claimed.count === 0) throw tokenInvalid();

    const user =
      existing ??
      (await tx.user
        .create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            phone: input.phone ?? null,
            locale: invitation.organization.defaultLocale,
            emailVerifiedAt: now,
          },
        })
        .catch((error: unknown) => {
          throw isUniqueViolation(error)
            ? conflict('An account already uses this email. Sign in to accept this invitation.')
            : error;
        }));

    const previous = await tx.membership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    });
    if (previous && previous.status !== 'REVOKED') throw alreadyMember();
    if (role === 'REPORTER') {
      const elsewhere = await tx.membership.count({
        where: { userId: user.id, role: 'REPORTER', status: { in: currentStatuses }, organizationId: { not: orgId } },
      });
      if (elsewhere > 0) throw employeeElsewhere();
    }

    const fresh = {
      role,
      status: 'ACTIVE' as const,
      isOwner: false,
      joinedAt: now,
      invitedByMembershipId: invitation.invitedByMembershipId,
    };
    const membership = await (
      previous
        ? tx.membership.update({
            where: { id: previous.id, organizationId: orgId },
            data: { ...fresh, statusChangedAt: now },
          })
        : tx.membership.create({ data: { ...fresh, organizationId: orgId, userId: user.id } })
    ).catch((error: unknown) => {
      throw membershipConflict(error, role);
    });

    if (previous) {
      // A revoked member coming back starts from the new invitation, not from their old profile.
      const owned = { organizationId: orgId, membershipId: membership.id };
      await tx.employeeProfile.deleteMany({ where: owned });
      await tx.intervenantProfile.deleteMany({ where: owned });
      await tx.intervenantSpecialty.deleteMany({ where: owned });
      await tx.siteAccess.deleteMany({ where: owned });
    }
    await createProfiles(tx, orgId, membership.id, role, invitation.profile);

    const name = `${user.firstName} ${user.lastName}`;
    // No tenant context on a public route: the new member is the actor.
    await tx.auditEvent.create({
      data: {
        organizationId: orgId,
        actorMembershipId: membership.id,
        actorUserId: user.id,
        type: 'MEMBER_JOINED',
        payload: { memberId: membership.id, name, role },
      },
    });
    await notify(tx, {
      orgId,
      type: 'INVITATION_ACCEPTED',
      incidentId: null,
      actorMembershipId: membership.id,
      actorName: name,
      recipients: [invitation.invitedByMembershipId],
      dedupe: invitation.id,
    });
    return user;
  });

  return { user, newAccount: !existing };
}

/** Mounted at /v1/public/invitations. The session, when present, comes from `authenticate`. */
export const publicInvitationRoutes = Router();

publicInvitationRoutes.get('/:token', publicLimiter, async (req, res) => {
  res.json({ data: await previewInvitation(req.params.token) });
});

publicInvitationRoutes.post('/:token/accept', publicLimiter, async (req, res) => {
  const input = parse(acceptInvitationSchema, req.body ?? {});
  const { user, newAccount } = await acceptInvitation(req.params.token, input, req.auth);
  let session = req.auth?.session;
  if (newAccount || !session) {
    const created = await createSession(user.id, req);
    setSessionCookie(res, created.token, created.session.expiresAt);
    session = created.session;
  }
  res.status(201).json({ data: await buildMe(user, session) });
});
