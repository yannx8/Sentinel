import { expect, test } from '@playwright/test';

test('console pages scroll inside the content panel, never the document', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Work email').fill('claire@northwind.test');
  await page.getByLabel('Password', { exact: true }).fill('sentinel-demo');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app\/incidents/);

  for (const path of [
    '/app/incidents',
    '/app/dashboard',
    '/app/team',
    '/app/sites',
    '/app/categories',
    '/app/audit',
    '/app/settings',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const main = page.locator('#main');
    await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await main.hover();
    await page.mouse.wheel(0, 3000);
    const leak = await page.evaluate(() => ({
      extra: document.documentElement.scrollHeight - window.innerHeight,
      scrolled: window.scrollY,
    }));
    expect(leak, path).toEqual({ extra: 0, scrolled: 0 });
  }
});
