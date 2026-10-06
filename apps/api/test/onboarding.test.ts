import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMember,
  app,
  createOrg,
  createUser,
  lastMailToken,
  PASSWORD,
  prisma,
  reportIncident,
  resetDb,
  scenario,
  signIn,
  testOutbox,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('sign-in', () => {
  it('signs in with an httpOnly session cookie and signs out', async () => {
    const user = await createUser('claire@acme.test');
    const agent = request.agent(app);
    const login = await agent.post('/v1/auth/login').send({ email: 'Claire@Acme.test ', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(user.id);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('sentinel_session=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect((await agent.get('/v1/me')).status).toBe(200);
    expect((await agent.post('/v1/auth/logout')).status).toBe(204);
    expect((await agent.get('/v1/me')).status).toBe(401);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    await createUser('claire@acme.test');
    const unknown = await request(app).post('/v1/auth/login').send({ email: 'nobody@acme.test', password: PASSWORD });
    const wrong = await request(app).post('/v1/auth/login').send({ email: 'claire@acme.test', password: 'not the password' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after repeated failures (F-ACC-04)', async () => {
    await createUser('claire@acme.test');
    for (let i = 0; i < 5; i++) {
      await request(app).post('/v1/auth/login').send({ email: 'claire@acme.test', password: 'wrong password' });
    }
    const locked = await request(app).post('/v1/auth/login').send({ email: 'claire@acme.test', password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('resets a password with a single-use link and signs out every session', async () => {
    await createUser('claire@acme.test');
    const before = await signIn('claire@acme.test', null);
    const forgot = await request(app).post('/v1/auth/password/forgot').send({ email: 'claire@acme.test' });
    expect(forgot.status).toBe(202);
    const token = lastMailToken();
    const reset = await request(app).post('/v1/auth/password/reset').send({ token, password: 'a brand new passphrase' });
    expect(reset.status).toBe(200);
    expect((await before.get('/me')).status).toBe(401);
    const reused = await request(app).post('/v1/auth/password/reset').send({ token, password: 'another new passphrase' });
    expect(reused.body.error.code).toBe('TOKEN_INVALID');
    expect((await signIn('claire@acme.test', null, 'a brand new passphrase')).agent).toBeTruthy();
  });

  it('does not reveal whether an account exists when asking for a reset', async () => {
    const response = await request(app).post('/v1/auth/password/forgot').send({ email: 'ghost@acme.test' });
    expect(response.status).toBe(202);
    expect(testOutbox).toHaveLength(0);
  });
});

describe('organization registration (J1)', () => {
  const registration = {
    company: {
      legalName: 'Northwind Facilities Management SAS',
      displayName: 'Northwind',
      industry: 'HEALTHCARE',
      sizeBand: 'M',
      country: 'fr',
      timezone: 'Europe/Paris',
      defaultLocale: 'fr',
    },
    contact: { firstName: 'Claire', lastName: 'Dubois', email: 'claire@northwind.test', password: 'long enough passphrase' },
    acceptTerms: true,
  };

  it('creates nothing until the email is verified, then activates a trial with a seeded catalog', async () => {
    const created = await request(app).post('/v1/public/organizations').send(registration);
    expect(created.status).toBe(202);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);

    const agent = request.agent(app);
    const verified = await agent.post('/v1/public/organizations/verify').send({ token: lastMailToken() });
    expect(verified.status).toBe(201);
    const me = verified.body.data;
    expect(me.memberships).toHaveLength(1);
    expect(me.memberships[0].isOwner).toBe(true);
    expect(me.memberships[0].role).toBe('SUPERVISOR');

    const org = await prisma.organization.findFirstOrThrow();
    expect(org.plan).toBe('TRIAL');
    expect(org.country).toBe('FR');
    const categories = await prisma.incidentCategory.findMany({ where: { organizationId: org.id } });
    expect(categories.map((c) => c.name)).toContain('Équipement médical');

    const again = await request(app).post('/v1/public/organizations/verify').send({ token: lastMailToken() });
    expect(again.body.error.code).toBe('TOKEN_INVALID');
  });

  it('refuses an email that already has an account', async () => {
    await createUser('claire@northwind.test');
    const response = await request(app).post('/v1/public/organizations').send(registration);
    expect(response.status).toBe(409);
  });

  it('requires accepting the terms', async () => {
    const response = await request(app).post('/v1/public/organizations').send({ ...registration, acceptTerms: false });
    expect(response.status).toBe(422);
  });
});

describe('invitations (J2)', () => {
  it('invites an employee who sets a password and joins', async () => {
    const { org, owner } = await createOrg();
    const supervisor = await signIn(owner.user.email, org.id);
    const invited = await supervisor.post('/invitations', { role: 'REPORTER', email: 'lea@acme.test', firstName: 'Lea', lastName: 'Moreau' });
    expect(invited.status).toBe(201);
    const token = String(invited.body.data.acceptUrl).split('/invite/')[1] ?? '';

    const preview = await request(app).get(`/v1/public/invitations/${token}`);
    expect(preview.body.data).toMatchObject({ organization: 'Acme Facilities', role: 'REPORTER', existingAccount: false });

    const agent = request.agent(app);
    const accepted = await agent.post(`/v1/public/invitations/${token}/accept`).send({ password: 'my own passphrase' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.memberships[0].role).toBe('REPORTER');
    expect((await request(app).get(`/v1/public/invitations/${token}`)).body.error.code).toBe('TOKEN_INVALID');

    const notice = await prisma.notification.findFirst({ where: { recipientMembershipId: owner.membership.id, type: 'INVITATION_ACCEPTED' } });
    expect(notice).not.toBeNull();
  });

  it('asks an existing account to sign in, then adds a second membership', async () => {
    const acme = await createOrg('Acme');
    const bravo = await createOrg('Bravo');
    const tech = await addMember(acme.org.id, 'INTERVENANT', { email: 'karim@fixit.test' });
    const supervisor = await signIn(bravo.owner.user.email, bravo.org.id);
    const invited = await supervisor.post('/invitations', {
      role: 'INTERVENANT',
      email: 'karim@fixit.test',
      firstName: 'Karim',
      lastName: 'Benali',
      intervenant: { siteIds: [bravo.site.id] },
    });
    const token = String(invited.body.data.acceptUrl).split('/invite/')[1] ?? '';

    const anonymous = await request(app).post(`/v1/public/invitations/${token}/accept`).send({ password: 'whatever it is' });
    expect(anonymous.status).toBe(401);

    const karim = await signIn(tech.user.email, null);
    const accepted = await karim.post(`/public/invitations/${token}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.memberships).toHaveLength(2);
    const access = await prisma.siteAccess.count({ where: { siteId: bravo.site.id } });
    expect(access).toBe(1);
  });

  it('refuses to make someone an employee of two organizations (I2)', async () => {
    const acme = await createOrg('Acme');
    const bravo = await createOrg('Bravo');
    await addMember(acme.org.id, 'REPORTER', { email: 'lea@acme.test' });
    const supervisor = await signIn(bravo.owner.user.email, bravo.org.id);
    const response = await supervisor.post('/invitations', { role: 'REPORTER', email: 'lea@acme.test', firstName: 'Lea', lastName: 'Moreau' });
    expect(response.status).toBe(409);
  });

  it('invalidates the old link when an invitation is resent', async () => {
    const { org, owner } = await createOrg();
    const supervisor = await signIn(owner.user.email, org.id);
    const invited = await supervisor.post('/invitations', { role: 'REPORTER', email: 'lea@acme.test', firstName: 'Lea', lastName: 'Moreau' });
    const oldToken = String(invited.body.data.acceptUrl).split('/invite/')[1] ?? '';
    const resent = await supervisor.post(`/invitations/${invited.body.data.invitation.id}/resend`);
    expect(resent.status).toBe(200);
    expect((await request(app).get(`/v1/public/invitations/${oldToken}`)).status).toBe(400);
  });
});

describe('member management', () => {
  it('suspending an intervenant returns their live work to the inbox', async () => {
    const s = await scenario();
    const incident = await reportIncident(s.reporter, s.site.id, s.category.id);
    await s.supervisor.post(`/incidents/${incident.reference}/assign`, {
      expectedVersion: incident.version,
      intervenantMembershipId: s.intervenant.membership.id,
    });
    const suspended = await s.supervisor.post(`/members/${s.intervenant.membership.id}/suspend`, { reason: 'Contract paused' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');
    const after = await s.supervisor.get(`/incidents/${incident.reference}`);
    expect(after.body.data.status).toBe('NEW');
    expect((await s.tech.get('/incidents')).body.error.code).toBe('MEMBERSHIP_INACTIVE');

    const reactivated = await s.supervisor.post(`/members/${s.intervenant.membership.id}/reactivate`);
    expect(reactivated.body.data.status).toBe('ACTIVE');
  });

  it('protects the owner and the caller from removal (I6)', async () => {
    const s = await scenario();
    const second = await addMember(s.org.id, 'SUPERVISOR');
    const secondClient = await signIn(second.user.email, s.org.id);
    expect((await secondClient.post(`/members/${s.owner.membership.id}/revoke`)).status).toBeGreaterThanOrEqual(403);
    expect((await s.supervisor.post(`/members/${s.owner.membership.id}/suspend`)).status).toBe(403);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: s.owner.membership.id } })).status).toBe('ACTIVE');
  });

  it('transfers ownership', async () => {
    const s = await scenario();
    const second = await addMember(s.org.id, 'SUPERVISOR');
    const response = await s.supervisor.post(`/members/${second.membership.id}/transfer-ownership`);
    expect(response.status).toBe(200);
    expect(response.body.data.isOwner).toBe(true);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: s.owner.membership.id } })).isOwner).toBe(false);
  });

  it('imports employees from CSV with a dry run first', async () => {
    const { org, owner, site } = await createOrg();
    await addMember(org.id, 'REPORTER', { email: 'existing@acme.test' });
    const supervisor = await signIn(owner.user.email, org.id);
    const csv = [
      'email,first_name,last_name,employee_code,home_site_code',
      `new.one@acme.test,New,One,E-1,${site.code}`,
      'existing@acme.test,Already,There,,',
      'not-an-email,Bad,Row,,',
      'dup@acme.test,Dup,One,E-1,',
    ].join('\n');

    const dry = await supervisor.post('/members/import', { csv, dryRun: true });
    expect(dry.status).toBe(200);
    expect(dry.body.data).toMatchObject({ dryRun: true, total: 4, ready: 1, skipped: 1, failed: 2 });
    expect(await prisma.invitation.count()).toBe(0);

    const commit = await supervisor.post('/members/import', { csv, dryRun: false });
    expect(commit.body.data.created).toBe(1);
    expect(await prisma.invitation.count()).toBe(1);
  });
});
