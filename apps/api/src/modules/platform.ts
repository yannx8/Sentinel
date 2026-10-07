/**
 * Platform console (docs/PRD.md 4.9, 5.4): organizations, the registration pipeline
 * and the platform audit log. Platform admins see organization metadata, the owner
 * contact and counts, never incident content or other member data. Every write
 * appends a PlatformAuditEvent in the same transaction (I12).
 */
import type { Organization, Prisma } from '@prisma/client';
import {
  cursorQuery,
  openIncidentStatuses,
  organizationStatuses,
  reactivateOrganizationSchema,
  suspendOrganizationSchema,
  updatePlanSchema,
  uuidSchema,
  type MembershipRole,
  type PlatformAuditDTO,
  type PlatformOrganizationDetail,
  type PlatformOrganizationDTO,
  type RegistrationDTO,
} from '@sentinel/shared';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { authOf } from '../auth/context';
import { hashToken, newToken } from '../lib/crypto';
import { logger } from '../lib/logger';
import { mail } from '../lib/mailer';
import { prisma, type Tx } from '../lib/prisma';
import { decodeCursor, page } from '../http/cursor';
import { AppError, invalidTransition, notFound } from '../http/errors';
import { idempotent } from '../http/idempotency';
import { parse, parseId } from '../http/validate';

const DAY_MS = 24 * 3600 * 1000;
const ACTIVITY_WINDOW_MS = 30 * DAY_MS;
const HISTORY_LIMIT = 50;
const REGISTRATION_TTL_MS = DAY_MS;
const REGISTRATION_RETENTION_MS = 7 * DAY_MS;

const registrationStatuses = ['PENDING', 'EXPIRED', 'VERIFIED'] as const satisfies readonly RegistrationDTO['status'][];
type RegistrationStatus = (typeof registrationStatuses)[number];

const listOrganizationsQuery = cursorQuery.extend({ status: z.enum(organizationStatuses).optional() });
const listRegistrationsQuery = cursorQuery.extend({ status: z.enum(registrationStatuses).optional() });

type CursorQuery = z.output<typeof cursorQuery>;
type ListOrganizationsQuery = z.output<typeof listOrganizationsQuery>;
type ListRegistrationsQuery = z.output<typeof listRegistrationsQuery>;
type SuspendInput = z.output<typeof suspendOrganizationSchema>;
type ReactivateInput = z.output<typeof reactivateOrganizationSchema>;
type UpdatePlanInput = z.output<typeof updatePlanSchema>;

/** The parts of a stored registration payload needed to resend the verification email. */
const verificationContact = z.object({
  defaultLocale: z.string(),
  contact: z.object({ firstName: z.string() }),
});

const nameOf = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;

/* Cursor: every platform list is newest first, keyed on (createdAt desc, id desc). */

const invalidCursor = () =>
  new AppError('VALIDATION_FAILED', 'Invalid cursor', { fields: { cursor: ['Invalid cursor'] } });

const newestFirstCursor = (row: { createdAt: Date; id: string }) => [row.createdAt.toISOString(), row.id];

/** Keyset condition for the rows after the cursor in newest first order. */
function olderThan(cursor: string | undefined) {
  const values = decodeCursor(cursor);
  if (!values) return {};
  const [rawAt, rawId] = values;
  const at = typeof rawAt === 'string' ? new Date(rawAt) : null;
  if (values.length !== 2 || !at || Number.isNaN(at.getTime())) throw invalidCursor();
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) throw invalidCursor();
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id.data } }] };
}

/* Organizations */

function summaryInclude(since: Date) {
  return {
    memberships: {
      where: { isOwner: true, status: 'ACTIVE' },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: 1,
      select: { user: { select: { firstName: true, lastName: true, email: true } } },
    },
    _count: {
      select: {
        memberships: { where: { status: 'ACTIVE' } },
        sites: { where: { isActive: true } },
        incidents: { where: { createdAt: { gte: since } } },
      },
    },
  } satisfies Prisma.OrganizationInclude;
}

