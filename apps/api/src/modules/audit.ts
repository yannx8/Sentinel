import type { Prisma } from '@prisma/client';
import { auditEventTypes, auditQuery, toCsv, type AuditEntryDTO, type AuditEventType } from '@sentinel/shared';
import { Router } from 'express';
import { requireRole, tenantOf } from '../auth/context';
import { prisma } from '../lib/prisma';
import { decodeCursor, page } from '../http/cursor';
import { AppError } from '../http/errors';
import { parse } from '../http/validate';
import { personRef, personSelect } from './incidents/mappers';

export const auditRoutes = Router();
auditRoutes.use(requireRole('SUPERVISOR'));

const include = {
  actorMembership: { select: personSelect },
  incident: { select: { id: true, reference: true } },
} satisfies Prisma.AuditEventInclude;

function filters(orgId: string, input: ReturnType<typeof auditQuery.parse>): Prisma.AuditEventWhereInput {
  if (input.type && !(auditEventTypes as readonly string[]).includes(input.type)) {
    throw new AppError('VALIDATION_FAILED', 'Unknown event type', { fields: { type: ['Unknown event type'] } });
  }
  return {
    organizationId: orgId,
    ...(input.type ? { type: input.type as AuditEventType } : {}),
    ...(input.incident ? { incident: { reference: input.incident.toUpperCase() } } : {}),
    ...(input.actorId ? { actorMembershipId: input.actorId } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}),
            ...(input.to ? { lt: new Date(new Date(`${input.to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
}

type Row = Prisma.AuditEventGetPayload<{ include: typeof include }>;

function toDto(row: Row): AuditEntryDTO {
  return {
    id: row.id,
    type: row.type,
    actor: row.actorMembership ? personRef(row.actorMembership) : null,
    incident: row.incident,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}

auditRoutes.get('/', async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(auditQuery, req.query);
  const after = decodeCursor(input.cursor);
  const base = filters(tenant.orgId, input);
  const rows = await prisma.auditEvent.findMany({
    where: after
      ? {
          AND: [
            base,
            {
              OR: [
                { createdAt: { lt: new Date(String(after[0])) } },
                { createdAt: new Date(String(after[0])), id: { lt: String(after[1]) } },
              ],
            },
          ],
        }
      : base,
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
  });
  const result = page(rows, input.limit, (row) => [row.createdAt.toISOString(), row.id]);
  res.json({ data: result.data.map(toDto), page: result.page });
});

auditRoutes.get('/export.csv', async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(auditQuery, req.query);
  const rows = await prisma.auditEvent.findMany({
    where: filters(tenant.orgId, input),
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 10_000,
  });
  const csv = toCsv(
    ['time', 'event', 'actor', 'incident', 'details'],
    rows.map((row) => {
      const entry = toDto(row);
      return [
        entry.createdAt,
        entry.type,
        entry.actor?.name ?? '',
        entry.incident?.reference ?? '',
        JSON.stringify(entry.payload),
      ];
    }),
  );
  res
    .type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="sentinel-audit-${new Date().toISOString().slice(0, 10)}.csv"`)
    .send(csv);
});
