/**
 * People (docs/PRD.md 3.2, 6.3 Members, F-PPL): the member directory, profile
 * edits, access changes, ownership transfer and invitations. Every function
 * runs for a supervisor of `tenant` and reads or writes that organization only.
 */
import { Prisma } from '../../generated/prisma/client';
import { employeeProfileSchema } from '@sentinel/shared';
import type {
  AuditEventType,
  intervenantProfileSchema,
  InvitationDTO,
  InvitationStatus,
  InviteMemberInput,
  InviteResult,
  listMembersQuery,
  MemberDTO,
  MembershipRole,
  MembershipStatus,
  updateMemberSchema,
} from '@sentinel/shared';
import type { z } from 'zod';
import { env } from '../../env';
import type { Tenant } from '../../auth/context';
import { recordOrgEvent } from '../../lib/audit';
import { hashToken, newToken } from '../../lib/crypto';
import { mail } from '../../lib/mailer';
import { prisma, type Tx } from '../../lib/prisma';
import { AppError, conflict, forbidden, invalidTransition, notFound } from '../../http/errors';
import { liveAssignmentCounts, releaseLiveAssignments } from '../incidents/scope';

type Db = Tx | typeof prisma;
type EmployeeProfileInput = z.output<typeof employeeProfileSchema>;
type IntervenantProfileInput = z.output<typeof intervenantProfileSchema>;
export type ListMembersQuery = z.output<typeof listMembersQuery>;
export type UpdateMemberInput = z.output<typeof updateMemberSchema>;

export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;
const MEMBER_LIST_CAP = 2000;
const INVITATION_LIST_CAP = 200;

/** Memberships that hold access now or can get it back with a reactivation. */
export const currentStatuses: MembershipStatus[] = ['ACTIVE', 'SUSPENDED'];

export const messages = {
  employeeElsewhere: 'This person is already an employee of another organization on Sentinel.',
  invitationPending: 'An invitation is already pending. Resend it instead.',
  alreadyMember: (name: string) => `${name} is already a member.`,
  employeeCodeTaken: (code: string) => `Employee code ${code} is already used. Choose another code.`,
};

/* Mappers */

const memberInclude = {
  user: { select: { firstName: true, lastName: true, email: true, phone: true } },
  employeeProfile: { include: { homeSite: { select: { id: true, name: true } } } },
  intervenantProfile: { select: { companyName: true, availability: true } },
  specialties: {
    select: { specialty: { select: { id: true, name: true } } },
    orderBy: { specialty: { name: 'asc' } },
  },
  siteAccesses: {
    select: { site: { select: { id: true, name: true } } },
    orderBy: { site: { name: 'asc' } },
  },
} satisfies Prisma.MembershipInclude;

type MemberRow = Prisma.MembershipGetPayload<{ include: typeof memberInclude }>;

const nameOf = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;

function toMemberDTO(row: MemberRow, liveAssignments: number): MemberDTO {
  const employee = row.employeeProfile;
  return {
    id: row.id,
    role: row.role,
    isOwner: row.isOwner,
    status: row.status,
    firstName: row.user.firstName,
    lastName: row.user.lastName,
    email: row.user.email,
    phone: row.user.phone,
    joinedAt: row.joinedAt.toISOString(),
    employee:
      row.role === 'REPORTER'
        ? {
            employeeCode: employee?.employeeCode ?? null,
            jobTitle: employee?.jobTitle ?? null,
            department: employee?.department ?? null,
            homeSite: employee?.homeSite ? { id: employee.homeSite.id, name: employee.homeSite.name } : null,
          }
        : null,
    intervenant:
      row.role === 'INTERVENANT'
        ? {
            companyName: row.intervenantProfile?.companyName ?? null,
            availability: row.intervenantProfile?.availability ?? 'AVAILABLE',
            specialties: row.specialties.map(({ specialty }) => ({ id: specialty.id, name: specialty.name })),
            sites: row.siteAccesses.map(({ site }) => ({ id: site.id, name: site.name })),
            liveAssignments,
          }
        : null,
  };
}

