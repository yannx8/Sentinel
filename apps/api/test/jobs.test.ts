import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enqueue, startJobs, stopJobs } from '../src/jobs/boss';
import { pool } from '../src/lib/db';
import { prisma } from './helpers';

/* Jobs enqueue inside the caller's transaction: a rollback leaves no job behind. */

beforeAll(async () => {
  await startJobs({ work: false });
  await pool.query('delete from pgboss.job');
});
afterAll(() => stopJobs());

const count = async (queue: string) =>
  Number((await pool.query('select count(*) from pgboss.job where name = $1', [queue])).rows[0].count);

describe('enqueue', () => {
  it('leaves no job when the transaction rolls back', async () => {
    await prisma
      .$transaction(async (tx) => {
        await enqueue(tx, 'email.send', { to: 'a@example.com' });
        throw new Error('rollback');
      })
      .catch(() => undefined);
    expect(await count('email.send')).toBe(0);

    await prisma.$transaction((tx) => enqueue(tx, 'email.send', { to: 'a@example.com' }));
    expect(await count('email.send')).toBe(1);
  });
});
