import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startJobs, stopJobs } from '../src/jobs/boss';
import { pool } from '../src/lib/db';
import { deliverPush, pushTransport, type PushJob } from '../src/lib/push';
import { prisma, reportIncident, resetDb, scenario } from './helpers';

/* Web Push: subscriptions belong to the signed-in person, the job is enqueued with the notification, and the payload says no more than it must. */

type Scenario = Awaited<ReturnType<typeof scenario>>;
let s: Scenario;
const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } };
const queued = async () =>
  (await pool.query("select data from pgboss.job where name = 'notify.push'")).rows.map((row) => row.data as PushJob);

beforeAll(() => startJobs({ work: false }));
afterAll(() => stopJobs());
beforeEach(async () => {
  await resetDb();
  await pool.query('delete from pgboss.job');
  s = await scenario('Acme');
});

describe('push', () => {
  it('queues a push for the subscribed supervisor when an employee reports, and keeps the payload minimal', async () => {
    expect((await s.supervisor.post('/me/push/subscriptions', subscription)).status).toBe(204);
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);

    const jobs = await queued();
    expect(jobs).toHaveLength(1);

    const sent: string[] = [];
    const original = pushTransport.send;
    pushTransport.send = async (_target, payload) => void sent.push(payload) as never;
    try {
      await deliverPush(jobs[0]!);
    } finally {
      pushTransport.send = original;
    }
    expect(JSON.parse(sent[0]!)).toEqual({ type: 'INCIDENT_CREATED', reference: created.reference, orgId: s.org.id });
  });

  it('forgets a subscription the push service no longer knows', async () => {
    await s.supervisor.post('/me/push/subscriptions', subscription);
    await reportIncident(s.reporter, s.site.id, s.category.id);
    const original = pushTransport.send;
    pushTransport.send = async () => {
      throw Object.assign(new Error('gone'), { statusCode: 410 });
    };
    try {
      await deliverPush((await queued())[0]!);
    } finally {
      pushTransport.send = original;
    }
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it('only lets a person remove their own subscription', async () => {
    await s.supervisor.post('/me/push/subscriptions', subscription);
    await s.reporter.delete('/me/push/subscriptions', { endpoint: subscription.endpoint });
    expect(await prisma.pushSubscription.count()).toBe(1);
  });
});
