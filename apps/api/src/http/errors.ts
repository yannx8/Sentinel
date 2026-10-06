import type { ErrorCode } from '@sentinel/shared';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  FORBIDDEN: 403,
  MFA_REQUIRED: 403,
  MEMBERSHIP_INACTIVE: 403,
  ORG_SUSPENDED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONFLICT_CONCURRENT_UPDATE: 409,
  INVALID_STATE_TRANSITION: 409,
  IDEMPOTENCY_KEY_REUSED: 422,
  UPLOAD_REJECTED: 415,
  RATE_LIMITED: 429,
  TOKEN_INVALID: 400,
  TOKEN_EXPIRED: 410,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status?: number,
  ) {
    super(message);
    this.status = status ?? statusByCode[code];
  }
}

/** Same body for "missing" and "not yours", so existence never leaks across tenants. */
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`);
export const forbidden = (message = 'You are not allowed to do this') => new AppError('FORBIDDEN', message);
export const conflict = (message: string, details?: unknown) => new AppError('CONFLICT', message, details);
export const invalidTransition = (message: string) => new AppError('INVALID_STATE_TRANSITION', message);
export const staleVersion = (current: unknown) =>
  new AppError(
    'CONFLICT_CONCURRENT_UPDATE',
    'Someone else changed this incident. Review the latest version and try again.',
    current,
  );
