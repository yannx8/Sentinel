import { cursorQuery, type NotificationDTO } from '@sentinel/shared';
import { Router } from 'express';
import { z } from 'zod';
import { tenantOf } from '../auth/context';
import { prisma } from '../lib/prisma';
import { decodeCursor, page } from '../http/cursor';
import { notFound } from '../http/errors';
import { parse, parseId } from '../http/validate';

/** Always scoped to the caller's own membership in the active organization. */
export const notificationRoutes = Router();

const query = cursorQuery.extend({ unread: z.enum(['true', 'false']).optional() });

notificationRoutes.get('/', async (req, res) => {
  const tenant = tenantOf(req);
  const { cursor, limit, unread } = parse(query, req.query);
  const after = decodeCursor(cursor);
  const rows = await prisma.notification.findMany({
    where: {
      organizationId: tenant.orgId,
      recipientMembershipId: tenant.membershipId,
      ...(unread === 'true' ? { readAt: null } : {}),
      ...(after
        ? {
            OR: [
              { createdAt: { lt: new Date(String(after[0])) } },
              { createdAt: new Date(String(after[0])), id: { lt: String(after[1]) } },
            ],
          }
        : {}),
    },
    include: {
      organization: { select: { id: true, displayName: true } },
      incident: { select: { id: true, reference: true, title: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const result = page(rows, limit, (row) => [row.createdAt.toISOString(), row.id]);
  const data: NotificationDTO[] = result.data.map((row) => ({
    id: row.id,
    type: row.type,
    organization: row.organization,
    incident: row.incident,
    actorName: row.actorName,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
  res.json({ data, page: result.page });
});

notificationRoutes.get('/unread-count', async (req, res) => {
  const tenant = tenantOf(req);
  const count = await prisma.notification.count({
    where: { organizationId: tenant.orgId, recipientMembershipId: tenant.membershipId, readAt: null },
  });
  res.json({ data: { count } });
});

notificationRoutes.post('/read-all', async (req, res) => {
  const tenant = tenantOf(req);
  await prisma.notification.updateMany({
    where: { organizationId: tenant.orgId, recipientMembershipId: tenant.membershipId, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

notificationRoutes.post('/:id/read', async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Notification');
  const { count } = await prisma.notification.updateMany({
    where: { id, organizationId: tenant.orgId, recipientMembershipId: tenant.membershipId },
    data: { readAt: new Date() },
  });
  if (count === 0) throw notFound('Notification');
  res.status(204).end();
});
