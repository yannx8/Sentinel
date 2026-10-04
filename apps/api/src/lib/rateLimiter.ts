import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

// Production limits are strict to prevent credential stuffing; dev limits are generous
// to avoid blocking during automated testing and development workflows.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts' } }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many registration attempts' } }
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 3 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts' } }
});

export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many token refresh attempts' } }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
