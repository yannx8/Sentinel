import type { Prisma } from '@prisma/client';
import { cursorQuery, type NotificationDTO } from '@sentinel/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { tenantOf } from '../auth/context';
import { prisma } from '../lib/prisma';
import { decodeCursor, page } from '../http/cursor';
import { notFound } from '../http/errors';
import { parse, parseId } from '../http/validate';

export const notificationQuery = cursorQuery.extend({ unread: z.enum(['true', 'false']).optional() });
export type Recipient = { id: string; organizationId: string };

/** Only ever called with the caller's own memberships: one on tenant routes, all of them on /me. */
function addressedTo(recipients: Recipient[]): Prisma.NotificationWhereInput {
  return {
    organizationId: { in: recipients.map((r) => r.organizationId) },
    recipientMembershipId: { in: recipients.map((r) => r.id) },
  };
}

export async function listNotifications(
  recipients: Recipient[],
  { cursor, limit, unread }: z.infer<typeof notificationQuery>,
) {
  const after = decodeCursor(cursor);
  const rows = await prisma.notification.findMany({
    where: {
      ...addressedTo(recipients),
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
  return { data, page: result.page };
}

export function unreadCount(recipients: Recipient[]) {
  return prisma.notification.count({ where: { ...addressedTo(recipients), readAt: null } });
}

export function markAllRead(recipients: Recipient[]) {
  return prisma.notification.updateMany({
    where: { ...addressedTo(recipients), readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markRead(recipients: Recipient[], id: string) {
  const { count } = await prisma.notification.updateMany({
    where: { ...addressedTo(recipients), id },
    data: { readAt: new Date() },
  });
  if (count === 0) throw notFound('Notification');
}

/** Always scoped to the caller's own membership in the active organization. */
export const notificationRoutes = Router();

function own(req: Request): Recipient[] {
  const tenant = tenantOf(req);
  return [{ id: tenant.membershipId, organizationId: tenant.orgId }];
}

notificationRoutes.get('/', async (req, res) => {
  res.json(await listNotifications(own(req), parse(notificationQuery, req.query)));
});

notificationRoutes.get('/unread-count', async (req, res) => {
  res.json({ data: { count: await unreadCount(own(req)) } });
});

notificationRoutes.post('/read-all', async (req, res) => {
  await markAllRead(own(req));
  res.status(204).end();
});

notificationRoutes.post('/:id/read', async (req, res) => {
  await markRead(own(req), parseId(req.params.id, 'Notification'));
  res.status(204).end();
});