type OrganizationRow = Prisma.OrganizationGetPayload<{ include: ReturnType<typeof summaryInclude> }>;

/**
 * Latest audit timestamp per organization. The correlated max() reads a single entry of the
 * (organizationId, createdAt) index per organization, however long the audit trail is.
 */
async function lastActivityOf(organizationIds: string[]): Promise<Map<string, Date>> {
  if (organizationIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; at: Date | null }[]>`
    SELECT o.id, (SELECT max(a."createdAt") FROM "AuditEvent" a WHERE a."organizationId" = o.id) AS at
    FROM unnest(${organizationIds}::uuid[]) AS o(id)`;
  return new Map(rows.flatMap((row) => (row.at ? [[row.id, row.at] as const] : [])));
}

function toOrganizationDTO(org: OrganizationRow, lastActivityAt: Date | undefined): PlatformOrganizationDTO {
  const owner = org.memberships[0]?.user;
  return {
    id: org.id,
    displayName: org.displayName,
    legalName: org.legalName,
    status: org.status,
    plan: org.plan,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    industry: org.industry,
    country: org.country,
    createdAt: org.createdAt.toISOString(),
    owner: owner ? { name: nameOf(owner), email: owner.email } : null,
    counts: {
      members: org._count.memberships,
      sites: org._count.sites,
      incidentsLast30Days: org._count.incidents,
    },
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
  };
}

function organizationFilters(query: ListOrganizationsQuery): Prisma.OrganizationWhereInput[] {
  const filters: Prisma.OrganizationWhereInput[] = [];
  if (query.status) filters.push({ status: query.status });
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' } as const;
    filters.push({ OR: [{ displayName: contains }, { legalName: contains }, { billingEmail: contains }] });
  }
  return filters;
}

export async function listOrganizations(query: ListOrganizationsQuery) {
  const rows = await prisma.organization.findMany({
    where: { AND: [...organizationFilters(query), olderThan(query.cursor)] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    include: summaryInclude(new Date(Date.now() - ACTIVITY_WINDOW_MS)),
  });
  const result = page(rows, query.limit, newestFirstCursor);
  const lastActivity = await lastActivityOf(result.data.map((org) => org.id));
  return { data: result.data.map((org) => toOrganizationDTO(org, lastActivity.get(org.id))), page: result.page };
}

export async function getOrganizationDetail(id: string): Promise<PlatformOrganizationDetail> {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: summaryInclude(new Date(Date.now() - ACTIVITY_WINDOW_MS)),
  });
  if (!org) throw notFound('Organization');

  const [roles, openIncidents, history, lastActivity] = await Promise.all([
    prisma.membership.groupBy({
      by: ['role'],
      where: { organizationId: id, status: 'ACTIVE' },
      _count: { _all: true },
    }),
    prisma.incident.count({ where: { organizationId: id, status: { in: [...openIncidentStatuses] } } }),
    prisma.platformAuditEvent.findMany({
      where: { organizationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_LIMIT,
      include: auditInclude,
    }),
    // org.id, not the URL id: parseId accepts uppercase, the raw query answers the lowercase form.
    lastActivityOf([org.id]),
  ]);
  const withRole = (role: MembershipRole) => roles.find((row) => row.role === role)?._count._all ?? 0;

  const summary = toOrganizationDTO(org, lastActivity.get(org.id));
  return {
    ...summary,
    registrationNumber: org.registrationNumber,
    billingEmail: org.billingEmail,
    timezone: org.timezone,
    counts: {
      ...summary.counts,
      supervisors: withRole('SUPERVISOR'),
      employees: withRole('REPORTER'),
      intervenants: withRole('INTERVENANT'),
      openIncidents,
    },
    history: history.map(toAuditDTO),
  };
}

