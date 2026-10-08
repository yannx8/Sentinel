import { expect, test, type Page } from '@playwright/test';

// Seeded database required (pnpm db:reset). After the first goto, everything happens in the app: no reloads.
const password = 'sentinel-demo';

async function signInHere(page: Page, email: string) {
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('supervisor then employee in the same tab: the employee gets the field app', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await signInHere(page, 'claire@northwind.test');
  await expect(page).toHaveURL(/\/app\/incidents/);

  await page.getByRole('button', { name: /Claire/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signInHere(page, 'lea@northwind.test');
  await expect(page).toHaveURL(/\/field\/report/);
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.locator('input[value="lea@northwind.test"]')).toBeVisible();
});

test('employee then supervisor in the same tab: the supervisor gets the console', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await signInHere(page, 'lea@northwind.test');
  await expect(page).toHaveURL(/\/field\/report/);

  await page.getByRole('link', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await expect(page).toHaveURL(/\/login$/);

  await signInHere(page, 'claire@northwind.test');
  await expect(page).toHaveURL(/\/app\/incidents/);
  await expect(page.getByRole('button', { name: /Claire/ })).toBeVisible();
});

test('another tab follows a sign-out', async ({ context }) => {
  await context.clearCookies();
  const first = await context.newPage();
  await first.goto('/login');
  await signInHere(first, 'claire@northwind.test');
  await expect(first).toHaveURL(/\/app\/incidents/);
  const second = await context.newPage();
  await second.goto('/app/incidents');
  // Wait for the app to mount, so its session listener exists before the other tab signs out.
  await expect(second.getByRole('button', { name: /Claire/ })).toBeVisible();

  await first.getByRole('button', { name: /Claire/ }).click();
  await first.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(second).toHaveURL(/\/login/);
});
