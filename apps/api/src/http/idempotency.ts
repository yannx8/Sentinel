import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { sha256 } from '../lib/crypto';
import { prisma } from '../lib/prisma';
import { AppError } from './errors';

const TTL_MS = 24 * 3600 * 1000;

type Result = { status: number; body: unknown };

/**
 * Runs a create or transition once per Idempotency-Key (docs/PRD.md 6.8).
 * A retry with the same key and body replays the stored response; the same key
 * with a different body is rejected. Without the header the action just runs.
 */
export async function idempotent(req: Request, scope: string, run: () => Promise<Result>): Promise<Result> {
  const key = req.get('idempotency-key');
  const userId = req.auth?.user.id;
  if (!key || !userId) return run();
  if (key.length > 100) throw new AppError('VALIDATION_FAILED', 'Idempotency-Key is too long');

  const requestHash = sha256(JSON.stringify({ params: req.params, body: req.body ?? null }));
  const existing = await prisma.idempotencyKey.findUnique({ where: { userId_scope_key: { userId, scope, key } } });
  if (existing && existing.createdAt.getTime() > Date.now() - TTL_MS) {
    if (existing.requestHash !== requestHash) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different request');
    }
    return { status: existing.statusCode, body: existing.responseBody };
  }

  const result = await run();
  await prisma.idempotencyKey.upsert({
    where: { userId_scope_key: { userId, scope, key } },
    create: {
      userId,
      scope,
      key,
      requestHash,
      statusCode: result.status,
      responseBody: result.body as Prisma.InputJsonValue,
    },
    update: { requestHash, statusCode: result.status, responseBody: result.body as Prisma.InputJsonValue, createdAt: new Date() },
  });
  return result;
}
