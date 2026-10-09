import { expect, test, type Page } from '@playwright/test';

// Needs a seeded database: `pnpm db:reset` (demo accounts share the password below).
const password = 'sentinel-demo';

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test('a report made offline is kept, then sent once when the connection returns', async ({ page, context }) => {
  const title = `E2E offline ${Date.now()}`;
  await signIn(page, 'lea@northwind.test');

  await page.getByLabel('Title').fill(title);
  await page.getByRole('radio', { name: 'Water leak' }).check({ force: true });
  await page.getByRole('radio', { name: /Lyon headquarters/ }).check({ force: true });

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Saved on your phone')).toBeVisible();
  await expect(page.getByRole('button', { name: '1 waiting' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/Report INC-\d{4}-\d{5,} sent/)).toBeVisible();
  await expect(page.getByRole('button', { name: /waiting/ })).toHaveCount(0);

  await page.goto('/field/incidents');
  await expect(page.getByText(title)).toHaveCount(1);
});
