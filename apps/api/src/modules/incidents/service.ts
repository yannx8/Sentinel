/**
 * Incidents and assignments: the inbox, the case file, the Thread and every
 * transition of docs/PRD.md 6.2. Each mutation runs in one transaction with its
 * audit event and notifications. writeIncident is the first write of every
 * version-checked change, so it takes the row lock and concurrent requests queue
 * behind it and fail with CONFLICT_CONCURRENT_UPDATE instead of racing.
 */
import type { Incident, Prisma } from '@prisma/client';
import {
  formatReference,
  incidentActions,
  incidentStatuses,
  isThreadEventVisible,
  nextStatus,
  priorities,
  priorityRank,
  rankCandidates,
  redactThreadPayload,
  threadEventTypes,
  type assignSchema,
  type AssignmentStatus,
  type CandidateDTO,
  type closeSchema,
  type commentSchema,
  type CreateIncidentInput,
  type declineSchema,
  type dismissSchema,
  type InboxView,
  type IncidentDetail,
  type IncidentListItem,
  type IncidentStatus,
  type IncidentTrigger,
  type ListIncidentsQuery,
  type Priority,
  type progressSchema,
  type ReassignmentRequestDTO,
  type rejectReassignmentSchema,
  type requestReassignmentSchema,
  type resolveSchema,
  type sendBackSchema,
  type ThreadEvent,
  type ThreadEventType,
  type ThreadViewer,
  type triageSchema,
  type unassignSchema,
} from '@sentinel/shared';
import type { z } from 'zod';
import type { Tenant } from '../../auth/context';
import { recordIncidentEvent } from '../../lib/audit';
import { activeSupervisorIds, notify } from '../../lib/notify';
import { prisma, type Tx } from '../../lib/prisma';
import { decodeCursor, page } from '../../http/cursor';
import { AppError, conflict, forbidden, invalidTransition, notFound, staleVersion } from '../../http/errors';
import {
  incidentDetailInclude,
  incidentListInclude,
  liveOf,
  liveStatuses,
  personRef,
  personSelect,
  toDetail,
  toListItem,
} from './mappers';
import { findVisibleIncident, incidentScope, liveAssignmentCounts, threadViewerFor, writeIncident } from './scope';

type Db = Tx | typeof prisma;

type TriageInput = z.output<typeof triageSchema>;
type AssignInput = z.output<typeof assignSchema>;
type UnassignInput = z.output<typeof unassignSchema>;
type CloseInput = z.output<typeof closeSchema>;
type SendBackInput = z.output<typeof sendBackSchema>;
type DismissInput = z.output<typeof dismissSchema>;
type CommentInput = z.output<typeof commentSchema>;
type DeclineInput = z.output<typeof declineSchema>;
type RequestReassignmentInput = z.output<typeof requestReassignmentSchema>;
type ProgressInput = z.output<typeof progressSchema>;
type ResolveInput = z.output<typeof resolveSchema>;
type RejectReassignmentInput = z.output<typeof rejectReassignmentSchema>;

export type IncidentCounts = Record<'attention' | 'unassigned' | 'inProgress' | 'review' | 'open' | 'closed', number>;

const CLOSED_READ_ONLY = 'Closed incidents are read-only.';
const NO_LONGER_PENDING = 'This assignment is no longer waiting for you. It may have been reassigned.';
const REQUEST_NOT_PENDING = 'This reassignment request is no longer pending.';

/* Shared helpers */

function invalidField(field: string, message: string) {
  return new AppError('VALIDATION_FAILED', message, { fields: { [field]: [message] } });
}

/** Fails fast on a stale copy, before anything is written. writeIncident checks again under the row lock. */
function assertVersion(incident: Incident, expectedVersion: number) {
  if (incident.version === expectedVersion) return;
  throw staleVersion({
    version: incident.version,
    status: incident.status,
    updatedAt: incident.updatedAt.toISOString(),
  });
}

/** Target status of a legal transition (6.2), otherwise INVALID_STATE_TRANSITION. */
function transitionTo(from: IncidentStatus, trigger: IncidentTrigger, message: string): IncidentStatus {
  const to = nextStatus(from, trigger);
  if (to) return to;
  throw invalidTransition(from === 'CLOSED' ? CLOSED_READ_ONLY : message);
}

/** Moves an assignment out of one of `from`, or fails when a concurrent request moved it first. */
async function moveAssignment(
  tx: Tx,
  tenant: Tenant,
  assignmentId: string,
  from: AssignmentStatus[],
  data: Prisma.AssignmentUpdateManyMutationInput,
  message: string,
) {
  const { count } = await tx.assignment.updateMany({
    where: { id: assignmentId, organizationId: tenant.orgId, status: { in: from } },
    data,
  });
  if (count === 0) throw invalidTransition(message);
}

async function findLiveAssignment(db: Db, tenant: Tenant, incidentId: string) {
  const assignment = await db.assignment.findFirst({
    where: { organizationId: tenant.orgId, incidentId, status: { in: liveStatuses } },
    include: { intervenant: { select: personSelect } },
  });
  return assignment ? liveOf([assignment]) : null;
}

