import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@sentinel/shared';
import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { logger } from '../lib/logger';
import { AppError } from './errors';

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? new AppError('UPLOAD_REJECTED', 'Photos must be 5 MB or smaller', undefined, 413)
      : new AppError('UPLOAD_REJECTED', 'Upload one photo at a time');
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return new AppError('CONFLICT', 'This already exists', { target: error.meta?.target });
    if (error.code === 'P2025') return new AppError('NOT_FOUND', 'Resource not found');
  }
  // Raised by the invariant triggers (immutable originals, closed incidents, append-only audit).
  if (error instanceof Error && /restrict_violation|immutable|read-only|append-only/i.test(error.message)) {
    return new AppError('CONFLICT', 'This record can no longer be changed');
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    return new AppError('VALIDATION_FAILED', 'The request body is not valid JSON', undefined, 400);
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    return new AppError('VALIDATION_FAILED', 'The request body is too large', undefined, 413);
  }
  return new AppError(
    'INTERNAL',
    'Something went wrong on our side. Try again, or contact support with the request id.',
  );
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const appError = toAppError(error);
  if (appError.code === 'INTERNAL') logger.error({ err: error, requestId: req.requestId }, 'Unhandled error');
  const body: ApiErrorBody = {
    code: appError.code,
    message: appError.message,
    requestId: req.requestId,
    ...(appError.details === undefined ? {} : { details: appError.details }),
  };
  res.status(appError.status).json({ error: body });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: req.requestId } });
}
