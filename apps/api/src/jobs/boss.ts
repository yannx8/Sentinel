import { PgBoss } from 'pg-boss';
import { pool } from '../lib/db';
import { logger } from '../lib/logger';
import type { Tx } from '../lib/prisma';
import { deliverPush, type PushJob } from '../lib/push';
import { purgeExpiredRegistrations } from '../modules/platform';

/** pg-boss on the shared pool; it creates its own `pgboss` schema, so Prisma migrations never see it. */
export const boss = new PgBoss({ db: { executeSql: (sql, values) => pool.query(sql, values) } });
boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));

const QUEUES = {
  'email.send': { retryLimit: 5, retryDelay: 30, retryBackoff: true },
  'purge.registrations': {},
  'sweep.attachments': {},
  // Stubs for later phases: queues exist so producers can enqueue, workers arrive with their feature.
  'notify.push': { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  'notify.whatsapp': {},
  'sla.tick': {},
  'org.export': {},
  'org.delete': {},
};
export type QueueName = keyof typeof QUEUES;

/** Enqueues in the caller's transaction: a rollback drops the job with the rest of the writes. */
export function enqueue(tx: Tx, name: QueueName, data: object) {
  return boss.send(name, data, {
    db: { executeSql: async (sql, values) => ({ rows: await tx.$queryRawUnsafe(sql, ...(values ?? [])) }) },
  });
}

export async function startJobs({ work = true } = {}) {
  await boss.start();
  for (const [name, options] of Object.entries(QUEUES)) await boss.createQueue(name, options);
  if (!work) return;
  await boss.work('purge.registrations', async () => {
    await purgeExpiredRegistrations();
  });
  await boss.schedule('purge.registrations', '0 * * * *');
  await boss.work<PushJob>('notify.push', async (jobs) => {
    for (const job of jobs) await deliverPush(job.data);
  });
}

export const stopJobs = () => boss.stop({ graceful: true });
