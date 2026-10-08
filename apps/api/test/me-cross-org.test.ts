import { beforeAll, describe, expect, it } from 'vitest';
import { addMember, createOrg, prisma, reportIncident, resetDb, signIn } from './helpers';

/* A person working for two organizations reads across both through /me, without X-Org-Id. */

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;

async function setup() {
  const a = await createOrg('Northwind');
  const b = await createOrg('Atlas');
  const employeeA = await addMember(a.org.id, 'REPORTER');
  const employeeB = await addMember(b.org.id, 'REPORTER');
  const karim = await addMember(a.org.id, 'INTERVENANT', { names: ['Karim', 'Benali'], siteIds: [a.site.id] });
  const karimInB = await addMember(b.org.id, 'INTERVENANT', { userId: karim.user.id, siteIds: [b.site.id] });
  const [supA, supB, repA, repB] = await Promise.all([
    signIn(a.owner.user.email, a.org.id),
    signIn(b.owner.user.email, b.org.id),
    signIn(employeeA.user.email, a.org.id),
    signIn(employeeB.user.email, b.org.id),
  ]);
  const incA = await reportIncident(repA, a.site.id, a.category.id);
  const incB = await reportIncident(repB, b.site.id, b.category.id);
  await supA
    .post(`/incidents/${incA.id}/assign`, {
      expectedVersion: incA.version,
      intervenantMembershipId: karim.membership.id,
      priority: 'HIGH',
    })
    .expect(200);
  await supB
    .post(`/incidents/${incB.id}/assign`, {
      expectedVersion: incB.version,
      intervenantMembershipId: karimInB.membership.id,
      priority: 'HIGH',
    })
    .expect(200);
  const karimClient = await signIn(karim.user.email, null);
  return { a, b, karim, karimInB, incA, incB, karimClient, supA };
}

const orgsOf = (rows: { organization: { id: string } }[]) => new Set(rows.map((r) => r.organization.id));
const idsOf = (rows: { id: string }[]) => rows.map((r) => r.id);

describe('a person working for two organizations', () => {
  beforeAll(async () => {
    await resetDb();
    ctx = await setup();
  });

  it('lists notifications from both organizations', async () => {
    const res = await ctx.karimClient.get('/me/notifications').expect(200);
    expect(orgsOf(res.body.data)).toEqual(new Set([ctx.a.org.id, ctx.b.org.id]));
  });

  it('counts unread across organizations and marks one read', async () => {
    const before = (await ctx.karimClient.get('/me/notifications/unread-count').expect(200)).body.data.count;
    expect(before).toBeGreaterThanOrEqual(2);
    const first = (await ctx.karimClient.get('/me/notifications?limit=1').expect(200)).body.data[0];
    await ctx.karimClient.post(`/me/notifications/${first.id}/read`).expect(204);
    const after = (await ctx.karimClient.get('/me/notifications/unread-count').expect(200)).body.data.count;
    expect(after).toBe(before - 1);
  });

  it('lists the incidents worked in both organizations', async () => {
    const res = await ctx.karimClient.get('/me/incidents?sort=updated').expect(200);
    expect(idsOf(res.body.data).sort()).toEqual([ctx.incA.id, ctx.incB.id].sort());
  });

  it('sets availability in every organization at once', async () => {
    await ctx.karimClient.patch('/me/availability', { availability: 'BUSY' }).expect(204);
    const profiles = await prisma.intervenantProfile.findMany({ where: { membership: { userId: ctx.karim.user.id } } });
    expect(profiles.map((p) => p.availability)).toEqual(['BUSY', 'BUSY']);
  });

  it("never returns another person's notifications", async () => {
    const mine = idsOf((await ctx.karimClient.get('/me/notifications').expect(200)).body.data);
    const theirs = idsOf((await ctx.supA.as(null).get('/me/notifications').expect(200)).body.data);
    expect(theirs.length).toBeGreaterThan(0);
    expect(mine.filter((id) => theirs.includes(id))).toEqual([]);
  });

  it("cannot mark another person's notification read", async () => {
    const theirs = (await ctx.supA.as(null).get('/me/notifications').expect(200)).body.data[0];
    await ctx.karimClient.post(`/me/notifications/${theirs.id}/read`).expect(404);
  });

  it('drops an organization from every list once the membership is revoked', async () => {
    await prisma.membership.update({ where: { id: ctx.karimInB.membership.id }, data: { status: 'REVOKED' } });
    const notes = (await ctx.karimClient.get('/me/notifications').expect(200)).body.data;
    expect(orgsOf(notes)).toEqual(new Set([ctx.a.org.id]));
    const incidents = (await ctx.karimClient.get('/me/incidents').expect(200)).body.data;
    expect(idsOf(incidents)).toEqual([ctx.incA.id]);
  });
});
