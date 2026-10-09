/**
 * Web Push (V2 plan 2.5). The payload is the event type, the incident reference and the organization,
 * never names or text; the service worker words it. Delivery runs in the `notify.push` job.
 */
import webpush from 'web-push';
import { env } from '../env';
import { logger } from './logger';
import { prisma, type Tx } from './prisma';

export const pushConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

/** Replaced in tests; the real one talks to the browser vendor's push service. */
export const pushTransport = {
  send: (subscription: webpush.PushSubscription, payload: string) => {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    return webpush.sendNotification(subscription, payload, { TTL: 60 * 60 });
  },
};

export type PushJob = { subscriptionId: string; type: string; incidentId: string | null; orgId: string };

/** Delivers one push. A subscription the push service no longer knows (404, 410) is deleted. */
export async function deliverPush(job: PushJob) {
  const subscription = await prisma.pushSubscription.findUnique({ where: { id: job.subscriptionId } });
  if (!subscription) return;
  const incident = job.incidentId
    ? await prisma.incident.findUnique({ where: { id: job.incidentId }, select: { reference: true } })
    : null;
  try {
    await pushTransport.send(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ type: job.type, reference: incident?.reference ?? null, orgId: job.orgId }),
    );
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
      return;
    }
    logger.warn({ err: error, status }, 'Push delivery failed, will retry');
    throw error;
  }
}

/** The subscriptions of the people behind these memberships. */
export async function subscriptionIdsFor(tx: Tx, membershipIds: string[]) {
  const rows = await tx.pushSubscription.findMany({
    where: { user: { memberships: { some: { id: { in: membershipIds } } } } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
