import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, app, createPlatformAdmin, prisma, reportIncident, resetDb, scenario, signIn } from './helpers';

/*
 * Adversarial tenant isolation (docs/PRD.md 5.5 and 7.13). Anything outside the
 * caller's organization or scope must answer exactly like a missing resource.
 */

type Scenario = Awaited<ReturnType<typeof scenario>>;
let a: Scenario;
let b: Scenario;
let incidentA: { id: string; reference: string; version: number };

beforeEach(async () => {
  await resetDb();
  a = await scenario('Acme');
  b = await scenario('Bravo');
  incidentA = await reportIncident(a.reporter, a.site.id, a.category.id);
});

function stripRequestId(body: { error: { requestId?: string } }) {
  const { requestId: _requestId, ...rest } = body.error;
  return rest;
}

describe('cross-tenant access', () => {
  it('answers 404 with the same body for another organization and for a missing id', async () => {
    const foreign = await b.supervisor.get(`/incidents/${incidentA.id}`);
    const missing = await b.supervisor.get(`/incidents/${randomUUID()}`);
    expect(foreign.status).toBe(404);
    expect(stripRequestId(foreign.body)).toEqual(stripRequestId(missing.body));
  });

  it.each([
    ['get', (id: string) => `/incidents/${id}`],
    ['get', (id: string) => `/incidents/${id}/thread`],
    ['get', (id: string) => `/incidents/${id}/candidates`],
    ['post', (id: string) => `/incidents/${id}/comments`],
    ['post', (id: string) => `/incidents/${id}/triage`],
    ['post', (id: string) => `/incidents/${id}/assign`],
    ['post', (id: string) => `/incidents/${id}/dismiss`],
  ] as const)('%s %s on an incident of another organization is 404', async (method, path) => {
    const response =
      method === 'get'
        ? await b.supervisor.get(path(incidentA.id))
        : await b.supervisor.post(path(incidentA.id), {
            body: 'Hello',
            visibility: 'PUBLIC',
            expectedVersion: incidentA.version,
            priority: 'LOW',
            categoryId: b.category.id,
            intervenantMembershipId: b.intervenant.membership.id,
            reason: 'DUPLICATE',
          });
    expect(response.status).toBe(404);
  });

  it('cannot use another organization site, category or members in a report', async () => {
    const response = await b.reporter.post('/incidents', {
      title: 'Cross tenant',
      description: 'Trying to report on a foreign site.',
      siteId: a.site.id,
      categoryId: a.category.id,
    });
    expect([404, 422]).toContain(response.status);
    expect(await prisma.incident.count({ where: { organizationId: b.org.id } })).toBe(0);
  });

  it('cannot read another organization members, sites or audit log', async () => {
    const members = (await b.supervisor.get('/members')).body.data as { id: string }[];
    expect(members.map((m) => m.id)).not.toContain(a.employee.membership.id);
    const member = await b.supervisor.get(`/members/${a.employee.membership.id}`);
    expect(member.status).toBe(404);
    const sites = (await b.supervisor.get('/sites')).body.data as { id: string }[];
    expect(sites.map((site) => site.id)).not.toContain(a.site.id);
    const audit = (await b.supervisor.get('/audit')).body.data as { incident: { id: string } | null }[];
    expect(audit.some((entry) => entry.incident?.id === incidentA.id)).toBe(false);
  });

  it('cannot select an organization the caller does not belong to', async () => {
    const response = await b.supervisor.as(a.org.id).get('/incidents');
    expect(response.status).toBe(404);
  });

  it('keeps an intervenant serving two organizations separated', async () => {
    const shared = await addMember(b.org.id, 'INTERVENANT', { userId: a.intervenant.user.id, siteIds: [b.site.id] });
    expect(shared.user.id).toBe(a.intervenant.user.id);
    const assigned = await a.supervisor.post(`/incidents/${incidentA.reference}/assign`, {
      expectedVersion: incidentA.version,
      intervenantMembershipId: a.intervenant.membership.id,
    });
    expect(assigned.status).toBe(200);

    const inB = (await a.tech.as(b.org.id).get('/incidents?view=all')).body.data;
    expect(inB).toHaveLength(0);
    const work = (await a.tech.get('/me/assignments')).body.data as { organization: { id: string } }[];
    expect(work.map((w) => w.organization.id)).toEqual([a.org.id]);

    await prisma.membership.update({ where: { id: shared.membership.id }, data: { status: 'REVOKED' } });
    expect((await a.tech.as(a.org.id).get(`/incidents/${incidentA.reference}`)).status).toBe(200);
  });
});

