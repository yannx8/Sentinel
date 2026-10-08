import type { Session, User } from '@prisma/client';
import {
  availabilitySchema,
  listIncidentsQuery,
  updateProfileSchema,
  type Me,
  type SessionDTO,
} from '@sentinel/shared';
import { Router } from 'express';
import { activeMemberships, authOf, resolveTenant } from '../auth/context';
import { prisma } from '../lib/prisma';
import { notFound } from '../http/errors';
import { parse, parseId } from '../http/validate';
import { openStream } from './events';
import { listIncidents, listMyWork } from './incidents/service';
import { incidentScope } from './incidents/scope';
import { listNotifications, markAllRead, markRead, notificationQuery, unreadCount } from './notifications';

export async function buildMe(user: User, session: Session): Promise<Me> {
  const [memberships, admin] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE', organization: { status: { not: 'CLOSED' } } },
      include: {
        organization: {
          include: {
            memberships: {
              where: { isOwner: true, status: 'ACTIVE' },
              include: { user: { select: { firstName: true, lastName: true, email: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.platformAdmin.findUnique({ where: { userId: user.id } }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      locale: user.locale === 'fr' ? 'fr' : 'en',
    },
    memberships: memberships.map((m) => {
      const owner = m.organization.memberships[0]?.user;
      return {
        id: m.id,
        role: m.role,
        isOwner: m.isOwner,
        organization: {
          id: m.organization.id,
          displayName: m.organization.displayName,
          status: m.organization.status,
          timezone: m.organization.timezone,
          defaultLocale: m.organization.defaultLocale === 'fr' ? 'fr' : 'en',
          ownerName: owner ? `${owner.firstName} ${owner.lastName}` : null,
          ownerEmail: owner?.email ?? null,
        },
      };
    }),
    platformAdmin: admin ? { mfaVerified: session.mfaVerifiedAt !== null } : null,
  };
}

export const meRoutes = Router();

meRoutes.get('/', async (req, res) => {
  const { user, session } = authOf(req);
  res.json({ data: await buildMe(user, session) });
});

meRoutes.patch('/profile', async (req, res) => {
  const { user, session } = authOf(req);
  const input = parse(updateProfileSchema, req.body);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { firstName: input.firstName, lastName: input.lastName, phone: input.phone ?? null, locale: input.locale },
  });
  res.json({ data: await buildMe(updated, session) });
});

meRoutes.get('/sessions', async (req, res) => {
  const { user, session } = authOf(req);
  const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: 'desc' } });
  const data: SessionDTO[] = sessions.map((s) => ({
    id: s.id,
    current: s.id === session.id,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
  }));
  res.json({ data });
});

meRoutes.delete('/sessions/:id', async (req, res) => {
  const { user } = authOf(req);
  const id = parseId(req.params.id, 'Session');
  const { count } = await prisma.session.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw notFound('Session');
  res.status(204).end();
});

/** Live assignments across every organization the person serves (cross-organization My work). */
meRoutes.get('/assignments', async (req, res) => {
  const { user } = authOf(req);
  res.json({ data: await listMyWork(user.id) });
});

/* Cross-organization reads: the scope is the person's own ACTIVE memberships, never an X-Org-Id. */

meRoutes.get('/notifications', async (req, res) => {
  const recipients = await activeMemberships(authOf(req).user.id);
  res.json(await listNotifications(recipients, parse(notificationQuery, req.query)));
});

meRoutes.get('/notifications/unread-count', async (req, res) => {
  res.json({ data: { count: await unreadCount(await activeMemberships(authOf(req).user.id)) } });
});

meRoutes.post('/notifications/read-all', async (req, res) => {
  await markAllRead(await activeMemberships(authOf(req).user.id));
  res.status(204).end();
});

meRoutes.post('/notifications/:id/read', async (req, res) => {
  await markRead(await activeMemberships(authOf(req).user.id), parseId(req.params.id, 'Notification'));
  res.status(204).end();
});

/** History across organizations: the union of what each membership may read. */
meRoutes.get('/incidents', async (req, res) => {
  const { user } = authOf(req);
  const query = parse(listIncidentsQuery, req.query);
  const tenants = await Promise.all(
    (await activeMemberships(user.id)).map((m) => resolveTenant(user, m.organizationId)),
  );
  const scope = tenants.length > 0 ? { OR: tenants.map(incidentScope) } : { id: { in: [] as string[] } };
  res.json(await listIncidents(scope, query));
});

/** One availability for every organization the intervenant serves. */
meRoutes.patch('/availability', async (req, res) => {
  const { user } = authOf(req);
  const { availability } = parse(availabilitySchema, req.body);
  const intervenantIds = (await activeMemberships(user.id)).filter((m) => m.role === 'INTERVENANT').map((m) => m.id);
  // One statement, so every organization changes or none does. Profiles exist from invitation acceptance.
  await prisma.intervenantProfile.updateMany({
    where: { membershipId: { in: intervenantIds } },
    data: { availability },
  });
  res.status(204).end();
});

/** Live updates for every membership of the person (the field app). */
meRoutes.get('/events', async (req, res) => {
  const mine = new Set((await activeMemberships(authOf(req).user.id)).map((m) => m.id));
  openStream(res, authOf(req).user.id, (event) => event.recipients.some((id) => mine.has(id)));
});