async function activeCategory(db: Db, tenant: Tenant, categoryId: string) {
  const category = await db.incidentCategory.findFirst({
    where: { id: categoryId, organizationId: tenant.orgId },
    select: { id: true, name: true, defaultPriority: true, isActive: true },
  });
  if (!category?.isActive) {
    throw invalidField('categoryId', 'This category is no longer available. Choose another category.');
  }
  return category;
}

/** Category for a triage. Keeping the current one is allowed even if it was deactivated since. */
async function triageCategory(db: Db, tenant: Tenant, incident: Incident, categoryId: string) {
  if (categoryId !== incident.categoryId) return activeCategory(db, tenant, categoryId);
  const current = await db.incidentCategory.findFirst({
    where: { id: categoryId, organizationId: tenant.orgId },
    select: { id: true, name: true },
  });
  if (!current) throw notFound('Category');
  return current;
}

/**
 * Applies triage after writeIncident has checked the version and locked the row,
 * and records TRIAGED when priority or category changed. writeIncident's input type
 * carries no foreign keys, so the category is written here.
 */
async function applyTriage(
  tx: Tx,
  tenant: Tenant,
  incident: Incident,
  priority: Priority,
  category: { id: string; name: string } | null,
) {
  const categoryChanged = category !== null && category.id !== incident.categoryId;
  if (!categoryChanged && priority === incident.priority) return;
  if (categoryChanged) {
    await tx.incident.updateMany({
      where: { id: incident.id, organizationId: tenant.orgId },
      data: { categoryId: category.id },
    });
  }
  const current = await tx.incidentCategory.findFirst({
    where: { id: incident.categoryId, organizationId: tenant.orgId },
    select: { name: true },
  });
  const currentName = current?.name ?? '';
  await recordIncidentEvent(tx, tenant, incident.id, 'TRIAGED', {
    from: { priority: incident.priority, category: currentName },
    to: { priority, category: categoryChanged ? category.name : currentName },
  });
}

/** Notification fields shared by every event the caller causes on an incident. */
function noticeFrom(tenant: Tenant, incidentId: string) {
  return { orgId: tenant.orgId, incidentId, actorMembershipId: tenant.membershipId, actorName: tenant.name };
}

/** The case file as the caller sees it. Callers have already checked access. */
export async function loadDetail(tenant: Tenant, incidentId: string): Promise<IncidentDetail> {
  const row = await prisma.incident.findFirst({
    where: { id: incidentId, organizationId: tenant.orgId },
    include: incidentDetailInclude,
  });
  if (!row) throw notFound('Incident');
  return toDetail(row, tenant);
}

/* Inbox */

function viewWhere(view: InboxView | undefined): Prisma.IncidentWhereInput {
  switch (view) {
    case 'attention':
      return {
        OR: [{ status: { in: ['NEW', 'RESOLVED'] } }, { assignments: { some: { status: 'REASSIGNMENT_REQUESTED' } } }],
      };
    case 'unassigned':
      return { status: 'NEW' };
    case 'in-progress':
      return { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } };
    case 'review':
      return { status: 'RESOLVED' };
    case 'open':
      return { status: { not: 'CLOSED' } };
    case 'closed':
      return { status: 'CLOSED' };
    case 'all':
    case undefined:
      return {};
  }
}

const statusValues: readonly string[] = incidentStatuses;

// listIncidentsQuery types its status list as string[]; the schema has already rejected unknown values.
function isIncidentStatus(value: string): value is IncidentStatus {
  return statusValues.includes(value);
}

function filterWhere(query: ListIncidentsQuery): Prisma.IncidentWhereInput[] {
  const filters: Prisma.IncidentWhereInput[] = [];
  const statuses = query.status?.filter(isIncidentStatus);
  if (statuses?.length) filters.push({ status: { in: statuses } });
  if (query.priority?.length) filters.push({ priority: { in: query.priority } });
  if (query.siteId) filters.push({ siteId: query.siteId });
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.assigneeId) {
    filters.push({
      assignments: { some: { intervenantMembershipId: query.assigneeId, status: { in: liveStatuses } } },
    });
  }
  if (query.q) {
    const contains = { contains: query.q, mode: 'insensitive' } as const;
    filters.push({ OR: [{ reference: contains }, { title: contains }, { description: contains }] });
  }
  return filters;
}

type Sort = ListIncidentsQuery['sort'];

const sortOrder: Record<Sort, Prisma.IncidentOrderByWithRelationInput[]> = {
  // Postgres orders the Priority enum by declaration: LOW < MEDIUM < HIGH < CRITICAL.
  urgency: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  updated: [{ updatedAt: 'desc' }, { id: 'desc' }],
};

function cursorOf(sort: Sort, row: Incident): (string | number)[] {
  switch (sort) {
    case 'urgency':
      return [row.priority, row.createdAt.toISOString(), row.id];
    case 'newest':
    case 'oldest':
      return [row.createdAt.toISOString(), row.id];
    case 'updated':
      return [row.updatedAt.toISOString(), row.id];
  }
}

const invalidCursor = () =>
  new AppError('VALIDATION_FAILED', 'Invalid cursor', { fields: { cursor: ['Invalid cursor'] } });

