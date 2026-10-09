import { defineConfig } from 'tsup';

// Bundles the API with the workspace package inlined. npm dependencies stay external.
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    'create-platform-admin': 'src/cli/create-platform-admin.ts',
    seed: 'prisma/seed.ts',
  },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@sentinel/shared'],
});
