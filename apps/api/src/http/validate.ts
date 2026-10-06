import type { z } from 'zod';
import { AppError } from './errors';

/** Parses input or throws VALIDATION_FAILED with errors keyed by field path. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  throw new AppError('VALIDATION_FAILED', 'Some fields need attention', { fields });
}

export function parseId(value: unknown, what = 'Resource'): string {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  throw new AppError('NOT_FOUND', `${what} not found`);
}
