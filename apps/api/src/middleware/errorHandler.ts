import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(e: any, req: Request, res: Response, _next: NextFunction) {
  const known = e instanceof AppError;
  const status = known ? e.status : (e?.name === 'ZodError' ? 400 : 500);
  const code = known ? e.code : (e?.name === 'ZodError' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');
  if (status >= 500) {
    logger.error('Request error', {
      method: req.method,
      path: req.path,
      error: e?.message,
      stack: e?.stack,
      requestId: req.headers['x-request-id']
    });
  }
  const message = known ? e.message : (e?.name === 'ZodError' ? 'Invalid request' : 'Internal server error');
  res.status(status).json({ error: { code, message } });
}
