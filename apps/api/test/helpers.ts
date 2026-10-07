import { randomUUID } from 'node:crypto';
import type { Industry, MembershipRole, Priority } from '@sentinel/shared';
import request from 'supertest';
import { createApp } from '../src/app';
import { hashPassword, newTotpSecret, totpCode } from '../src/lib/crypto';
import { testOutbox } from '../src/lib/mailer';
import { prisma } from '../src/lib/prisma';
import { seedCatalog } from '../src/modules/registration';

export const app = createApp();
export { prisma, testOutbox };

export const PASSWORD = 'correct horse battery';
let passwordHash: Promise<string> | null = null;
const sharedHash = () => (passwordHash ??= hashPassword(PASSWORD));

/** Empties every application table between suites. TRUNCATE skips the append-only row triggers by design. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  testOutbox.length = 0;
}

export async function createUser(
  email = `${randomUUID().slice(0, 8)}@example.test`,
  names: [string, string] = ['Test', 'Person'],
) {
  return prisma.user.create({
    data: {
      email,
      firstName: names[0],
      lastName: names[1],
      passwordHash: await sharedHash(),
      emailVerifiedAt: new Date(),
    },
  });
}

export async function createOrg(name = 'Acme Facilities', industry: Industry = 'FACILITIES') {
  const owner = await createUser(`owner-${randomUUID().slice(0, 6)}@acme.test`, ['Olivia', 'Owner']);
  const org = await prisma.organization.create({
    data: {
      slug: `${name.toLowerCase().replace(/\W+/g, '-')}-${randomUUID().slice(0, 6)}`,
      legalName: `${name} SAS`,
      displayName: name,
      industry,
      sizeBand: 'S',
      country: 'FR',
      timezone: 'Europe/Paris',
      defaultLocale: 'en',
      billingEmail: owner.email,
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      termsVersion: 'test',
      termsAcceptedAt: new Date(),
      termsAcceptedByUserId: owner.id,
    },
  });
  const ownerMembership = await prisma.membership.create({
    data: { organizationId: org.id, userId: owner.id, role: 'SUPERVISOR', isOwner: true },
  });
  await prisma.$transaction((tx) => seedCatalog(tx, org.id, industry, 'en'));
  const site = await prisma.site.create({ data: { organizationId: org.id, code: 'HQ', name: 'Headquarters' } });
  const category = await prisma.incidentCategory.findFirstOrThrow({
    where: { organizationId: org.id, name: 'Water leak' },
  });
  return { org, owner: { user: owner, membership: ownerMembership }, site, category };
}

export async function addMember(
  orgId: string,
  role: MembershipRole,
  options: {
    email?: string;
    names?: [string, string];
    siteIds?: string[];
    specialtyIds?: string[];
    userId?: string;
  } = {},
) {
  const user = options.userId
    ? await prisma.user.findUniqueOrThrow({ where: { id: options.userId } })
    : await createUser(options.email, options.names);
  const membership = await prisma.membership.create({ data: { organizationId: orgId, userId: user.id, role } });
  if (role === 'REPORTER') {
    await prisma.employeeProfile.create({ data: { membershipId: membership.id, organizationId: orgId } });
  }
  if (role === 'INTERVENANT') {
    await prisma.intervenantProfile.create({
      data: { membershipId: membership.id, organizationId: orgId, companyName: 'Fixit' },
    });
    for (const siteId of options.siteIds ?? []) {
      await prisma.siteAccess.create({ data: { membershipId: membership.id, siteId, organizationId: orgId } });
    }
    for (const specialtyId of options.specialtyIds ?? []) {
      await prisma.intervenantSpecialty.create({
        data: { membershipId: membership.id, specialtyId, organizationId: orgId },
      });
    }
  }
  return { user, membership };
}

/** A signed-in client bound to one organization. */
export type Client = ReturnType<typeof clientFor>;

function clientFor(agent: ReturnType<typeof request.agent>, orgId: string | null) {
  const withOrg = <T extends request.Test>(test: T) => (orgId ? test.set('X-Org-Id', orgId) : test);
  return {
    agent,
    orgId,
    get: (path: string) => withOrg(agent.get(`/v1${path}`)),
    post: (path: string, body: object = {}, headers: Record<string, string> = {}) =>
      withOrg(agent.post(`/v1${path}`).set(headers).send(body)),
    patch: (path: string, body: object) => withOrg(agent.patch(`/v1${path}`).send(body)),
    delete: (path: string) => withOrg(agent.delete(`/v1${path}`)),
    as: (otherOrgId: string | null) => clientFor(agent, otherOrgId),
  };
}

export async function signIn(email: string, orgId: string | null, password = PASSWORD) {
  const agent = request.agent(app);
  const response = await agent.post('/v1/auth/login').send({ email, password });
  if (response.status !== 200)
    throw new Error(`Sign-in failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  return clientFor(agent, orgId);
}

export async function createPlatformAdmin(email = 'admin@sentinel.test') {
  const user = await createUser(email, ['Pat', 'Admin']);
  const secret = newTotpSecret();
  await prisma.platformAdmin.create({ data: { userId: user.id, totpSecret: secret } });
  return { user, secret, code: () => totpCode(secret) };
}

/** Org with a supervisor, an employee and an intervenant who has access to the site. */
export async function scenario(name = 'Acme Facilities') {
  const base = await createOrg(name);
  const employee = await addMember(base.org.id, 'REPORTER', { names: ['Lea', 'Moreau'] });
  const intervenant = await addMember(base.org.id, 'INTERVENANT', {
    names: ['Karim', 'Benali'],
    siteIds: [base.site.id],
    specialtyIds: base.category.specialtyId ? [base.category.specialtyId] : [],
  });
  const [supervisor, reporter, tech] = await Promise.all([
    signIn(base.owner.user.email, base.org.id),
    signIn(employee.user.email, base.org.id),
    signIn(intervenant.user.email, base.org.id),
  ]);
  return { ...base, employee, intervenant, supervisor, reporter, tech };
}

export async function reportIncident(
  client: Client,
  siteId: string,
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await client.post('/incidents', {
    title: 'Water on the floor',
    description: 'Water is leaking from the ceiling in corridor B.',
    siteId,
    categoryId,
    ...overrides,
  });
  if (response.status !== 201) throw new Error(`Create failed: ${response.status} ${JSON.stringify(response.body)}`);
  return response.body.data as { id: string; reference: string; version: number; priority: Priority };
}

/** The token from the most recent email that contains a link with ?token= or /invite/. */
export function lastMailToken(): string {
  const mail = testOutbox[testOutbox.length - 1];
  const match = mail?.text.match(/(?:token=|\/invite\/)([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error('No token found in the last email');
  return match[1];
}
