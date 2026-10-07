import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/env.ts'],
    // One database for every suite: files run one after another (see AGENTS.md).
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