async function toMemberDTOs(tenant: Tenant, rows: MemberRow[]): Promise<MemberDTO[]> {
  const intervenantIds = rows.filter((row) => row.role === 'INTERVENANT').map((row) => row.id);
  const counts =
    intervenantIds.length > 0 ? await liveAssignmentCounts(tenant.orgId, intervenantIds) : new Map<string, number>();
  return rows.map((row) => toMemberDTO(row, counts.get(row.id) ?? 0));
}

const invitationInclude = {
  invitedBy: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.InvitationInclude;

type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

/** An invitation is pending until accepted, revoked or past its expiry. */
export function pendingInvitationWhere(now = new Date()) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } satisfies Prisma.InvitationWhereInput;
}

export function invitationStatus(
  row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now = new Date(),
): InvitationStatus {
  if (row.acceptedAt) return 'ACCEPTED';
  if (row.revokedAt) return 'REVOKED';
  if (row.expiresAt <= now) return 'EXPIRED';
  return 'PENDING';
}

function toInvitationDTO(row: InvitationRow, now = new Date()): InvitationDTO {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    status: invitationStatus(row, now),
    invitedBy: { membershipId: row.invitedBy.id, name: nameOf(row.invitedBy.user) },
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/* Shared checks */

function invalidField(field: string, message: string) {
  return new AppError('VALIDATION_FAILED', message, { fields: { [field]: [message] } });
}

export function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function employeeCodeConflict(code: string) {
  const message = messages.employeeCodeTaken(code);
  return conflict(message, { fields: { employeeCode: [message] } });
}

/** Distinct ids, all from this organization, or VALIDATION_FAILED on `field`. */
async function idsInOrg(db: Db, tenant: Tenant, kind: 'site' | 'specialty', ids: readonly string[], field: string) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const where = { organizationId: tenant.orgId, id: { in: unique } };
  const found = kind === 'site' ? await db.site.count({ where }) : await db.specialty.count({ where });
  if (found !== unique.length) {
    throw invalidField(
      field,
      kind === 'site' ? 'Choose sites from this organization.' : 'Choose specialties from this organization.',
    );
  }
  return unique;
}

/**
 * Employee codes are unique per organization, across employee profiles and
 * pending invitations. The person's own profile (a revoked membership being
 * invited again, or the member being edited) does not count.
 */
async function employeeCodeTaken(db: Db, tenant: Tenant, code: string, ownerEmail: string): Promise<boolean> {
  const [profiles, invitations] = await Promise.all([
    db.employeeProfile.count({
      where: { organizationId: tenant.orgId, employeeCode: code, membership: { user: { email: { not: ownerEmail } } } },
    }),
    db.invitation.count({
      where: {
        organizationId: tenant.orgId,
        role: 'REPORTER',
        email: { not: ownerEmail },
        profile: { path: ['employeeCode'], equals: code },
        ...pendingInvitationWhere(),
      },
    }),
  ]);
  return profiles + invitations > 0;
}

async function checkEmployeeProfile(db: Db, tenant: Tenant, profile: EmployeeProfileInput, ownerEmail: string) {
  if (profile.homeSiteId) await idsInOrg(db, tenant, 'site', [profile.homeSiteId], 'employee.homeSiteId');
  if (profile.employeeCode && (await employeeCodeTaken(db, tenant, profile.employeeCode, ownerEmail))) {
    throw employeeCodeConflict(profile.employeeCode);
  }
}

async function checkIntervenantProfile(db: Db, tenant: Tenant, profile: IntervenantProfileInput) {
  return {
    companyName: profile.companyName ?? null,
    specialtyIds: await idsInOrg(db, tenant, 'specialty', profile.specialtyIds, 'intervenant.specialtyIds'),
    siteIds: await idsInOrg(db, tenant, 'site', profile.siteIds, 'intervenant.siteIds'),
  };
}

/* Members */

async function findMember(tenant: Tenant, id: string): Promise<MemberRow> {
  const member = await prisma.membership.findFirst({
    where: { id, organizationId: tenant.orgId },
    include: memberInclude,
  });
  if (!member) throw notFound('Member');
  return member;
}

