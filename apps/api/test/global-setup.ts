import { execSync } from 'node:child_process';
import { loadTestEnv } from './env';

/** Applies pending migrations to the test database once per run. */
export default function setup() {
  loadTestEnv();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe', env: process.env, cwd: new URL('..', import.meta.url) });
}
