import { describe, expect, it } from 'vitest';
import { createQueue, type QueueItem, type QueueStore } from './offline-queue';

function memoryStore(): QueueStore {
  const items = new Map<string, QueueItem>();
  return {
    list: async (userId) => [...items.values()].filter((item) => item.userId === userId).map((item) => ({ ...item })),
    put: async (item) => void items.set(item.id, { ...item }),
    remove: async (id) => void items.delete(id),
  };
}

let tick = 0;
const queue = () => createQueue(memoryStore(), () => ++tick);
const input = (userId: string, title: string) => ({
  userId,
  orgId: 'org',
  body: { title },
  idempotencyKey: `key-${title}`,
  photos: [],
});
const titleOf = (item: QueueItem) => item.body.title;

describe('offline queue', () => {
  it('sends oldest first and removes what was sent', async () => {
    const q = queue();
    await q.add(input('u1', 'first'));
    await q.add(input('u1', 'second'));
    const order: unknown[] = [];
    const result = await q.drain('u1', async (item) => {
      order.push(titleOf(item));
      return 'done';
    });
    expect(order).toEqual(['first', 'second']);
    expect(result.sent).toHaveLength(2);
    expect(await q.list('u1')).toEqual([]);
  });

  it('stops at the first offline answer and keeps everything after it', async () => {
    const q = queue();
    await q.add(input('u1', 'first'));
    await q.add(input('u1', 'second'));
    const result = await q.drain('u1', async () => 'offline');
    expect(result.offline).toBe(true);
    expect((await q.list('u1')).map(titleOf)).toEqual(['first', 'second']);
  });

  it('marks a refused item failed, moves on, and retries only on request', async () => {
    const q = queue();
    await q.add(input('u1', 'bad'));
    await q.add(input('u1', 'good'));
    await q.drain('u1', async (item) => (titleOf(item) === 'bad' ? { failed: 'Choose another site.' } : 'done'));
    const [bad] = await q.list('u1');
    expect(bad).toMatchObject({ state: 'failed', error: 'Choose another site.' });

    let calls = 0;
    await q.drain('u1', async () => (calls++, 'done'));
    expect(calls).toBe(0);

    await q.retry('u1', bad!.id);
    await q.drain('u1', async () => 'done');
    expect(await q.list('u1')).toEqual([]);
  });

  it('never shows or sends one person the reports of another', async () => {
    const q = queue();
    await q.add(input('u1', 'mine'));
    await q.add(input('u2', 'theirs'));
    const sent: unknown[] = [];
    await q.drain('u2', async (item) => (sent.push(titleOf(item)), 'done'));
    expect(sent).toEqual(['theirs']);
    expect((await q.list('u1')).map(titleOf)).toEqual(['mine']);
  });

  it('keeps progress saved by the sender between attempts', async () => {
    const q = queue();
    await q.add(input('u1', 'with photos'));
    await q.drain('u1', async (_item, save) => {
      await save({ reference: 'INC-2026-00001', photosSent: 1 });
      return 'offline';
    });
    const [item] = await q.list('u1');
    expect(item).toMatchObject({ reference: 'INC-2026-00001', photosSent: 1, state: 'waiting' });
  });
});