/**
 * Locks the organization row until commit, then reloads it, so concurrent platform writes
 * apply one after the other and each event records the state it replaced. NO KEY UPDATE
 * leaves tenant inserts that reference the organization unblocked.
 */
async function lockOrganization(tx: Tx, id: string): Promise<Organization> {
  await tx.$queryRaw`SELECT 1 FROM "Organization" WHERE "id" = ${id}::uuid FOR NO KEY UPDATE`;
  const org = await tx.organization.findUnique({ where: { id } });
  if (!org) throw notFound('Organization');
  return org;
}

/** Takes effect on the next request of every member: the tenant guard checks the organization status (I13). */
export async function suspendOrganization(
  adminUserId: string,
  id: string,
  input: SuspendInput,
): Promise<PlatformOrganizationDetail> {
  const notice = await prisma.$transaction(async (tx) => {
    const org = await lockOrganization(tx, id);
    if (org.status !== 'ACTIVE') {
      throw invalidTransition(
        org.status === 'SUSPENDED'
          ? 'This organization is already suspended.'
          : 'This organization is closed and cannot be suspended.',
      );
    }
    await tx.organization.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await tx.platformAuditEvent.create({
      data: { adminUserId, organizationId: id, type: 'ORG_SUSPENDED', reason: input.reason },
    });
    const owner = await tx.membership.findFirst({
      where: { organizationId: id, isOwner: true, status: 'ACTIVE' },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      select: { user: { select: { email: true, locale: true } } },
    });
    return { organization: org.displayName, owner: owner?.user ?? null };
  });

  // After commit. The mailer logs a failed delivery; the suspension stands either way.
  if (notice.owner) {
    await mail.organizationSuspended(notice.owner.email, notice.owner.locale, notice.organization, input.reason);
  } else {
    logger.warn({ organizationId: id }, 'Suspended organization has no active owner to email');
  }
  return getOrganizationDetail(id);
}

export async function reactivateOrganization(
  adminUserId: string,
  id: string,
  input: ReactivateInput,
): Promise<PlatformOrganizationDetail> {
  await prisma.$transaction(async (tx) => {
    const org = await lockOrganization(tx, id);
    if (org.status !== 'SUSPENDED') {
      throw invalidTransition(
        org.status === 'ACTIVE'
          ? 'This organization is already active.'
          : 'This organization is closed and cannot be reactivated.',
      );
    }
    await tx.organization.update({ where: { id }, data: { status: 'ACTIVE' } });
    await tx.platformAuditEvent.create({
      data: { adminUserId, organizationId: id, type: 'ORG_REACTIVATED', reason: input.reason ?? null },
    });
  });
  return getOrganizationDetail(id);
}

/**
 * Sets the plan and, when given, the trial end date (informational in v1, docs/PRD.md A7).
 * An omitted trialEndsAt keeps the current one, null clears it. A save that changes nothing
 * writes nothing.
 */
export async function changePlan(
  adminUserId: string,
  id: string,
  input: UpdatePlanInput,
): Promise<PlatformOrganizationDetail> {
  await prisma.$transaction(async (tx) => {
    const org = await lockOrganization(tx, id);
    if (org.status === 'CLOSED') throw invalidTransition('This organization is closed. Its plan can no longer change.');
    const trialEndsAt =
      input.trialEndsAt === undefined
        ? org.trialEndsAt
        : input.trialEndsAt === null
          ? null
          : endOfDayIn(input.trialEndsAt, org.timezone);
    if (input.plan === org.plan && trialEndsAt?.getTime() === org.trialEndsAt?.getTime()) return;

    await tx.organization.update({ where: { id }, data: { plan: input.plan, trialEndsAt } });
    await tx.platformAuditEvent.create({
      data: {
        adminUserId,
        organizationId: id,
        type: 'PLAN_CHANGED',
        payload: { from: org.plan, to: input.plan, trialEndsAt: trialEndsAt?.toISOString() ?? null },
      },
    });
  });
  return getOrganizationDetail(id);
}

