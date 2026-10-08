import { expect, test } from '@playwright/test';

// Seeded database required: Karim works for two organizations.
test('an intervenant opens work from two organizations without switching', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill('karim@rhone-plomberie.test');
  await page.getByLabel('Password', { exact: true }).fill('sentinel-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/field\/work/);
  await expect(page.getByRole('button', { name: /switch organization/i })).toHaveCount(0);

  await expect(page.getByTestId('work-org').first()).toBeVisible();
  const orgs = [...new Set(await page.getByTestId('work-org').allInnerTexts())];
  expect(orgs.length).toBeGreaterThan(1);
  for (const org of orgs) {
    await page.getByTestId('work-card').filter({ hasText: org }).first().click();
    await expect(page).toHaveURL(/\/field\/incidents\/INC-.*org=/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(org).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/field\/work/);
  }
});
