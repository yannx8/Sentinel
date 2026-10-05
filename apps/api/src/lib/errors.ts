/** Standardized application error with machine-readable code and HTTP status. */
export class AppError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}
/** Shorthand for throwing 400 validation errors with a human-readable message. */
export const bad = (m: string) => new AppError('VALIDATION_ERROR', 400, m);
