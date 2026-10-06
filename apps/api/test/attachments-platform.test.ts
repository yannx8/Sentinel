import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, createPlatformAdmin, prisma, reportIncident, resetDb, scenario, signIn, testOutbox } from './helpers';

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

type Scenario = Awaited<ReturnType<typeof scenario>>;

describe('attachments (F-COL-02)', () => {
  let a: Scenario;
  let b: Scenario;

  beforeEach(async () => {
    await resetDb();
    a = await scenario('Acme');
    b = await scenario('Bravo');
  });

  it('accepts a real image from the reporter and serves it only inside the scope', async () => {
    const incident = await reportIncident(a.reporter, a.site.id, a.category.id);
    const upload = await a.reporter.agent
      .post(`/v1/incidents/${incident.reference}/attachments`)
      .set('X-Org-Id', a.org.id)
      .attach('file', PNG, 'leak.png');
    expect(upload.status).toBe(201);
    expect(upload.body.data.mimeType).toBe('image/png');
    const url = `${upload.body.data.url}`;

    const own = await a.reporter.agent.get(url);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect((await a.supervisor.agent.get(url)).status).toBe(200);
    expect((await b.supervisor.agent.get(url)).status).toBe(404);
    expect((await a.tech.agent.get(url)).status).toBe(404);
  });

  it('rejects a file whose content is not an image, whatever its name (6.4)', async () => {
    const incident = await reportIncident(a.reporter, a.site.id, a.category.id);
    const upload = await a.reporter.agent
      .post(`/v1/incidents/${incident.reference}/attachments`)
      .set('X-Org-Id', a.org.id)
      .attach('file', Buffer.from('<?php echo "hi"; ?>'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(upload.status).toBe(415);
    expect(upload.body.error.code).toBe('UPLOAD_REJECTED');
    expect(await prisma.attachment.count()).toBe(0);
  });
});

describe('platform administration (J8)', () => {
  let a: Scenario;

  beforeEach(async () => {
    await resetDb();
    a = await scenario('Acme');
  });

  async function adminClient() {
    const admin = await createPlatformAdmin();
    const client = await signIn(admin.user.email, null);
    expect((await client.post('/auth/totp', { code: admin.code() })).status).toBe(200);
    return client;
  }

  it('rejects a wrong TOTP code', async () => {
    const admin = await createPlatformAdmin();
    const client = await signIn(admin.user.email, null);
    expect((await client.post('/auth/totp', { code: '000000' })).status).toBe(422);
  });

  it('suspends an organization with a reason, effective on the next request, and reactivates it', async () => {
    const admin = await adminClient();
    expect((await a.supervisor.get('/incidents')).status).toBe(200);

    const tooShort = await admin.post(`/platform/organizations/${a.org.id}/suspend`, { reason: 'no' });
    expect(tooShort.status).toBe(422);

    const suspended = await admin.post(`/platform/organizations/${a.org.id}/suspend`, { reason: 'Unpaid invoices since August' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('SUSPENDED');
    expect((await a.supervisor.get('/incidents')).body.error.code).toBe('ORG_SUSPENDED');
    expect(testOutbox.some((mail) => mail.to === a.owner.user.email)).toBe(true);

    const reactivated = await admin.post(`/platform/organizations/${a.org.id}/reactivate`, {});
    expect(reactivated.body.data.status).toBe('ACTIVE');
    expect((await a.supervisor.get('/incidents')).status).toBe(200);

    const audit = await admin.get('/platform/audit');
    expect((audit.body.data as { type: string }[]).map((e) => e.type)).toEqual(['ORG_REACTIVATED', 'ORG_SUSPENDED']);
  });

  it('lists pending registrations without exposing their payload', async () => {
    const admin = await adminClient();
    await request(app)
      .post('/v1/public/organizations')
      .send({
        company: { legalName: 'Delta SA', displayName: 'Delta', industry: 'RETAIL', sizeBand: 'S', country: 'BE', timezone: 'Europe/Brussels', defaultLocale: 'fr' },
        contact: { firstName: 'Dan', lastName: 'Delta', email: 'dan@delta.test', password: 'long enough passphrase' },
        acceptTerms: true,
      });
    const list = await admin.get('/platform/registrations');
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({ email: 'dan@delta.test', status: 'PENDING' });
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    expect(JSON.stringify(list.body)).not.toContain('scrypt$');
  });
});