export async function listMembers(tenant: Tenant, query: ListMembersQuery): Promise<MemberDTO[]> {
  // Each word must match one of the fields, so "jane doe" finds Jane Doe.
  const terms = query.q?.split(/\s+/).filter(Boolean).slice(0, 5) ?? [];
  const rows = await prisma.membership.findMany({
    where: {
      organizationId: tenant.orgId,
      ...(query.role ? { role: query.role } : {}),
      status: query.status ?? { not: 'REVOKED' },
      AND: terms.map((term) => ({
        OR: [
          { user: { firstName: { contains: term, mode: 'insensitive' } } },
          { user: { lastName: { contains: term, mode: 'insensitive' } } },
          { user: { email: { contains: term, mode: 'insensitive' } } },
          { employeeProfile: { employeeCode: { contains: term, mode: 'insensitive' } } },
        ],
      })),
    },
    include: memberInclude,
    orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }, { id: 'asc' }],
    take: MEMBER_LIST_CAP,
  });
  return toMemberDTOs(tenant, rows);
}

export async function getMember(tenant: Tenant, id: string): Promise<MemberDTO> {
  const [dto] = await toMemberDTOs(tenant, [await findMember(tenant, id)]);
  if (!dto) throw notFound('Member');
  return dto;
}

/** Profile edits. Each sub-object replaces the stored profile, including its specialty and site sets. */
export async function updateMember(tenant: Tenant, id: string, input: UpdateMemberInput): Promise<MemberDTO> {
  const member = await findMember(tenant, id);
  if (input.employee && member.role !== 'REPORTER') {
    throw invalidField('employee', 'Only an employee has an employee profile.');
  }
  if (input.intervenant && member.role !== 'INTERVENANT') {
    throw invalidField('intervenant', 'Only an intervenant has an intervenant profile.');
  }
  const { employee } = input;
  if (employee) await checkEmployeeProfile(prisma, tenant, employee, member.user.email);
  const intervenant = input.intervenant ? await checkIntervenantProfile(prisma, tenant, input.intervenant) : null;
  if (!employee && !intervenant) return getMember(tenant, id);

  const key = { membershipId_organizationId: { membershipId: id, organizationId: tenant.orgId } };
  const owned = { organizationId: tenant.orgId, membershipId: id };
  await prisma.$transaction(async (tx) => {
    if (employee) {
      const data = {
        employeeCode: employee.employeeCode ?? null,
        jobTitle: employee.jobTitle ?? null,
        department: employee.department ?? null,
        homeSiteId: employee.homeSiteId,
      };
      await tx.employeeProfile
        .upsert({ where: key, create: { ...owned, ...data }, update: data })
        .catch((error: unknown) => {
          // Another edit took the code between the check and this write.
          throw employee.employeeCode && isUniqueViolation(error) ? employeeCodeConflict(employee.employeeCode) : error;
        });
    }
    if (intervenant) {
      const { companyName, specialtyIds, siteIds } = intervenant;
      await tx.intervenantProfile.upsert({ where: key, create: { ...owned, companyName }, update: { companyName } });
      await tx.intervenantSpecialty.deleteMany({ where: { ...owned, specialtyId: { notIn: specialtyIds } } });
      await tx.intervenantSpecialty.createMany({
        data: specialtyIds.map((specialtyId) => ({ ...owned, specialtyId })),
        skipDuplicates: true,
      });
      // Kept rows keep their createdAt.
      await tx.siteAccess.deleteMany({ where: { ...owned, siteId: { notIn: siteIds } } });
      await tx.siteAccess.createMany({ data: siteIds.map((siteId) => ({ ...owned, siteId })), skipDuplicates: true });
    }
    await recordOrgEvent(tx, tenant, 'MEMBER_UPDATED', { memberId: id, name: nameOf(member.user) });
  });
  return getMember(tenant, id);
}

export type MemberStatusAction = 'suspend' | 'reactivate' | 'revoke';

const statusRules: Record<
  MemberStatusAction,
  { from: MembershipStatus[]; to: MembershipStatus; event: AuditEventType }
> = {
  suspend: { from: ['ACTIVE'], to: 'SUSPENDED', event: 'MEMBER_SUSPENDED' },
  reactivate: { from: ['SUSPENDED'], to: 'ACTIVE', event: 'MEMBER_REACTIVATED' },
  revoke: { from: ['ACTIVE', 'SUSPENDED'], to: 'REVOKED', event: 'MEMBER_REVOKED' },
};

