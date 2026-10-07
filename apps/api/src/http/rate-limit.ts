import { rateLimit } from 'express-rate-limit';
import { isTest } from '../env';
import { AppError } from './errors';

function limiter(windowMinutes: number, limit: number) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Too many attempts. Wait a few minutes and try again.')),
  });
}

/** Sign-in, TOTP and password reset. Account lockout adds a per-account limit on top. */
export const authLimiter = limiter(15, 30);
/** Public registration and invitation endpoints. */
export const publicLimiter = limiter(60, 60);
/** Everything else, per IP. */
export const apiLimiter = limiter(1, 600);
