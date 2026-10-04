import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env from monorepo root or backend-specific path depending on CWD.
// Silently ignore missing files since production uses real env vars.
for (const p of [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'packages/backend/.env')]) {
  try {
    if (existsSync(p)) {
      process.loadEnvFile(p);
      break;
    }
  } catch {}
}
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  STORAGE_PATH: z.string().min(1).default('./uploads'),
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY: z.preprocess((v) => v === 'true' || v === true, z.boolean().default(false)),
  EMAIL_WEBHOOK_URL: z.string().url().optional()
});
export const env = schema.parse(process.env);