function statusChangeRefused(action: MemberStatusAction, status: MembershipStatus): AppError {
  if (status === 'REVOKED') {
    return action === 'reactivate'
      ? conflict('Invite this person again to restore access.')
      : invalidTransition("This member's access is already revoked.");
  }
  if (status === 'SUSPENDED') return invalidTransition('This member is already suspended.');
  return invalidTransition('This member is already active.');
}

/**
 * Suspend, reactivate or revoke. Access ends on the member's next request (I13).
 * An intervenant losing access hands their open work back to the inbox in the
 * same transaction. Owners cannot lose access, which also protects the last owner (I6).
 */
export async function changeMemberStatus(
  tenant: Tenant,
  id: string,
  action: MemberStatusAction,
  reason: string | undefined,
): Promise<MemberDTO> {
  const member = await findMember(tenant, id);
  if (member.id === tenant.membershipId) throw forbidden('You cannot change your own access.');
  if (member.role === 'SUPERVISOR' && !tenant.isOwner) {
    throw forbidden("Only the account owner can change a supervisor's access.");
  }
  const removesAccess = action !== 'reactivate';
  if (member.isOwner && removesAccess) throw conflict('Transfer ownership before removing this supervisor.');
  const rule = statusRules[action];
  if (!rule.from.includes(member.status)) throw statusChangeRefused(action, member.status);

  await prisma.$transaction(async (tx) => {
    // Guarded write: a concurrent change or ownership transfer makes it a no-op.
    const { count } = await tx.membership.updateMany({
      where: {
        id,
        organizationId: tenant.orgId,
        status: { in: rule.from },
        ...(removesAccess ? { isOwner: false } : {}),
      },
      data: { status: rule.to, statusChangedAt: new Date() },
    });
    if (count === 0) throw invalidTransition('This member changed in the meantime. Reload and try again.');
    const releasedAssignments =
      member.role === 'INTERVENANT' && removesAccess
        ? await releaseLiveAssignments(tx, tenant, id, action === 'suspend' ? 'MEMBER_SUSPENDED' : 'MEMBER_REVOKED')
        : 0;
    await recordOrgEvent(tx, tenant, rule.event, {
      memberId: id,
      name: nameOf(member.user),
      reason: reason ?? null,
      releasedAssignments,
    });
  });
  return getMember(tenant, id);
}

/** The caller (an owner, checked by the route) hands the owner flag to another active supervisor. */
export async function transferOwnership(tenant: Tenant, id: string): Promise<MemberDTO> {
  const target = await findMember(tenant, id);
  if (target.id === tenant.membershipId) {
    throw conflict('You already own this organization. Choose another supervisor.');
  }
  const notEligible = 'Choose an active supervisor as the new owner.';
  if (target.role !== 'SUPERVISOR' || target.status !== 'ACTIVE') throw conflict(notEligible);

  await prisma.$transaction(async (tx) => {
    // Promote first, so the organization never has zero owners (I6).
    const promoted = await tx.membership.updateMany({
      where: { id, organizationId: tenant.orgId, role: 'SUPERVISOR', status: 'ACTIVE' },
      data: { isOwner: true },
    });
    if (promoted.count === 0) throw conflict(notEligible);
    const demoted = await tx.membership.updateMany({
      where: { id: tenant.membershipId, organizationId: tenant.orgId, isOwner: true },
      data: { isOwner: false },
    });
    if (demoted.count === 0) throw forbidden('Only the account owner can do this');
    await recordOrgEvent(tx, tenant, 'MEMBER_UPDATED', {
      memberId: id,
      name: nameOf(target.user),
      ownershipTransferred: true,
    });
  });
  return getMember(tenant, id);
}

/* Invitations */

/**
 * Serializes invitation writes per organization (single invites, resends and
 * imports), so the duplicate checks made inside the transaction hold until commit.
 */
export async function lockInvitations(tx: Tx, tenant: Tenant) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invitations:${tenant.orgId}`}))`;
}

/**
 * Who can be invited (3.2 unhappy paths): not a current member, no other
 * pending invitation, and for employees no current employee membership
 * elsewhere (I2, checked again at acceptance).
 */
