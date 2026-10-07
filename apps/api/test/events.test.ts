import { get, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { emitEvent, subscribe, type LiveEvent } from '../src/lib/events';
import { app, PASSWORD, prisma, reportIncident, resetDb, scenario } from './helpers';

/* Live updates: scoped to the recipient's own membership, never across organizations, never before commit. */

let server: Server;
let port: number;
const open: IncomingMessage[] = [];

beforeAll(async () => {
  server = createServer(app).listen(0);
  port = (server.address() as AddressInfo).port;
});
afterAll(() => {
  for (const res of open) res.destroy();
  server.close();
});

type Scenario = Awaited<ReturnType<typeof scenario>>;
let a: Scenario;
let b: Scenario;

beforeEach(async () => {
  await resetDb();
  a = await scenario('Acme');
  b = await scenario('Bravo');
});

async function cookieFor(email: string) {
  const login = await request(app).post('/v1/auth/login').send({ email, password: PASSWORD });
  return (login.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
}

/** Opens /v1/events and resolves once the stream is live. */
async function stream(email: string, orgId: string) {
  const cookie = await cookieFor(email);
  const messages: { type: string; incidentId: string | null }[] = [];
  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    get({ port, path: `/v1/events?org=${orgId}`, headers: { cookie } }, resolve).on('error', reject);
  });
  open.push(res);
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) if (line.startsWith('data: ')) messages.push(JSON.parse(line.slice(6)));
  });
  return { res, messages };
}

const settle = (ms = 700) => new Promise((resolve) => setTimeout(resolve, ms));

describe('GET /v1/events', () => {
  it('delivers an event to its recipients only, inside the organization', async () => {
    const supervisor = await stream(a.owner.user.email, a.org.id);
    const reporter = await stream(a.employee.user.email, a.org.id);
    const otherOrg = await stream(b.owner.user.email, b.org.id);
    await settle(300);

    const incident = await reportIncident(a.reporter, a.site.id, a.category.id);
    await settle();

    expect(supervisor.messages.map((m) => m.incidentId)).toContain(incident.id);
    expect(reporter.messages).toEqual([]);
    expect(otherOrg.messages).toEqual([]);
  });

  it('answers like a missing organization when the caller has no membership there', async () => {
    const cookie = await cookieFor(a.owner.user.email);
    const res = await request(app).get(`/v1/events?org=${b.org.id}`).set('Cookie', cookie).buffer(false).timeout(2000);
    expect(res.status).toBe(404);
  });

  it('requires a session', async () => {
    const res = await request(app).get(`/v1/events?org=${a.org.id}`);
    expect(res.status).toBe(401);
  });

  it('ignores ?org= on every other route', async () => {
    const cookie = await cookieFor(a.owner.user.email);
    const res = await request(app).get(`/v1/notifications?org=${b.org.id}`).set('Cookie', cookie);
    // The caller belongs to one organization, so it resolves to that one, never to the query value.
    expect(res.status).toBe(200);
  });
});

describe('emitEvent', () => {
  it('sends nothing when the transaction rolls back', async () => {
    const seen: LiveEvent[] = [];
    const unsubscribe = subscribe((event) => seen.push(event));
    await settle(300);
    const event: LiveEvent = { orgId: a.org.id, recipients: [a.owner.membership.id], incidentId: null, type: 'TEST' };

    await prisma
      .$transaction(async (tx) => {
        await emitEvent(tx, event);
        throw new Error('rollback');
      })
      .catch(() => undefined);
    await settle();
    expect(seen).toEqual([]);

    await prisma.$transaction((tx) => emitEvent(tx, event));
    await settle();
    expect(seen).toEqual([event]);
    unsubscribe();
  });
});

describe('stream limits', () => {
  it('keeps at most 5 streams per user, closing the oldest', async () => {
    const streams = [];
    for (let i = 0; i < 6; i++) streams.push(await stream(a.owner.user.email, a.org.id));
    await settle(300);
    expect(streams.filter((s) => s.res.destroyed || s.res.complete).length).toBe(1);
    expect(streams[0]!.res.destroyed || streams[0]!.res.complete).toBe(true);
  });
});
