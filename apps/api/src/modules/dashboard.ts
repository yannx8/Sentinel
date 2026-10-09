import { Prisma } from '../generated/prisma/client';
import { liveAssignmentStatuses, priorities, type AgeingBucket, type DashboardDTO } from '@sentinel/shared';
import { Router } from 'express';
import { requireRole, tenantOf } from '../auth/context';
import { prisma } from '../lib/prisma';

export const dashboardRoutes = Router();
dashboardRoutes.use(requireRole('SUPERVISOR'));

const live = [...liveAssignmentStatuses];
const HOUR = 3_600_000;

const bucketOf = (ageMs: number): AgeingBucket =>
  ageMs < 4 * HOUR ? 'UNDER_4H' : ageMs < 24 * HOUR ? 'H4_TO_24H' : ageMs < 72 * HOUR ? 'D1_TO_3D' : 'OVER_3D';

dashboardRoutes.get('/', async (req, res) => {
  const { orgId, org } = tenantOf(req);
  const now = Date.now();
  const open = { organizationId: orgId, status: { not: 'CLOSED' as const } };

  const [openRows, sites, categories, workloadRows, liveCounts, medianRows, trendRows] = await Promise.all([
    prisma.incident.findMany({
      where: open,
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        siteId: true,
        categoryId: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.site.findMany({ where: { organizationId: orgId, isActive: true }, select: { id: true, name: true } }),
    prisma.incidentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.membership.findMany({
      where: { organizationId: orgId, role: 'INTERVENANT', status: 'ACTIVE' },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
        intervenantProfile: { select: { availability: true } },
      },
    }),
    prisma.assignment.findMany({
      where: { organizationId: orgId, status: { in: live } },
      select: { intervenantMembershipId: true, status: true, assignedAt: true },
    }),
    prisma.$queryRaw<{ assign: number | null; ack: number | null; resolve: number | null }[]>(Prisma.sql`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("firstAssignedAt" - "createdAt")) / 60) AS assign,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("startedAt" - "createdAt")) / 60) AS ack,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60) AS resolve
      FROM "Incident"
      WHERE "organizationId" = ${orgId}::uuid AND "createdAt" > now() - interval '30 days'`),
    prisma.$queryRaw<{ day: string; created: bigint; resolved: bigint }[]>(Prisma.sql`
      WITH days AS (
        SELECT d::date AS day
        FROM generate_series(
          (now() AT TIME ZONE ${org.timezone})::date - 29, (now() AT TIME ZONE ${org.timezone})::date, interval '1 day') AS d
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
        (SELECT count(*) FROM "Incident" i WHERE i."organizationId" = ${orgId}::uuid
           AND (i."createdAt" AT TIME ZONE ${org.timezone})::date = days.day) AS created,
        (SELECT count(*) FROM "Incident" i WHERE i."organizationId" = ${orgId}::uuid
           AND (i."resolvedAt" AT TIME ZONE ${org.timezone})::date = days.day) AS resolved
      FROM days ORDER BY days.day`),
  ]);

  const count = (predicate: (row: (typeof openRows)[number]) => boolean) => openRows.filter(predicate).length;
  const reassignmentRequests = liveCounts.filter((a) => a.status === 'REASSIGNMENT_REQUESTED').length;

  const ageing = (['UNDER_4H', 'H4_TO_24H', 'D1_TO_3D', 'OVER_3D'] as const).map((bucket) => ({
    bucket,
    count: count((row) => bucketOf(now - row.createdAt.getTime()) === bucket),
  }));

  const bySite = sites
    .map((site) => ({
      id: site.id,
      name: site.name,
      open: count((row) => row.siteId === site.id),
      critical: count((row) => row.siteId === site.id && row.priority === 'CRITICAL'),
    }))
    .filter((site) => site.open > 0)
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
    .slice(0, 10);

  const byCategory = categories
    .map((category) => ({ id: category.id, name: category.name, open: count((row) => row.categoryId === category.id) }))
    .filter((category) => category.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);

  const workload = workloadRows
    .map((member) => {
      const mine = liveCounts.filter((a) => a.intervenantMembershipId === member.id);
      const oldest = mine.reduce<Date | null>((acc, a) => (!acc || a.assignedAt < acc ? a.assignedAt : acc), null);
      return {
        membershipId: member.id,
        name: `${member.user.firstName} ${member.user.lastName}`,
        availability: member.intervenantProfile?.availability ?? 'AVAILABLE',
        live: mine.length,
        pending: mine.filter((a) => a.status === 'PENDING_ACCEPTANCE').length,
        oldestLiveAt: oldest?.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.live - a.live || a.name.localeCompare(b.name));

  const medians = medianRows[0];
  const round = (value: number | null | undefined) =>
    value === null || value === undefined ? null : Math.round(Number(value));

  const data: DashboardDTO = {
    counts: {
      open: openRows.length,
      unassigned: count((row) => row.status === 'NEW'),
      pendingAcceptance: count((row) => row.status === 'ASSIGNED'),
      inProgress: count((row) => row.status === 'IN_PROGRESS'),
      awaitingReview: count((row) => row.status === 'RESOLVED'),
      reassignmentRequests,
      criticalOpen: count((row) => row.priority === 'CRITICAL'),
    },
    medians: {
      toAssign: round(medians?.assign),
      toAcknowledge: round(medians?.ack),
      toResolve: round(medians?.resolve),
    },
    ageing,
    oldestOpen: openRows.slice(0, 5).map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    byPriority: [...priorities]
      .reverse()
      .map((priority) => ({ priority, count: count((row) => row.priority === priority) })),
    bySite,
    byCategory,
    workload,
    trend: trendRows.map((row) => ({ date: row.day, created: Number(row.created), resolved: Number(row.resolved) })),
  };
  res.json({ data });
});