async function assertInvitable(
  db: Db,
  tenant: Tenant,
  invitee: { email: string; role: MembershipRole },
  exceptInvitationId?: string,
) {
  const member = await db.membership.findFirst({
    where: { organizationId: tenant.orgId, status: { in: currentStatuses }, user: { email: invitee.email } },
    select: { user: { select: { firstName: true, lastName: true } } },
  });
  if (member) {
    const message = messages.alreadyMember(nameOf(member.user));
    throw conflict(message, { fields: { email: [message] } });
  }

  const pending = await db.invitation.findFirst({
    where: {
      organizationId: tenant.orgId,
      email: invitee.email,
      ...pendingInvitationWhere(),
      ...(exceptInvitationId ? { id: { not: exceptInvitationId } } : {}),
    },
    select: { id: true },
  });
  if (pending) {
    throw conflict(
      exceptInvitationId
        ? 'Another invitation is already pending for this email. Resend that one instead.'
        : messages.invitationPending,
      {
        invitationId: pending.id,
        fields: { email: [messages.invitationPending] },
      },
    );
  }

  if (invitee.role === 'REPORTER') {
    const elsewhere = await db.membership.count({
      where: {
        organizationId: { not: tenant.orgId },
        role: 'REPORTER',
        status: { in: currentStatuses },
        user: { email: invitee.email },
      },
    });
    if (elsewhere > 0) throw conflict(messages.employeeElsewhere, { fields: { email: [messages.employeeElsewhere] } });
  }
}

/** What Invitation.profile holds for an employee. Read back with employeeProfileSchema at acceptance. */
export function employeeProfileJson(profile: EmployeeProfileInput): Prisma.InputJsonObject {
  return {
    ...(profile.employeeCode ? { employeeCode: profile.employeeCode } : {}),
    ...(profile.jobTitle ? { jobTitle: profile.jobTitle } : {}),
    ...(profile.department ? { department: profile.department } : {}),
    homeSiteId: profile.homeSiteId,
  };
}

/** Validates the profile part of an invitation and returns what Invitation.profile stores. */
async function invitationProfile(db: Db, tenant: Tenant, input: InviteMemberInput): Promise<Prisma.InputJsonObject> {
  switch (input.role) {
    case 'REPORTER':
      await checkEmployeeProfile(db, tenant, input.employee, input.email);
      return employeeProfileJson(input.employee);
    case 'INTERVENANT': {
      const { companyName, specialtyIds, siteIds } = await checkIntervenantProfile(db, tenant, input.intervenant);
      return { ...(companyName ? { companyName } : {}), specialtyIds, siteIds };
    }
    case 'SUPERVISOR':
      return {};
  }
}

const rolePhrases: Record<'en' | 'fr', Record<MembershipRole, string>> = {
  en: { REPORTER: 'an employee', INTERVENANT: 'an intervenant', SUPERVISOR: 'a supervisor' },
  fr: { REPORTER: 'employé', INTERVENANT: 'intervenant', SUPERVISOR: 'superviseur' },
};

export function acceptUrl(token: string): string {
  return `${env.WEB_ORIGIN}/invite/${token}`;
}

/** Sent after the commit. False when delivery failed: the supervisor can resend. */
export function sendInvitationEmail(
  tenant: Tenant,
  invitation: { email: string; firstName: string; role: MembershipRole },
  token: string,
): Promise<boolean> {
  const locale = tenant.org.defaultLocale;
  return mail.invitation(invitation.email, locale, {
    name: invitation.firstName,
    organization: tenant.org.displayName,
    role: rolePhrases[locale === 'fr' ? 'fr' : 'en'][invitation.role],
    inviter: tenant.name,
    link: acceptUrl(token),
  });
}

async function findInvitation(tenant: Tenant, id: string): Promise<InvitationRow> {
  const invitation = await prisma.invitation.findFirst({
    where: { id, organizationId: tenant.orgId },
    include: invitationInclude,
  });
  if (!invitation) throw notFound('Invitation');
  return invitation;
}