describe('access checked on every request (I13)', () => {
  it('rejects a suspended membership on the next request', async () => {
    await prisma.membership.update({ where: { id: a.employee.membership.id }, data: { status: 'SUSPENDED' } });
    const response = await a.reporter.get('/incidents');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('MEMBERSHIP_INACTIVE');
  });

  it('rejects every member of a suspended organization', async () => {
    await prisma.organization.update({ where: { id: a.org.id }, data: { status: 'SUSPENDED' } });
    for (const client of [a.supervisor, a.reporter, a.tech]) {
      const response = await client.get('/incidents');
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ORG_SUSPENDED');
    }
    expect((await b.supervisor.get('/incidents')).status).toBe(200);
  });

  it('requires a session', async () => {
    const anonymous = await request(app).get('/v1/incidents').set('X-Org-Id', a.org.id);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('ends access for every session when the membership is revoked', async () => {
    await prisma.membership.update({ where: { id: a.intervenant.membership.id }, data: { status: 'REVOKED' } });
    expect((await a.tech.get('/incidents')).body.error.code).toBe('MEMBERSHIP_INACTIVE');
  });
});

describe('role boundaries', () => {
  it.each([
    ['employee', 'reporter'],
    ['intervenant', 'tech'],
  ] as const)('an %s cannot use supervisor routes', async (_label, key) => {
    const client = a[key];
    for (const path of ['/members', '/invitations', '/dashboard', '/audit', '/reassignments', '/incidents/counts']) {
      expect((await client.get(path)).status).toBe(403);
    }
    expect(
      (await client.post(`/incidents/${incidentA.reference}/dismiss`, { expectedVersion: 1, reason: 'DUPLICATE' }))
        .status,
    ).not.toBe(200);
  });

  it('an employee cannot read a colleague report', async () => {
    const colleague = await addMember(a.org.id, 'REPORTER');
    const client = await signIn(colleague.user.email, a.org.id);
    expect((await client.get(`/incidents/${incidentA.reference}`)).status).toBe(404);
  });

  it('a supervisor who is not the owner cannot invite supervisors or change settings', async () => {
    const second = await addMember(a.org.id, 'SUPERVISOR');
    const client = await signIn(second.user.email, a.org.id);
    const invite = await client.post('/invitations', {
      role: 'SUPERVISOR',
      email: 'boss@acme.test',
      firstName: 'Big',
      lastName: 'Boss',
    });
    expect(invite.status).toBe(403);
    const settings = await client.get('/organization');
    expect(settings.status).toBe(200);
    const patch = await client.patch('/organization', { ...settings.body.data, displayName: 'Hijacked' });
    expect(patch.status).toBe(403);
  });
});

describe('platform boundary (I12)', () => {
  it('keeps platform and tenant routes mutually exclusive', async () => {
    const admin = await createPlatformAdmin();
    const client = await signIn(admin.user.email, null);
    expect((await client.get('/platform/organizations')).body.error.code).toBe('MFA_REQUIRED');
    expect((await client.post('/auth/totp', { code: admin.code() })).status).toBe(200);
    expect((await client.get('/platform/organizations')).status).toBe(200);
    expect((await client.as(a.org.id).get('/incidents')).status).toBe(403);

    for (const tenant of [a.supervisor, a.reporter, a.tech]) {
      expect((await tenant.get('/platform/organizations')).status).toBe(403);
    }
  });

  it('never returns incident content to platform admins', async () => {
    const admin = await createPlatformAdmin();
    const client = await signIn(admin.user.email, null);
    await client.post('/auth/totp', { code: admin.code() });
    const list = await client.get('/platform/organizations');
    const detail = await client.get(`/platform/organizations/${a.org.id}`);
    const raw = JSON.stringify([list.body, detail.body]);
    expect(raw).not.toContain('Water on the floor');
    expect(raw).not.toContain('leaking from the ceiling');
  });
});
