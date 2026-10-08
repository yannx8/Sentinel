import type { Response } from 'express';
import { Router } from 'express';
import { tenantOf } from '../auth/context';
import { subscribe, type LiveEvent } from '../lib/events';

/** Server-sent events: an opaque "something changed" signal for the caller's own membership. Data is refetched through the scoped endpoints. */
export const eventRoutes = Router();

const HEARTBEAT_MS = 25_000;
/** Streams end after this, so EventSource reconnects through the session and membership checks again. */
const MAX_STREAM_MS = 5 * 60_000;
const MAX_STREAMS_PER_USER = 5;

const streams = new Map<string, Set<Response>>();

/** Streams the events `accepts` says are for this person, until the client leaves or the lifetime ends. */
export function openStream(res: Response, userId: string, accepts: (event: LiveEvent) => boolean) {
  // ponytail: per-process cap, enough for one API instance. The oldest stream makes room for the newest.
  const mine = streams.get(userId) ?? new Set<Response>();
  streams.set(userId, mine);
  while (mine.size >= MAX_STREAMS_PER_USER) {
    const oldest = mine.values().next().value as Response;
    mine.delete(oldest);
    oldest.end();
  }
  mine.add(res);

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const unsubscribe = subscribe((event) => {
    if (!accepts(event)) return;
    res.write(`data: ${JSON.stringify({ type: event.type, incidentId: event.incidentId })}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  const lifetime = setTimeout(() => res.end(), MAX_STREAM_MS);
  res.on('close', () => {
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    unsubscribe();
    mine.delete(res);
    if (mine.size === 0) streams.delete(userId);
  });
}

eventRoutes.get('/', (req, res) => {
  const tenant = tenantOf(req);
  openStream(res, tenant.userId, (e) => e.orgId === tenant.orgId && e.recipients.includes(tenant.membershipId));
});
