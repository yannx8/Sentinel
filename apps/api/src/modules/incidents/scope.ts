/**
 * Incident policy: which incidents a tenant member may see, how the Thread is
 * filtered for them, and the version-checked write every transition goes through.
 * Services never build incident scope ad hoc (docs/PRD.md 5.5).
 */
import type { Prisma } from '@prisma/client';
import { liveAssignmentStatuses, referencePattern, type ThreadViewer } from '@sentinel/shared';
import type { Tenant } from '../../auth/context';
import { prisma, type Tx } from '../../lib/prisma';
import { notFound, staleVersion } from '../../http/errors';

const live = [...liveAssignmentStatuses];

/** Prisma filter for the incidents this member may read (5.2 "Read incident"). */
export function incidentScope(tenant: Tenant): Prisma.IncidentWhereInput {
  switch (tenant.role) {
    case 'SUPERVISOR':
      return { organizationId: tenant.orgId };
    case 'INTERVENANT':
      // Current and past assignees. A declined offer never grants access.
      return {
        organizationId: tenant.orgId,
        assignments: { some: { intervenantMembershipId: tenant.membershipId, status: { not: 'DECLINED' } } },
      };
    case 'REPORTER':
      return { organizationId: tenant.orgId, reporterMembershipId: tenant.membershipId };
  }
}

/** Accepts a uuid or a reference such as INC-2026-00042. */
export function incidentKey(idOrReference: string): Prisma.IncidentWhereInput {
  if (referencePattern.test(idOrReference)) return { reference: idOrReference };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference))
    return { id: idOrReference };
  return { id: '00000000-0000-0000-0000-000000000000' };
}

/** The incident if this member may see it, otherwise 404 (same answer as a missing id). */
export async function findVisibleIncident(tenant: Tenant, idOrReference: string, db: Tx | typeof prisma = prisma) {
  const incident = await db.incident.findFirst({ where: { AND: [incidentScope(tenant), incidentKey(idOrReference)] } });
  if (!incident) throw notFound('Incident');
  return incident;
}

/** How the Thread is filtered for this member (5.3). */
export async function threadViewerFor(tenant: Tenant, incidentId: string): Promise<ThreadViewer> {
  if (tenant.role === 'SUPERVISOR') return { role: 'SUPERVISOR' };
  if (tenant.role === 'REPORTER') return { role: 'REPORTER' };
  const assignments = await prisma.assignment.findMany({
    where: { organizationId: tenant.orgId, incidentId, intervenantMembershipId: tenant.membershipId },
    select: { status: true, endedAt: true },
  });
  const liveAssignee = assignments.some((a) => live.includes(a.status as (typeof live)[number]));
  if (liveAssignee) return { role: 'INTERVENANT', liveAssignee: true, accessEndsAt: null };
  const ends = assignments.map((a) => a.endedAt?.getTime() ?? 0);
  return { role: 'INTERVENANT', liveAssignee: false, accessEndsAt: new Date(Math.max(0, ...ends)) };
}

/**
 * Optimistic concurrency (6.8): applies the change only if the incident is still
 * at `expectedVersion`, and bumps the version. Otherwise 409 with the current state.
 */
export async function writeIncident(
  tx: Tx,
  tenant: Tenant,
  incidentId: string,
  expectedVersion: number,
  data: Prisma.IncidentUpdateManyMutationInput,
) {
  const { count } = await tx.incident.updateMany({
    where: { id: incidentId, organizationId: tenant.orgId, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (count === 1) return;
  const current = await tx.incident.findFirst({
    where: { id: incidentId, organizationId: tenant.orgId },
    select: { version: true, status: true, updatedAt: true },
  });
  if (!current) throw notFound('Incident');
  throw staleVersion({ version: current.version, status: current.status, updatedAt: current.updatedAt.toISOString() });
}

/**
 * Returns an intervenant's open work to the inbox when they are suspended or
 * revoked (6.3 Members). Incidents go back to NEW and the assignments are
 * superseded, never deleted. Resolved incidents keep their assignment until close.
 */
export async function releaseLiveAssignments(
  tx: Tx,
  tenant: Tenant,
  intervenantMembershipId: string,
  reason: 'MEMBER_SUSPENDED' | 'MEMBER_REVOKED',
): Promise<number> {
  const assignments = await tx.assignment.findMany({
    where: {
      organizationId: tenant.orgId,
      intervenantMembershipId,
      status: { in: live },
      incident: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    },
    include: { intervenant: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const now = new Date();
  for (const assignment of assignments) {
    await tx.assignment.update({ where: { id: assignment.id }, data: { status: 'SUPERSEDED', endedAt: now } });
    await tx.incident.update({
      where: { id: assignment.incidentId },
      data: { status: 'NEW', version: { increment: 1 } },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: tenant.orgId,
        incidentId: assignment.incidentId,
        actorMembershipId: tenant.membershipId,
        actorUserId: tenant.userId,
        type: 'UNASSIGNED',
        payload: {
          previous: {
            membershipId: assignment.intervenantMembershipId,
            name: `${assignment.intervenant.user.firstName} ${assignment.intervenant.user.lastName}`,
          },
          reason: reason === 'MEMBER_REVOKED' ? 'Access revoked' : 'Access suspended',
        },
      },
    });
  }
  return assignments.length;
}

/** Live assignment counts per intervenant membership, for ranking, workload and member lists. */
export async function liveAssignmentCounts(orgId: string, membershipIds?: string[]) {
  const rows = await prisma.assignment.groupBy({
    by: ['intervenantMembershipId'],
    where: {
      organizationId: orgId,
      status: { in: live },
      ...(membershipIds ? { intervenantMembershipId: { in: membershipIds } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.intervenantMembershipId, r._count._all]));
}
