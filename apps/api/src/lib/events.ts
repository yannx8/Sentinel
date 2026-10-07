import { Client } from 'pg';
import { env } from '../env';
import { logger } from './logger';
import type { Tx } from './prisma';

const CHANNEL = 'sentinel_events';

export type LiveEvent = {
  orgId: string;
  /** Membership ids that should hear about it. */
  recipients: string[];
  incidentId: string | null;
  type: string;
};

/** Called inside the writing transaction: Postgres delivers a NOTIFY only if that transaction commits. */
export async function emitEvent(tx: Tx, event: LiveEvent) {
  await tx.$queryRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify(event)})::text`;
}

const subscribers = new Set<(event: LiveEvent) => void>();
let client: Client | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let retryDelay = 2_000;

function connect() {
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete('schema'); // Prisma-only parameter
  const next = new Client({ connectionString: url.toString() });
  client = next;
  const retry = () => {
    if (client !== next) return;
    client = null;
    if (subscribers.size === 0 || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!client && subscribers.size > 0) connect();
    }, retryDelay);
    retryTimer.unref();
    retryDelay = Math.min(retryDelay * 2, 30_000);
  };
  next.on('error', (err) => {
    logger.warn({ err }, 'Event listener error');
    retry();
  });
  next.on('end', retry);
  next.on('notification', (msg) => {
    if (msg.channel !== CHANNEL || !msg.payload) return;
    let event: LiveEvent;
    try {
      event = JSON.parse(msg.payload) as LiveEvent;
    } catch {
      return;
    }
    if (typeof event.orgId !== 'string' || !Array.isArray(event.recipients)) return;
    for (const handler of subscribers) {
      try {
        handler(event);
      } catch (err) {
        logger.warn({ err }, 'Event subscriber failed');
      }
    }
  });
  next
    .connect()
    .then(() => next.query(`LISTEN ${CHANNEL}`))
    .then(() => {
      retryDelay = 2_000;
    })
    .catch((err) => {
      logger.warn({ err }, 'Event listener could not connect');
      next.end().catch(() => undefined);
      retry();
    });
}

/**
 * One LISTEN connection per process, opened on the first subscriber and fanned out in memory.
 * Browsers fall back to polling while it is down, so a missed event is never fatal.
 */
export function subscribe(handler: (event: LiveEvent) => void) {
  subscribers.add(handler);
  if (!client && !retryTimer) connect();
  return () => {
    subscribers.delete(handler);
    if (subscribers.size === 0 && client) {
      const closing = client;
      client = null;
      closing.end().catch(() => undefined);
    }
  };
}