/** The last millisecond of a calendar day in a time zone: a trial ending on 1 Nov covers all of 1 Nov locally. */
function endOfDayIn(date: string, timeZone: string): Date {
  const nextMidnight = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 1);
  // Second pass: the offset at local midnight can differ from the first guess across a DST change.
  const firstGuess = nextMidnight - zoneOffset(timeZone, nextMidnight);
  return new Date(nextMidnight - zoneOffset(timeZone, firstGuess) - 1);
}

/** Milliseconds the zone's wall clock is ahead of UTC at an instant. */
function zoneOffset(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wallClock = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClock - (at - (at % 1000));
}

/* Registrations. The payload holds a password hash and never leaves the server. */

const registrationSelect = {
  id: true,
  email: true,
  companyName: true,
  contactName: true,
  verifiedAt: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.OrganizationRegistrationSelect;

type RegistrationRow = Prisma.OrganizationRegistrationGetPayload<{ select: typeof registrationSelect }>;

/** Same boundary as verification: a link is expired once expiresAt is in the past. */
function registrationStatus(row: RegistrationRow, now: Date): RegistrationStatus {
  if (row.verifiedAt) return 'VERIFIED';
  return row.expiresAt < now ? 'EXPIRED' : 'PENDING';
}

function registrationStatusWhere(
  status: RegistrationStatus | undefined,
  now: Date,
): Prisma.OrganizationRegistrationWhereInput {
  switch (status) {
    case 'VERIFIED':
      return { verifiedAt: { not: null } };
    case 'EXPIRED':
      return { verifiedAt: null, expiresAt: { lt: now } };
    case 'PENDING':
      return { verifiedAt: null, expiresAt: { gte: now } };
    case undefined:
      return {};
  }
}

function toRegistrationDTO(row: RegistrationRow, now: Date): RegistrationDTO {
  return {
    id: row.id,
    email: row.email,
    companyName: row.companyName,
    contactName: row.contactName,
    status: registrationStatus(row, now),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function listRegistrations(query: ListRegistrationsQuery) {
  const now = new Date();
  // F-PLT-03: an unverified registration stays visible 7 days after its link expired, then goes.
  await prisma.organizationRegistration.deleteMany({
    where: { verifiedAt: null, expiresAt: { lt: new Date(now.getTime() - REGISTRATION_RETENTION_MS) } },
  });

  const filters: Prisma.OrganizationRegistrationWhereInput[] = [registrationStatusWhere(query.status, now)];
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' } as const;
    filters.push({ OR: [{ email: contains }, { companyName: contains }, { contactName: contains }] });
  }
  const rows = await prisma.organizationRegistration.findMany({
    where: { AND: [...filters, olderThan(query.cursor)] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: registrationSelect,
  });
  const result = page(rows, query.limit, newestFirstCursor);
  return { data: result.data.map((row) => toRegistrationDTO(row, now)), page: result.page };
}

/** New link valid 24 hours. The previous link stops working. Pending and expired registrations only. */
export async function resendRegistration(adminUserId: string, id: string): Promise<RegistrationDTO> {
  const token = newToken();
  const { registration, contact } = await prisma.$transaction(async (tx) => {
    // Holds off a concurrent purge or a second resend until this one commits.
    await tx.$queryRaw`SELECT 1 FROM "OrganizationRegistration" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const current = await tx.organizationRegistration.findUnique({ where: { id } });
    if (!current) throw notFound('Registration');
    if (current.verifiedAt) {
      throw invalidTransition('This registration is already verified, so there is no link to resend.');
    }
    const contact = verificationContact.parse(current.payload);

    const registration = await tx.organizationRegistration.update({
      where: { id },
      data: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REGISTRATION_TTL_MS) },
      select: registrationSelect,
    });
    await tx.platformAuditEvent.create({
      data: { adminUserId, organizationId: null, type: 'REGISTRATION_RESENT', payload: { email: registration.email } },
    });
    return { registration, contact };
  });

  const link = `${env.WEB_ORIGIN}/verify-email?token=${token}`;
  await mail.verifyRegistration(registration.email, contact.defaultLocale, contact.contact.firstName, link);
  return toRegistrationDTO(registration, new Date());
}

/* Platform audit log */

const auditInclude = {
  admin: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
  organization: { select: { id: true, displayName: true } },
} satisfies Prisma.PlatformAuditEventInclude;

type AuditRow = Prisma.PlatformAuditEventGetPayload<{ include: typeof auditInclude }>;

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function toAuditDTO(row: AuditRow): PlatformAuditDTO {
  return {
    id: row.id,
    type: row.type,
    admin: { name: nameOf(row.admin.user), email: row.admin.user.email },
    organization: row.organization ? { id: row.organization.id, displayName: row.organization.displayName } : null,
    reason: row.reason,
    payload: jsonObject(row.payload),
    createdAt: row.createdAt.toISOString(),
  };
}

/** q matches the organization name, the admin email or the reason. */
export async function listPlatformAudit(query: CursorQuery) {
  const filters: Prisma.PlatformAuditEventWhereInput[] = [];
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' } as const;
    filters.push({
      OR: [
        { organization: { is: { displayName: contains } } },
        { admin: { user: { email: contains } } },
        { reason: contains },
      ],
    });
  }
  const rows = await prisma.platformAuditEvent.findMany({
    where: { AND: [...filters, olderThan(query.cursor)] },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    include: auditInclude,
  });
  const result = page(rows, query.limit, newestFirstCursor);
  return { data: result.data.map(toAuditDTO), page: result.page };
}

/* Routes */

/** Mounted at /v1/platform behind requireUser and requirePlatformAdmin. */
export const platformRoutes = Router();

platformRoutes.get('/organizations', async (req, res) => {
  const list = await listOrganizations(parse(listOrganizationsQuery, req.query));
  res.json({ data: list.data, page: list.page });
});

platformRoutes.get('/organizations/:id', async (req, res) => {
  res.json({ data: await getOrganizationDetail(parseId(req.params.id, 'Organization')) });
});

// State transitions accept an Idempotency-Key (docs/PRD.md 6.8): a retried suspend replays its answer.
platformRoutes.post('/organizations/:id/suspend', async (req, res) => {
  const id = parseId(req.params.id, 'Organization');
  const input = parse(suspendOrganizationSchema, req.body);
  const result = await idempotent(req, 'platform.suspend', async () => ({
    status: 200,
    body: { data: await suspendOrganization(authOf(req).user.id, id, input) },
  }));
  res.status(result.status).json(result.body);
});

platformRoutes.post('/organizations/:id/reactivate', async (req, res) => {
  const id = parseId(req.params.id, 'Organization');
  const input = parse(reactivateOrganizationSchema, req.body ?? {});
  const result = await idempotent(req, 'platform.reactivate', async () => ({
    status: 200,
    body: { data: await reactivateOrganization(authOf(req).user.id, id, input) },
  }));
  res.status(result.status).json(result.body);
});

platformRoutes.patch('/organizations/:id/plan', async (req, res) => {
  const id = parseId(req.params.id, 'Organization');
  const input = parse(updatePlanSchema, req.body);
  res.json({ data: await changePlan(authOf(req).user.id, id, input) });
});

platformRoutes.get('/registrations', async (req, res) => {
  const list = await listRegistrations(parse(listRegistrationsQuery, req.query));
  res.json({ data: list.data, page: list.page });
});

platformRoutes.post('/registrations/:id/resend', async (req, res) => {
  const id = parseId(req.params.id, 'Registration');
  res.json({ data: await resendRegistration(authOf(req).user.id, id) });
});

platformRoutes.get('/audit', async (req, res) => {
  const list = await listPlatformAudit(parse(cursorQuery, req.query));
  res.json({ data: list.data, page: list.page });
});
