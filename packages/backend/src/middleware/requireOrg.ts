import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';

export const requireOrg = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.ctx?.orgId) {
    return next(new AppError('FORBIDDEN_TENANT', 403, 'Organization context required'));
  }
  next();
};
