import type { BulkIncidentsResult, IncidentDetail, SavedViewDTO } from '@sentinel/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, prisma, reportIncident, resetDb, scenario, signIn } from './helpers';

type Scenario = Awaited<ReturnType<typeof scenario>>;
let a: Scenario;
let b: Scenario;

beforeEach(async () => {
  await resetDb();
  a = await scenario('Acme');
  b = await scenario('Bravo');
});

describe('saved views', () => {
  const view = { name: 'Critical at HQ', params: { priority: 'CRITICAL', view: 'open' } };

  it('creates, lists and deletes a supervisor’s own views', async () => {
    const created = await a.supervisor.post('/views', view);
    expect(created.status).toBe(201);
    const dto = created.body.data as SavedViewDTO;
    expect(dto.params).toEqual(view.params);

    const list = await a.supervisor.get('/views');
    expect((list.body.data as SavedViewDTO[]).map((v) => v.name)).toEqual(['Critical at HQ']);

    expect((await a.supervisor.delete(`/views/${dto.id}`)).status).toBe(200);
    expect((await a.supervisor.get('/views')).body.data).toEqual([]);
  });

  it('rejects a duplicate name, unknown params and a 21st view', async () => {
    await a.supervisor.post('/views', view);
    expect((await a.supervisor.post('/views', view)).status).toBe(409);
    expect((await a.supervisor.post('/views', { name: 'x', params: { admin: 'true' } })).status).toBe(422);
    expect((await a.supervisor.post('/views', { name: 'y', params: { site: 'not-a-uuid' } })).status).toBe(422);

    await prisma.savedView.createMany({
      data: Array.from({ length: 19 }, (_, i) => ({
        organizationId: a.org.id,
        membershipId: a.owner.membership.id,
        name: `view ${i}`,
        params: {},
      })),
    });
    expect((await a.supervisor.post('/views', { name: 'one too many', params: {} })).status).toBe(409);
  });

  it('is supervisor only', async () => {
    expect((await a.reporter.get('/views')).status).toBe(403);
    expect((await a.tech.post('/views', view)).status).toBe(403);
  });

  it('hides a view from other supervisors and other organizations', async () => {
    const dto = (await a.supervisor.post('/views', view)).body.data as SavedViewDTO;

    const colleague = await addMember(a.org.id, 'SUPERVISOR', { names: ['Sam', 'Lee'] });
    const colleagueClient = await signIn(colleague.user.email, a.org.id);
    expect((await colleagueClient.get('/views')).body.data).toEqual([]);
    expect((await colleagueClient.delete(`/views/${dto.id}`)).status).toBe(404);

    expect((await b.supervisor.delete(`/views/${dto.id}`)).status).toBe(404);
    expect((await b.supervisor.get('/views')).body.data).toEqual([]);
    expect((await a.supervisor.get('/views')).body.data).toHaveLength(1);
  });
});

describe('bulk actions', () => {
  async function three() {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(await reportIncident(a.reporter, a.site.id, a.category.id));
    return out;
  }
  const bulk = (client: Scenario['supervisor'], body: object) => client.post('/incidents/bulk', body);
  const priorityItems = (list: Awaited<ReturnType<typeof three>>) =>
    list.map((i) => ({ reference: i.reference, expectedVersion: i.version, categoryId: a.category.id }));

  it('sets a priority on every incident', async () => {
    const list = await three();
    const response = await bulk(a.supervisor, { action: 'priority', priority: 'CRITICAL', items: priorityItems(list) });
    expect(response.status).toBe(200);
    expect((response.body.data as BulkIncidentsResult).done).toEqual(list.map((i) => i.reference));
    for (const i of list) {
      const detail = (await a.supervisor.get(`/incidents/${i.reference}`)).body.data as IncidentDetail;
      expect(detail.priority).toBe('CRITICAL');
    }
  });

  it('assigns every incident to one intervenant', async () => {
    const list = await three();
    const response = await bulk(a.supervisor, {
      action: 'assign',
      intervenantMembershipId: a.intervenant.membership.id,
      items: list.map((i) => ({ reference: i.reference, expectedVersion: i.version })),
    });
    expect((response.body.data as BulkIncidentsResult).done).toHaveLength(3);
    const mine = await a.tech.get('/incidents');
    expect(mine.body.data).toHaveLength(3);
  });

  it('keeps going when one incident fails and says which', async () => {
    const list = await three();
    const items = priorityItems(list);
    items[1] = { ...items[1]!, expectedVersion: 99 };
    const result = (await bulk(a.supervisor, { action: 'priority', priority: 'HIGH', items })).body
      .data as BulkIncidentsResult;
    expect(result.done).toEqual([list[0]!.reference, list[2]!.reference]);
    expect(result.failed).toEqual([
      expect.objectContaining({ reference: list[1]!.reference, code: 'CONFLICT_CONCURRENT_UPDATE' }),
    ]);
  });

  it('treats another organization’s incident like a missing one and leaves it untouched', async () => {
    // References are per organization, so make Bravo's second incident a reference Acme does not have.
    await reportIncident(b.reporter, b.site.id, b.category.id);
    const foreign = await reportIncident(b.reporter, b.site.id, b.category.id);
    const own = await reportIncident(a.reporter, a.site.id, a.category.id);
    expect(foreign.reference).not.toBe(own.reference);

    const result = (
      await bulk(a.supervisor, {
        action: 'priority',
        priority: 'LOW',
        items: [
          { reference: foreign.reference, expectedVersion: foreign.version, categoryId: a.category.id },
          { reference: own.reference, expectedVersion: own.version, categoryId: a.category.id },
        ],
      })
    ).body.data as BulkIncidentsResult;

    expect(result.done).toEqual([own.reference]);
    expect(result.failed).toEqual([expect.objectContaining({ reference: foreign.reference, code: 'NOT_FOUND' })]);
    const untouched = (await b.supervisor.get(`/incidents/${foreign.reference}`)).body.data as IncidentDetail;
    expect(untouched.version).toBe(foreign.version);
  });

  it('is supervisor only and bounded', async () => {
    const list = await three();
    const items = priorityItems(list);
    expect((await bulk(a.reporter, { action: 'priority', priority: 'LOW', items })).status).toBe(403);
    expect((await bulk(a.tech, { action: 'priority', priority: 'LOW', items })).status).toBe(403);
    expect((await bulk(a.supervisor, { action: 'priority', priority: 'LOW', items: [] })).status).toBe(422);
    const many = Array.from({ length: 26 }, (_, i) => ({
      reference: `INC-2026-${String(i + 1).padStart(5, '0')}`,
      expectedVersion: 1,
      categoryId: a.category.id,
    }));
    expect((await bulk(a.supervisor, { action: 'priority', priority: 'LOW', items: many })).status).toBe(422);
  });
});
