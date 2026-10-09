import { Pool } from 'pg';
import { env } from '../env';

/** DATABASE_URL without Prisma's `schema` parameter, which node-postgres does not understand. */
export function pgConnectionString() {
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete('schema');
  return url.toString();
}

/** The one connection pool of the process: Prisma runs on it, and later the job queue. */
export const pool = new Pool({
  connectionString: pgConnectionString(),
  max: env.DB_POOL_MAX,
  // node-postgres waits forever by default; fail like Prisma 6 did when the database is unreachable.
  connectionTimeoutMillis: 5_000,
});