function cursorDate(value: string | number | undefined): Date {
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw invalidCursor();
  return date;
}

function cursorId(value: string | number | undefined): string {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
    return value;
  throw invalidCursor();
}

function cursorPriority(value: string | number | undefined): Priority {
  const priority = priorities.find((p) => p === value);
  if (!priority) throw invalidCursor();
  return priority;
}

/** Keyset condition for the rows after the cursor, in the same order as sortOrder. */
function afterCursor(sort: Sort, cursor: string | undefined): Prisma.IncidentWhereInput {
  const values = decodeCursor(cursor);
  if (!values) return {};
  if (values.length !== (sort === 'urgency' ? 3 : 2)) throw invalidCursor();

  if (sort === 'urgency') {
    const priority = cursorPriority(values[0]);
    const createdAt = cursorDate(values[1]);
    const id = cursorId(values[2]);
    // Prisma has no lt/gt on enums, so "less urgent" is the set of lower priorities.
    const lower = priorities.filter((p) => priorityRank[p] < priorityRank[priority]);
    return {
      OR: [
        ...(lower.length ? [{ priority: { in: lower } }] : []),
        { priority, createdAt: { gt: createdAt } },
        { priority, createdAt, id: { gt: id } },
      ],
    };
  }

  const at = cursorDate(values[0]);
  const id = cursorId(values[1]);
  if (sort === 'oldest') return { OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] };
  if (sort === 'newest') return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] };
  return { OR: [{ updatedAt: { lt: at } }, { updatedAt: at, id: { lt: id } }] };
}

export async function listIncidents(tenant: Tenant, query: ListIncidentsQuery) {
  const rows = await prisma.incident.findMany({
    where: {
      AND: [incidentScope(tenant), viewWhere(query.view), ...filterWhere(query), afterCursor(query.sort, query.cursor)],
    },
    orderBy: sortOrder[query.sort],
    take: query.limit + 1,
    include: incidentListInclude,
  });
  const result = page(rows, query.limit, (row) => cursorOf(query.sort, row));
  return { data: result.data.map(toListItem), page: result.page };
}

export async function countIncidents(tenant: Tenant): Promise<IncidentCounts> {
  const count = (view: InboxView) =>
    prisma.incident.count({ where: { AND: [incidentScope(tenant), viewWhere(view)] } });
  const [attention, unassigned, inProgress, review, open, closed] = await Promise.all([
    count('attention'),
    count('unassigned'),
    count('in-progress'),
    count('review'),
    count('open'),
    count('closed'),
  ]);
  return { attention, unassigned, inProgress, review, open, closed };
}

/** Cross-organization My work: live assignments of every active membership of this person. */
export async function listMyWork(userId: string): Promise<IncidentListItem[]> {
  // Deliberately not tenant-scoped: the person's own memberships are the scope.
  const rows = await prisma.incident.findMany({
    where: {
      status: { in: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] },
      organization: { status: 'ACTIVE' },
      assignments: { some: { status: { in: liveStatuses }, intervenant: { userId, status: 'ACTIVE' } } },
    },
    // Enums sort by declaration: ASSIGNED (pending acceptance), IN_PROGRESS, RESOLVED; then most urgent first.
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: incidentListInclude,
    take: 200,
  });
  return rows.map(toListItem);
}

/* Reporting */

function yearIn(timeZone: string, at: Date): number {
  const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' })
    .formatToParts(at)
    .find((part) => part.type === 'year');
  return year ? Number(year.value) : at.getUTCFullYear();
}

