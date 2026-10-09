import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, prisma, resetDb, scenario } from './helpers';

/* A visitor reports through a QR code: only where the site allows it, nothing internal comes back. */

type Scenario = Awaited<ReturnType<typeof scenario>>;
let a: Scenario;
let b: Scenario;
let token: string;

beforeEach(async () => {
  await resetDb();
  a = await scenario('Acme');
  b = await scenario('Bravo');
  await prisma.site.update({ where: { id: a.site.id }, data: { guestReporting: true } });
  token = (await a.supervisor.get(`/sites/${a.site.id}/areas`)).body.data.siteToken;
});

const report = (body: object) => request(app).post(`/v1/public/sites/${token}/reports`).send(body);

describe('visitor reports', () => {
  it('creates a report with a tracking link, visible to supervisors only', async () => {
    const res = await report({ categoryId: a.category.id, description: 'Broken tap', guestName: 'Visitor' });
    expect(res.status).toBe(201);
    const { reference, trackingToken } = res.body.data as { reference: string; trackingToken: string };

    const listed = await a.supervisor.get('/incidents');
    const item = (listed.body.data as { reference: string; channel: string }[]).find((i) => i.reference === reference);
    expect(item?.channel).toBe('QR_GUEST');
    const own = await a.reporter.get('/incidents?scope=mine');
    expect(JSON.stringify(own.body)).not.toContain(reference);
    expect(JSON.stringify((await b.supervisor.get('/incidents')).body)).not.toContain(reference);

    const track = await request(app).get(`/v1/public/track/${trackingToken}`);
    expect(track.status).toBe(200);
    expect(track.body.data).toMatchObject({ reference, status: 'NEW', siteName: a.site.name });
    expect(JSON.stringify(track.body)).not.toContain('Visitor');
    expect((await request(app).get('/v1/public/track/nope')).status).toBe(404);
  });

  it('answers a honeypot like a success and creates nothing', async () => {
    const res = await report({ categoryId: a.category.id, website: 'http://spam.example' });
    expect(res.status).toBe(201);
    expect(await prisma.incident.count()).toBe(0);
  });

  it('refuses sites that do not allow visitors, and a phone without consent', async () => {
    expect((await report({ categoryId: a.category.id, guestPhone: '+237670000000' })).status).toBe(422);
    await prisma.site.update({ where: { id: a.site.id }, data: { guestReporting: false } });
    expect((await report({ categoryId: a.category.id })).status).toBe(404);
  });
});
