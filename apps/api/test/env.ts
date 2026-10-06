import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Forces the test environment before any test file imports the app, even when
 * the shell already exports DATABASE_URL. Suites truncate tables, so they
 * refuse to run against anything but a *_test database.
 */
export function loadTestEnv() {
  Object.assign(process.env, parseEnv(readFileSync(new URL('../.env.test', import.meta.url), 'utf8')));
  const url = process.env.DATABASE_URL ?? '';
  if (!/_test(\?|$)/.test(url)) throw new Error(`Refusing to run tests against a non-test database: ${url}`);
}

loadTestEnv();
