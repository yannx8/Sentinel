import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// Needs a seeded database: `pnpm db:reset` (demo accounts share the password below).
const password = 'sentinel-demo';
const adminTotpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function base32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input.replace(/=+$/, '')) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

function totp(secret: string): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !['/login', '/'].includes(url.pathname));
}

async function signOut(page: Page) {
  await page.evaluate(() => fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }));
}

/** Status of a tenant API call made from the page, with the organization header the app itself would send. */
const tenantStatus = (page: Page, url: string) =>
  page.evaluate(async (target) => {
    const me = await (await fetch('/api/v1/me', { credentials: 'include' })).json();
    const org = me.data.memberships[0].organization.id as string;
    return (await fetch(target, { credentials: 'include', headers: { 'x-org-id': org } })).status;
  }, url);

const path = (page: Page) => new URL(page.url()).pathname;

test.describe('anonymous visitors', () => {
  for (const protectedPath of ['/app/incidents', '/field/report', '/field/work', '/platform/organizations']) {
    test(`${protectedPath} sends them to the sign-in page`, async ({ page }) => {
      await page.context().clearCookies();
      await page.goto(protectedPath);
      await expect(page).toHaveURL(/\/login/);
      expect(new URL(page.url()).searchParams.get('redirect')).toContain(protectedPath);
    });
  }

  test('the API answers 401 without a session', async ({ request }) => {
    for (const url of ['/api/v1/me', '/api/v1/incidents', '/api/v1/platform/organizations']) {
      expect((await request.get(url)).status(), url).toBe(401);
    }
  });

  test('rejects a wrong password and does not leave the sign-in page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('claire@northwind.test');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    expect(path(page)).toBe('/login');
  });

  test('ignores an off-site redirect target after sign-in', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login?redirect=https://evil.example/phish');
    await page.getByLabel('Work email').fill('claire@northwind.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !['/login', '/'].includes(url.pathname));
    expect(new URL(page.url()).origin).toBe('http://localhost:5173');
  });
});

test('supervisor: lands in the console, is kept out of field and platform, signs out', async ({ page }) => {
  await signIn(page, 'claire@northwind.test');
  expect(path(page)).toBe('/app/incidents');
  for (const away of ['/field/report', '/field/work', '/platform/organizations']) {
    await page.goto(away);
    await expect(page).toHaveURL(/\/app\/incidents/);
  }
  await page.goto('/app/team');
  expect(path(page)).toBe('/app/team');

  await signOut(page);
  await page.goto('/app/incidents');
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get('/api/v1/me')).status()).toBe(401);
});

test('employee (reporter): lands on the report form and cannot reach console, work or platform', async ({ page }) => {
  await signIn(page, 'lea@northwind.test');
  expect(path(page)).toBe('/field/report');
  await page.goto('/app/incidents');
  await expect(page).toHaveURL(/\/field\/report/);
  await page.goto('/platform/organizations');
  await expect(page).toHaveURL(/\/field\/report/);
  // The intervenant work page is not theirs: it sends them to their own reports.
  await page.goto('/field/work');
  await expect(page).toHaveURL(/\/field\/incidents/);
  expect(await tenantStatus(page, '/api/v1/members')).toBe(403);
});

test('intervenant: lands on their work and cannot report, open the console or platform', async ({ page }) => {
  await signIn(page, 'karim@rhone-plomberie.test');
  expect(path(page)).toBe('/field/work');
  await page.goto('/app/incidents');
  await expect(page).toHaveURL(/\/field\/work/);
  await page.goto('/platform/organizations');
  await expect(page).toHaveURL(/\/field\/work/);
  await page.goto('/field/report');
  await expect(page).toHaveURL(/\/field\/work/);
  expect(await tenantStatus(page, '/api/v1/members')).toBe(403);
});

test('platform admin: needs the authenticator code, then reaches only the platform area', async ({ page }) => {
  await signIn(page, 'admin@sentinel.test');
  expect(path(page)).toBe('/mfa');
  await page.goto('/platform/organizations');
  await expect(page).toHaveURL(/\/mfa/);
  expect((await page.request.get('/api/v1/platform/organizations')).status()).toBe(403);

  await page.getByLabel(/code/i).first().fill(totp(adminTotpSecret));
  await page
    .getByRole('button', { name: /verify|continue|sign in/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/platform\//);

  for (const away of ['/app/incidents', '/field/report']) {
    await page.goto(away);
    await expect(page).toHaveURL(/\/platform\//);
  }
  expect((await page.request.get('/api/v1/incidents')).status()).toBe(403);

  await signOut(page);
  await page.goto('/platform/organizations');
  await expect(page).toHaveURL(/\/login/);
});

test('only organizations register: the sign-up page offers an organization form', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByLabel('Legal name')).toBeVisible();
});