export async function createIncident(tenant: Tenant, input: CreateIncidentInput): Promise<IncidentDetail> {
  if (tenant.role === 'INTERVENANT') throw forbidden('Intervenants cannot report incidents.');
  if (input.onBehalfOfMembershipId && tenant.role !== 'SUPERVISOR') {
    throw forbidden('Only a supervisor can report on behalf of an employee.');
  }

  const incidentId = await prisma.$transaction(async (tx) => {
    const onBehalfOf = input.onBehalfOfMembershipId
      ? await tx.membership.findFirst({
          where: { id: input.onBehalfOfMembershipId, organizationId: tenant.orgId, role: 'REPORTER', status: 'ACTIVE' },
          select: personSelect,
        })
      : null;
    if (input.onBehalfOfMembershipId && !onBehalfOf) {
      throw invalidField('onBehalfOfMembershipId', 'Choose an active employee of this organization.');
    }
    const site = await tx.site.findFirst({
      where: { id: input.siteId, organizationId: tenant.orgId },
      select: { isActive: true },
    });
    if (!site?.isActive) throw invalidField('siteId', 'This site no longer accepts reports. Choose another site.');
    const category = await activeCategory(tx, tenant, input.categoryId);
    const reportedPriority = input.reportedPriority ?? category.defaultPriority;

    // Per organization and year, in the organization's time zone (F-INC-02). The upsert locks the counter row.
    const year = yearIn(tenant.org.timezone, new Date());
    const [counter] = await tx.$queryRaw<{ value: number }[]>`
      INSERT INTO "OrganizationCounter" ("organizationId", "name", "value")
      VALUES (${tenant.orgId}::uuid, ${`incident:${year}`}, 1)
      ON CONFLICT ("organizationId", "name") DO UPDATE SET "value" = "OrganizationCounter"."value" + 1
      RETURNING "value"`;
    if (!counter) throw new Error('The incident counter returned no row');

    const incident = await tx.incident.create({
      data: {
        organizationId: tenant.orgId,
        reference: formatReference(year, counter.value),
        siteId: input.siteId,
        reporterMembershipId: onBehalfOf?.id ?? tenant.membershipId,
        createdByMembershipId: tenant.membershipId,
        title: input.title,
        description: input.description,
        reportedCategoryId: category.id,
        reportedPriority,
        locationDetail: input.locationDetail ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        categoryId: category.id,
        priority: reportedPriority,
      },
    });
    await recordIncidentEvent(tx, tenant, incident.id, 'INCIDENT_CREATED', {
      onBehalfOf: onBehalfOf ? personRef(onBehalfOf) : null,
    });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'INCIDENT_CREATED',
      recipients: await activeSupervisorIds(tx, tenant.orgId),
      dedupe: incident.version,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

/* Case file */

export async function getIncident(tenant: Tenant, key: string): Promise<IncidentDetail> {
  const incident = await findVisibleIncident(tenant, key);
  return loadDetail(tenant, incident.id);
}

const threadTypes: readonly string[] = threadEventTypes;
const threadRank = new Map<string, number>(threadEventTypes.map((type, index) => [type, index]));

function isThreadEventType(type: string): type is ThreadEventType {
  return threadTypes.includes(type);
}

type ThreadRow = Prisma.AuditEventGetPayload<{ include: { actorMembership: { select: typeof personSelect } } }>;

function redact<E extends ThreadEvent>(event: E, viewer: ThreadViewer): E {
  return { ...event, payload: redactThreadPayload(event.type, event.payload, viewer) };
}

function toThreadEvent(row: ThreadRow, viewer: ThreadViewer): ThreadEvent | null {
  if (!isThreadEventType(row.type)) return null;
  if (!isThreadEventVisible({ type: row.type, createdAt: row.createdAt, payload: row.payload }, viewer)) return null;
  // Payloads are written only through recordIncidentEvent, which types them per event type.
  const event = {
    id: row.id,
    type: row.type,
    actor: row.actorMembership ? personRef(row.actorMembership) : null,
    createdAt: row.createdAt.toISOString(),
    payload: row.payload,
  } as ThreadEvent;
  return redact(event, viewer);
}

export async function getThread(tenant: Tenant, key: string): Promise<ThreadEvent[]> {
  const incident = await findVisibleIncident(tenant, key);
  const viewer = await threadViewerFor(tenant, incident.id);
  const rows = await prisma.auditEvent.findMany({
    where: { organizationId: tenant.orgId, incidentId: incident.id, type: { in: [...threadEventTypes] } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actorMembership: { select: personSelect } },
  });
  // Events written by one request can share a timestamp (TRIAGED then ASSIGNED): break ties by lifecycle order.
  rows.sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || (threadRank.get(a.type) ?? 0) - (threadRank.get(b.type) ?? 0),
  );
  return rows.flatMap((row) => {
    const event = toThreadEvent(row, viewer);
    return event ? [event] : [];
  });
}

export async function listCandidates(tenant: Tenant, key: string): Promise<CandidateDTO[]> {
  const incident = await findVisibleIncident(tenant, key);
  const [category, live] = await Promise.all([
    prisma.incidentCategory.findFirst({
      where: { id: incident.categoryId, organizationId: tenant.orgId },
      select: { specialtyId: true },
    }),
    findLiveAssignment(prisma, tenant, incident.id),
  ]);
  const members = await prisma.membership.findMany({
    where: {
      organizationId: tenant.orgId,
      role: 'INTERVENANT',
      status: { in: ['ACTIVE', 'SUSPENDED'] },
      ...(live ? { id: { not: live.intervenantMembershipId } } : {}),
    },
    select: {
      id: true,
      status: true,
      user: { select: { firstName: true, lastName: true, status: true } },
      intervenantProfile: { select: { companyName: true, availability: true } },
      specialties: { select: { specialty: { select: { id: true, name: true } } } },
      siteAccesses: { select: { siteId: true } },
    },
  });
  const ids = members.map((m) => m.id);
  const [openCounts, latest] = await Promise.all([
    liveAssignmentCounts(tenant.orgId, ids),
    prisma.assignment.groupBy({
      by: ['intervenantMembershipId'],
      where: { organizationId: tenant.orgId, intervenantMembershipId: { in: ids } },
      _max: { assignedAt: true },
    }),
  ]);
  const lastAssignedAt = new Map(
    latest.map((row) => [row.intervenantMembershipId, row._max.assignedAt?.getTime() ?? null]),
  );

  const ranked = rankCandidates(
    members.map((m) => {
      const specialties = m.specialties.map((s) => s.specialty).sort((a, b) => a.name.localeCompare(b.name));
      return {
        membershipId: m.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        companyName: m.intervenantProfile?.companyName ?? null,
        specialtyNames: specialties.map((s) => s.name),
        active: m.status === 'ACTIVE' && m.user.status === 'ACTIVE',
        specialtyIds: specialties.map((s) => s.id),
        availability: m.intervenantProfile?.availability ?? 'AVAILABLE',
        openAssignments: openCounts.get(m.id) ?? 0,
        lastAssignedAt: lastAssignedAt.get(m.id) ?? null,
        siteIds: m.siteAccesses.map((a) => a.siteId),
      };
    }),
    { siteId: incident.siteId, specialtyId: category?.specialtyId ?? null },
  );
  return ranked.map(({ candidate, ...fit }) => ({
    membershipId: candidate.membershipId,
    name: candidate.name,
    companyName: candidate.companyName,
    specialties: candidate.specialtyNames,
    availability: candidate.availability,
    openAssignments: candidate.openAssignments,
    specialtyMatch: fit.specialtyMatch,
    siteAccess: fit.siteAccess,
    eligible: fit.eligible,
    reason: fit.reason,
    warning: fit.warning,
  }));
}

/* Supervisor transitions */

const TRIAGEABLE: readonly IncidentStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS'];

export async function triageIncident(tenant: Tenant, key: string, input: TriageInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    if (!TRIAGEABLE.includes(incident.status)) {
      throw invalidTransition(
        incident.status === 'CLOSED' ? CLOSED_READ_ONLY : 'Only new, assigned or in progress incidents can be triaged.',
      );
    }
    const category = await triageCategory(tx, tenant, incident, input.categoryId);
    await writeIncident(tx, tenant, incident.id, input.expectedVersion, {
      priority: input.priority,
      triagedAt: incident.triagedAt ?? new Date(),
    });
    await applyTriage(tx, tenant, incident, input.priority, category);
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function assignIncident(tenant: Tenant, key: string, input: AssignInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    const status = transitionTo(
      incident.status,
      incident.status === 'NEW' ? 'assign' : 'reassign',
      'Only new, assigned or in progress incidents can be assigned.',
    );
    const previous = await findLiveAssignment(tx, tenant, incident.id);
    if (previous?.intervenantMembershipId === input.intervenantMembershipId) {
      throw conflict('This intervenant already holds this incident. Choose someone else.');
    }

    const target = await tx.membership.findFirst({
      where: { id: input.intervenantMembershipId, organizationId: tenant.orgId, role: 'INTERVENANT' },
      select: {
        id: true,
        status: true,
        user: { select: { firstName: true, lastName: true, status: true } },
        siteAccesses: { where: { siteId: incident.siteId }, select: { siteId: true } },
      },
    });
    if (!target) throw invalidField('intervenantMembershipId', 'Choose an intervenant of this organization.');
    // A suspended account cannot sign in to see the work (I13), so it counts as inactive too.
    if (target.status !== 'ACTIVE' || target.user.status !== 'ACTIVE') {
      throw invalidField('intervenantMembershipId', 'This intervenant is not active.');
    }
    if (target.siteAccesses.length === 0) {
      throw invalidField(
        'intervenantMembershipId',
        'This intervenant has no access to this site. Give them access in Team, or choose someone else.',
      );
    }
    const category = input.categoryId ? await triageCategory(tx, tenant, incident, input.categoryId) : null;
    const priority = input.priority ?? incident.priority;

    const now = new Date();
    const version = input.expectedVersion + 1;
    await writeIncident(tx, tenant, incident.id, input.expectedVersion, {
      status,
      priority,
      firstAssignedAt: incident.firstAssignedAt ?? now,
      triagedAt: incident.triagedAt ?? now,
      declinedAt: null,
    });
    await applyTriage(tx, tenant, incident, priority, category);
    if (previous) {
      await moveAssignment(
        tx,
        tenant,
        previous.id,
        [previous.status],
        { status: 'SUPERSEDED', endedAt: now },
        'This incident changed while you were assigning it. Reload and try again.',
      );
    }
    await tx.assignment.create({
      data: {
        organizationId: tenant.orgId,
        incidentId: incident.id,
        intervenantMembershipId: target.id,
        assignedByMembershipId: tenant.membershipId,
        note: input.note ?? null,
        assignedAt: now,
      },
    });
    await recordIncidentEvent(tx, tenant, incident.id, 'ASSIGNED', {
      assignee: personRef(target),
      previous: previous ? personRef(previous.intervenant) : null,
      note: input.note ?? null,
    });

    const notice = noticeFrom(tenant, incident.id);
    await notify(tx, { ...notice, type: 'ASSIGNED', recipients: [target.id], dedupe: version });
    if (incident.firstAssignedAt === null) {
      await notify(tx, {
        ...notice,
        type: 'ASSIGNED_REPORTER',
        recipients: [incident.reporterMembershipId],
        dedupe: version,
      });
    }
    if (previous) {
      await notify(tx, {
        ...notice,
        type: 'UNASSIGNED',
        recipients: [previous.intervenantMembershipId],
        dedupe: version,
      });
    }
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function unassignIncident(tenant: Tenant, key: string, input: UnassignInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    const status = transitionTo(
      incident.status,
      'unassign',
      'Only assigned or in progress incidents can be unassigned.',
    );
    const previous = await findLiveAssignment(tx, tenant, incident.id);
    if (!previous) throw invalidTransition('This incident has no intervenant to remove.');

    const now = new Date();
    await writeIncident(tx, tenant, incident.id, input.expectedVersion, { status });
    await moveAssignment(
      tx,
      tenant,
      previous.id,
      [previous.status],
      { status: 'SUPERSEDED', endedAt: now },
      'This incident changed while you were unassigning it. Reload and try again.',
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'UNASSIGNED', {
      previous: personRef(previous.intervenant),
      reason: input.reason ?? null,
    });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'UNASSIGNED',
      recipients: [previous.intervenantMembershipId],
      dedupe: input.expectedVersion + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function closeIncident(tenant: Tenant, key: string, input: CloseInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    const status = transitionTo(incident.status, 'close', 'Only resolved incidents can be closed.');
    const live = await findLiveAssignment(tx, tenant, incident.id);

    const now = new Date();
    // The invariant trigger rejects any later update of a closed incident: this stays its only write.
    await writeIncident(tx, tenant, incident.id, input.expectedVersion, { status, closedAt: now });
    if (live) {
      await moveAssignment(
        tx,
        tenant,
        live.id,
        [live.status],
        { status: 'COMPLETED', endedAt: now },
        'This incident changed while you were closing it. Reload and try again.',
      );
    }
    await recordIncidentEvent(tx, tenant, incident.id, 'CLOSED', {});
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'CLOSED',
      recipients: [incident.reporterMembershipId, live?.intervenantMembershipId],
      dedupe: input.expectedVersion + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function sendBackIncident(tenant: Tenant, key: string, input: SendBackInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    const status = transitionTo(incident.status, 'send-back', 'Only resolved incidents can be sent back.');
    const live = await findLiveAssignment(tx, tenant, incident.id);

    await writeIncident(tx, tenant, incident.id, input.expectedVersion, { status, sentBackAt: new Date() });
    await recordIncidentEvent(tx, tenant, incident.id, 'SENT_BACK', { reason: input.reason });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'SENT_BACK',
      recipients: [live?.intervenantMembershipId],
      dedupe: input.expectedVersion + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function dismissIncident(tenant: Tenant, key: string, input: DismissInput): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const incident = await findVisibleIncident(tenant, key, tx);
    assertVersion(incident, input.expectedVersion);
    const status = transitionTo(incident.status, 'dismiss', 'Only new incidents can be dismissed.');

    // The only write to the incident row: once closed, the invariant trigger rejects updates.
    await writeIncident(tx, tenant, incident.id, input.expectedVersion, {
      status,
      dismissReason: input.reason,
      dismissNote: input.note ?? null,
      closedAt: new Date(),
    });
    await recordIncidentEvent(tx, tenant, incident.id, 'DISMISSED', { reason: input.reason, note: input.note ?? null });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'CLOSED',
      recipients: [incident.reporterMembershipId],
      dedupe: input.expectedVersion + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function addComment(tenant: Tenant, key: string, input: CommentInput): Promise<ThreadEvent> {
  return prisma.$transaction(async (tx): Promise<ThreadEvent> => {
    const incident = await findVisibleIncident(tenant, key, tx);
    if (incident.status === 'CLOSED') throw invalidTransition(CLOSED_READ_ONLY);
    const live = await findLiveAssignment(tx, tenant, incident.id);
    const actions = incidentActions(
      { role: tenant.role, membershipId: tenant.membershipId },
      {
        status: incident.status,
        reporterMembershipId: incident.reporterMembershipId,
        liveAssignment: live ? { intervenantMembershipId: live.intervenantMembershipId, status: live.status } : null,
      },
    );
    if (input.visibility === 'PUBLIC' && !actions.includes('comment-public')) {
      throw forbidden('Only the people working on this incident can comment on it.');
    }
    if (input.visibility === 'INTERNAL' && !actions.includes('comment-internal')) {
      throw forbidden('Internal comments are for supervisors and the assigned intervenant.');
    }

    // Touches updatedAt without a version bump. Taking the row lock first keeps a concurrent close out.
    const { count } = await tx.incident.updateMany({
      where: { id: incident.id, organizationId: tenant.orgId, status: { not: 'CLOSED' } },
      data: { updatedAt: new Date() },
    });
    if (count === 0) throw invalidTransition(CLOSED_READ_ONLY);

    const comment = await tx.comment.create({
      data: {
        organizationId: tenant.orgId,
        incidentId: incident.id,
        authorMembershipId: tenant.membershipId,
        visibility: input.visibility,
        body: input.body,
      },
    });
    const event = await recordIncidentEvent(tx, tenant, incident.id, 'COMMENT_ADDED', {
      visibility: input.visibility,
      body: input.body,
    });

    const supervisors = await activeSupervisorIds(tx, tenant.orgId);
    const assignee = live?.intervenantMembershipId;
    const isSupervisor = tenant.role === 'SUPERVISOR';
    const recipients =
      input.visibility === 'PUBLIC'
        ? [incident.reporterMembershipId, assignee, ...(isSupervisor ? [] : supervisors)]
        : isSupervisor
          ? [assignee]
          : tenant.role === 'INTERVENANT'
            ? supervisors
            : [];
    await notify(tx, { ...noticeFrom(tenant, incident.id), type: 'COMMENT_ADDED', recipients, dedupe: comment.id });

    return {
      id: event.id,
      type: 'COMMENT_ADDED',
      actor: { membershipId: tenant.membershipId, name: tenant.name },
      createdAt: event.createdAt.toISOString(),
      payload: { visibility: input.visibility, body: input.body },
    };
  });
}

/* Intervenant transitions */

/** The caller's own assignment and its incident, read inside the transaction. Anything else is 404. */
async function ownAssignment(tx: Tx, tenant: Tenant, assignmentId: string) {
  const assignment = await tx.assignment.findFirst({
    where: { id: assignmentId, organizationId: tenant.orgId, intervenantMembershipId: tenant.membershipId },
  });
  if (!assignment) throw notFound('Assignment');
  const incident = await tx.incident.findFirst({ where: { id: assignment.incidentId, organizationId: tenant.orgId } });
  if (!incident) throw notFound('Incident');
  return { assignment, incident };
}

const WORKING: AssignmentStatus[] = ['ACCEPTED', 'REASSIGNMENT_REQUESTED'];

function assertWorking(status: AssignmentStatus) {
  if (WORKING.includes(status)) return;
  throw invalidTransition(
    status === 'PENDING_ACCEPTANCE'
      ? 'Accept this assignment first.'
      : 'This assignment has ended. It may have been reassigned.',
  );
}

export async function acceptAssignment(tenant: Tenant, assignmentId: string): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const { assignment, incident } = await ownAssignment(tx, tenant, assignmentId);
    if (assignment.status !== 'PENDING_ACCEPTANCE') throw invalidTransition(NO_LONGER_PENDING);
    const status = transitionTo(incident.status, 'accept', NO_LONGER_PENDING);

    const now = new Date();
    await writeIncident(tx, tenant, incident.id, incident.version, { status, startedAt: incident.startedAt ?? now });
    await moveAssignment(
      tx,
      tenant,
      assignment.id,
      ['PENDING_ACCEPTANCE'],
      { status: 'ACCEPTED', respondedAt: now },
      NO_LONGER_PENDING,
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'ASSIGNMENT_ACCEPTED', {});
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'ACCEPTED',
      recipients: [...(await activeSupervisorIds(tx, tenant.orgId)), incident.reporterMembershipId],
      dedupe: incident.version + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function declineAssignment(
  tenant: Tenant,
  assignmentId: string,
  input: DeclineInput,
): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const { assignment, incident } = await ownAssignment(tx, tenant, assignmentId);
    if (assignment.status !== 'PENDING_ACCEPTANCE') throw invalidTransition(NO_LONGER_PENDING);
    const status = transitionTo(incident.status, 'decline', NO_LONGER_PENDING);

    const now = new Date();
    await writeIncident(tx, tenant, incident.id, incident.version, { status, declinedAt: now });
    await moveAssignment(
      tx,
      tenant,
      assignment.id,
      ['PENDING_ACCEPTANCE'],
      { status: 'DECLINED', declineReason: input.reason, respondedAt: now, endedAt: now },
      NO_LONGER_PENDING,
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'ASSIGNMENT_DECLINED', { reason: input.reason });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'DECLINED',
      recipients: await activeSupervisorIds(tx, tenant.orgId),
      dedupe: incident.version + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function requestReassignment(
  tenant: Tenant,
  assignmentId: string,
  input: RequestReassignmentInput,
): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const { assignment, incident } = await ownAssignment(tx, tenant, assignmentId);
    if (assignment.status === 'REASSIGNMENT_REQUESTED') {
      throw invalidTransition('You already asked for reassignment. A supervisor will review it.');
    }
    assertWorking(assignment.status);
    if (incident.status !== 'IN_PROGRESS') {
      throw invalidTransition('You can ask for reassignment only while the incident is in progress.');
    }

    // No incident field changes, but the bump tells other viewers the case file moved.
    await writeIncident(tx, tenant, incident.id, incident.version, {});
    await moveAssignment(
      tx,
      tenant,
      assignment.id,
      ['ACCEPTED'],
      {
        status: 'REASSIGNMENT_REQUESTED',
        reassignmentReason: input.reasonCode,
        reassignmentNote: input.note ?? null,
        reassignmentRequestedAt: new Date(),
      },
      'This assignment changed in the meantime. Reload and try again.',
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'REASSIGNMENT_REQUESTED', {
      reasonCode: input.reasonCode,
      note: input.note ?? null,
    });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'REASSIGNMENT_REQUESTED',
      recipients: await activeSupervisorIds(tx, tenant.orgId),
      dedupe: incident.version + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function postProgress(
  tenant: Tenant,
  assignmentId: string,
  input: ProgressInput,
): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const { assignment, incident } = await ownAssignment(tx, tenant, assignmentId);
    assertWorking(assignment.status);
    const notInProgress = 'Progress can be posted only while the incident is in progress.';
    if (incident.status !== 'IN_PROGRESS') throw invalidTransition(notInProgress);

    // Touches updatedAt without a version bump, under the row lock so a concurrent resolve is seen.
    const { count } = await tx.incident.updateMany({
      where: { id: incident.id, organizationId: tenant.orgId, status: 'IN_PROGRESS' },
      data: { updatedAt: new Date() },
    });
    if (count === 0) throw invalidTransition(notInProgress);

    const progress = await tx.progressUpdate.create({
      data: {
        organizationId: tenant.orgId,
        incidentId: incident.id,
        assignmentId: assignment.id,
        authorMembershipId: tenant.membershipId,
        type: input.progressType,
        note: input.note,
      },
    });
    await recordIncidentEvent(tx, tenant, incident.id, 'PROGRESS_POSTED', {
      progressType: input.progressType,
      note: input.note,
    });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'PROGRESS_POSTED',
      recipients: await activeSupervisorIds(tx, tenant.orgId),
      dedupe: progress.id,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

export async function resolveAssignment(
  tenant: Tenant,
  assignmentId: string,
  input: ResolveInput,
): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const { assignment, incident } = await ownAssignment(tx, tenant, assignmentId);
    assertWorking(assignment.status);
    const status = transitionTo(incident.status, 'resolve', 'Only incidents in progress can be resolved.');

    if (tenant.org.requireResolutionPhoto) {
      const evidence = await tx.attachment.count({
        where: {
          organizationId: tenant.orgId,
          incidentId: incident.id,
          kind: 'EVIDENCE',
          uploadedByMembershipId: tenant.membershipId,
          createdAt: { gte: assignment.assignedAt },
        },
      });
      if (evidence === 0) throw new AppError('VALIDATION_FAILED', 'Add a photo of the finished work before resolving.');
    }

    await writeIncident(tx, tenant, incident.id, incident.version, {
      status,
      resolutionNote: input.note,
      resolvedAt: incident.resolvedAt ?? new Date(),
      sentBackAt: null,
    });
    // A pending reassignment request is moot once the work is done.
    await moveAssignment(
      tx,
      tenant,
      assignment.id,
      WORKING,
      { status: 'ACCEPTED' },
      'This assignment has ended. It may have been reassigned.',
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'RESOLVED', { note: input.note });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'RESOLVED',
      recipients: [...(await activeSupervisorIds(tx, tenant.orgId)), incident.reporterMembershipId],
      dedupe: incident.version + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}

/* Reassignment requests (supervisor queue) */

export async function listReassignmentRequests(tenant: Tenant): Promise<ReassignmentRequestDTO[]> {
  const rows = await prisma.assignment.findMany({
    where: { organizationId: tenant.orgId, status: 'REASSIGNMENT_REQUESTED' },
    orderBy: [{ reassignmentRequestedAt: 'asc' }, { id: 'asc' }],
    include: {
      incident: {
        select: {
          id: true,
          reference: true,
          title: true,
          priority: true,
          version: true,
          site: { select: { name: true } },
        },
      },
      intervenant: { select: personSelect },
    },
  });
  return rows.flatMap((row) =>
    row.reassignmentReason && row.reassignmentRequestedAt
      ? [
          {
            assignmentId: row.id,
            incident: {
              id: row.incident.id,
              reference: row.incident.reference,
              title: row.incident.title,
              priority: row.incident.priority,
              site: row.incident.site.name,
              version: row.incident.version,
            },
            intervenant: personRef(row.intervenant),
            reasonCode: row.reassignmentReason,
            note: row.reassignmentNote,
            requestedAt: row.reassignmentRequestedAt.toISOString(),
          },
        ]
      : [],
  );
}

/** Keeps the intervenant on the job. Approving a request is a reassign through assignIncident. */
export async function rejectReassignment(
  tenant: Tenant,
  assignmentId: string,
  input: RejectReassignmentInput,
): Promise<IncidentDetail> {
  const incidentId = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findFirst({
      where: { id: assignmentId, organizationId: tenant.orgId },
      include: { intervenant: { select: personSelect } },
    });
    if (!assignment) throw notFound('Reassignment request');
    if (assignment.status !== 'REASSIGNMENT_REQUESTED') throw invalidTransition(REQUEST_NOT_PENDING);
    const incident = await tx.incident.findFirst({
      where: { id: assignment.incidentId, organizationId: tenant.orgId },
    });
    if (!incident) throw notFound('Incident');

    await writeIncident(tx, tenant, incident.id, incident.version, {});
    await moveAssignment(
      tx,
      tenant,
      assignment.id,
      ['REASSIGNMENT_REQUESTED'],
      { status: 'ACCEPTED' },
      REQUEST_NOT_PENDING,
    );
    await recordIncidentEvent(tx, tenant, incident.id, 'REASSIGNMENT_REJECTED', {
      note: input.note ?? null,
      assignee: personRef(assignment.intervenant),
    });
    await notify(tx, {
      ...noticeFrom(tenant, incident.id),
      type: 'REASSIGNMENT_REJECTED',
      recipients: [assignment.intervenantMembershipId],
      dedupe: incident.version + 1,
    });
    return incident.id;
  });
  return loadDetail(tenant, incidentId);
}
