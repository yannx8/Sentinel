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

test('J3: report, assign, accept, resolve, close', async ({ page }) => {
  const title = `E2E leak ${Date.now()}`;
  let reference = '';

  await test.step('employee reports', async () => {
    await signIn(page, 'lea@northwind.test');
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Description').fill('Water under the sink, started this morning.');
    await page.getByRole('radio', { name: 'Water leak' }).check({ force: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: /Lyon headquarters/ }).check({ force: true });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('Incident reported')).toBeVisible();
    reference = (
      await page
        .getByText(/INC-\d{4}-\d{5,}/)
        .first()
        .innerText()
    ).match(/INC-\d{4}-\d{5,}/)![0];
  });

  await test.step('supervisor assigns to Karim', async () => {
    await signIn(page, 'claire@northwind.test');
    await page.goto(`/app/incidents?incident=${reference}`);
    await page
      .getByRole('button', { name: /Triage and assign|Assign/ })
      .first()
      .click();
    await page.getByRole('radio', { name: /Karim/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Assign', exact: true }).click();
    await expect(page.getByText(/Assigned to Karim/).first()).toBeVisible();
  });

  await test.step('intervenant accepts and resolves', async () => {
    await signIn(page, 'karim@rhone-plomberie.test');
    await page.goto('/field');
    await page.getByText(title).first().click();
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await page.getByRole('button', { name: 'Resolve', exact: true }).click();
    await page.getByLabel('Resolution note').fill('Replaced the seal, no more leak.');
    await page.getByRole('dialog').getByRole('button', { name: 'Resolve', exact: true }).click();
    await expect(page.getByText('Incident resolved')).toBeVisible();
  });

  await test.step('supervisor closes', async () => {
    await signIn(page, 'claire@northwind.test');
    await page.goto(`/app/incidents?incident=${reference}`);
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close incident' }).click();
    await expect(page.getByText(/Closed on/).first()).toBeVisible();
  });
});
