import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, reportIncident, resetDb, scenario } from './helpers';

/* QR tokens name a site and nothing else; areas stay inside their own organization. */

type Scenario = Awaited<ReturnType<typeof scenario>>;
let a: Scenario;
let b: Scenario;

beforeEach(async () => {
  await resetDb();
  a = await scenario('Acme');
  b = await scenario('Bravo');
});

const lookup = (token: string) => request(app).get(`/v1/public/sites/${token}`);

describe('QR areas', () => {
  it('resolves a site token and an area token to their own site, and nothing else to anyone', async () => {
    const created = await a.supervisor.post(`/sites/${a.site.id}/areas`, { name: 'Hall' });
    expect(created.status).toBe(201);
    const listed = await a.supervisor.get(`/sites/${a.site.id}/areas`);
    const { siteToken } = listed.body.data as { siteToken: string };

    const bySite = await lookup(siteToken);
    expect(bySite.body.data).toMatchObject({ siteId: a.site.id, areaId: null, guestReporting: false });
    const byArea = await lookup(created.body.data.token);
    expect(byArea.body.data).toMatchObject({ siteId: a.site.id, areaName: 'Hall' });

    expect((await lookup('not-a-token')).status).toBe(404);
    await a.supervisor.patch(`/sites/${a.site.id}/areas/${created.body.data.id}`, { isActive: false });
    expect((await lookup(created.body.data.token)).status).toBe(404);
  });

  it('keeps areas inside their organization and site', async () => {
    const area = await a.supervisor.post(`/sites/${a.site.id}/areas`, { name: 'Hall' });
    const areaId = area.body.data.id as string;

    expect((await b.supervisor.get(`/sites/${a.site.id}/areas`)).status).toBe(404);
    expect((await b.supervisor.patch(`/sites/${b.site.id}/areas/${areaId}`, { name: 'Stolen' })).status).toBe(404);
    expect((await a.reporter.get(`/sites/${a.site.id}/areas`)).status).toBe(403);
    expect((await a.reporter.get(`/areas/${areaId}`)).body.data).toMatchObject({ name: 'Hall', siteId: a.site.id });
    expect((await b.reporter.get(`/areas/${areaId}`)).status).toBe(404);

    const ok = await reportIncident(a.reporter, a.site.id, a.category.id, { areaId });
    expect(ok.id).toBeTruthy();
    const foreign = await b.reporter.post('/incidents', {
      title: 'Leak',
      siteId: b.site.id,
      categoryId: b.category.id,
      areaId,
    });
    expect(foreign.status).toBe(422);
  });
});
