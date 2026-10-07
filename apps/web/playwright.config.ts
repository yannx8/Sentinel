import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'pnpm --filter @sentinel/api dev',
      url: 'http://localhost:4000/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
});
