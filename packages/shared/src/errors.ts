/** Error contract: every failed API call answers `{ error: ApiErrorBody }`. */
export const errorCodes = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'FORBIDDEN',
  'MFA_REQUIRED',
  'MEMBERSHIP_INACTIVE',
  'ORG_SUSPENDED',
  'NOT_FOUND',
  'CONFLICT',
  'CONFLICT_CONCURRENT_UPDATE',
  'INVALID_STATE_TRANSITION',
  'IDEMPOTENCY_KEY_REUSED',
  'UPLOAD_REJECTED',
  'RATE_LIMITED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  /** Field errors for VALIDATION_FAILED, current state for conflicts. */
  details?: unknown;
  requestId?: string;
};

export type FieldErrors = Record<string, string[]>;