/** Resend and revoke apply to invitations nobody has answered yet. */
function assertOpen(invitation: InvitationRow) {
  const status = invitationStatus(invitation);
  if (status === 'ACCEPTED') throw invalidTransition('This invitation was already accepted.');
  if (status === 'REVOKED') throw invalidTransition('This invitation was revoked. Send a new invitation instead.');
}

export async function listInvitations(tenant: Tenant): Promise<InvitationDTO[]> {
  const rows = await prisma.invitation.findMany({
    where: { organizationId: tenant.orgId },
    include: invitationInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: INVITATION_LIST_CAP,
  });
  const now = new Date();
  return rows.map((row) => toInvitationDTO(row, now));
}

export async function inviteMember(tenant: Tenant, input: InviteMemberInput): Promise<InviteResult> {
  if (input.role === 'SUPERVISOR' && !tenant.isOwner) {
    throw forbidden('Only the account owner can invite a supervisor.');
  }

  const token = newToken();
  const invitation = await prisma.$transaction(async (tx) => {
    await lockInvitations(tx, tenant);
    await assertInvitable(tx, tenant, input);
    const profile = await invitationProfile(tx, tenant, input);
    const row = await tx.invitation.create({
      data: {
        organizationId: tenant.orgId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        profile,
        tokenHash: hashToken(token),
        invitedByMembershipId: tenant.membershipId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      include: invitationInclude,
    });
    await recordOrgEvent(tx, tenant, 'MEMBER_INVITED', { email: row.email, role: row.role, name: nameOf(row) });
    return row;
  });

  const emailSent = await sendInvitationEmail(tenant, invitation, token);
  return { invitation: toInvitationDTO(invitation), acceptUrl: acceptUrl(token), emailSent };
}

/** New token and expiry. The previous link stops working because its hash is replaced (3.2). */
export async function resendInvitation(tenant: Tenant, id: string): Promise<InviteResult> {
  const current = await findInvitation(tenant, id);
  assertOpen(current);
  if (current.role === 'SUPERVISOR' && !tenant.isOwner) {
    throw forbidden('Only the account owner can invite a supervisor.');
  }

  const token = newToken();
  const invitation = await prisma.$transaction(async (tx) => {
    await lockInvitations(tx, tenant);
    await assertInvitable(tx, tenant, current, current.id);
    // An expired invitation's employee code was free for others until now, so check it again.
    if (current.role === 'REPORTER') {
      const stored = employeeProfileSchema.safeParse(current.profile);
      const code = stored.success ? stored.data.employeeCode : undefined;
      if (code && (await employeeCodeTaken(tx, tenant, code, current.email))) {
        throw conflict(
          `Employee code ${code} is now used by someone else. Revoke this invitation and send a new one with another code.`,
        );
      }
    }
    const { count } = await tx.invitation.updateMany({
      where: { id, organizationId: tenant.orgId, acceptedAt: null, revokedAt: null },
      data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) },
    });
    if (count === 0) throw invalidTransition('This invitation was answered in the meantime. Reload and try again.');
    // No dedicated event type: a resend is recorded as a new invitation for the same person.
    await recordOrgEvent(tx, tenant, 'MEMBER_INVITED', {
      email: current.email,
      role: current.role,
      name: nameOf(current),
      resent: true,
    });
    return tx.invitation.findFirstOrThrow({ where: { id, organizationId: tenant.orgId }, include: invitationInclude });
  });

  const emailSent = await sendInvitationEmail(tenant, invitation, token);
  return { invitation: toInvitationDTO(invitation), acceptUrl: acceptUrl(token), emailSent };
}

export async function revokeInvitation(tenant: Tenant, id: string): Promise<InvitationDTO> {
  const current = await findInvitation(tenant, id);
  assertOpen(current);

  const invitation = await prisma.$transaction(async (tx) => {
    const { count } = await tx.invitation.updateMany({
      where: { id, organizationId: tenant.orgId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw invalidTransition('This invitation was answered in the meantime. Reload and try again.');
    await recordOrgEvent(tx, tenant, 'INVITATION_REVOKED', { email: current.email, role: current.role });
    return tx.invitation.findFirstOrThrow({ where: { id, organizationId: tenant.orgId }, include: invitationInclude });
  });
  return toInvitationDTO(invitation);
}
