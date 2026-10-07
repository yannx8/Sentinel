import { AppError } from './errors';

/** Opaque keyset cursor: base64url JSON of the sort values of the last row. */
export function encodeCursor(values: readonly (string | number)[]): string {
  return Buffer.from(JSON.stringify(values)).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): (string | number)[] | null {
  if (!cursor) return null;
  try {
    const values: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(values) && values.every((v) => typeof v === 'string' || typeof v === 'number')) return values;
  } catch {
    // fall through
  }
  throw new AppError('VALIDATION_FAILED', 'Invalid cursor', { fields: { cursor: ['Invalid cursor'] } });
}

export function page<T>(rows: T[], limit: number, cursorOf: (row: T) => (string | number)[]) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  return { data, page: { hasMore, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null } };
}
