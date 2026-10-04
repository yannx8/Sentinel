import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';

// Gate for every tenant-scoped route: a missing orgId must never reach a
// Prisma query, where `organizationId: undefined` silently means "no filter".
export const requireTenant = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.ctx?.userId) {
    return next(new AppError('AUTH_REQUIRED', 401, 'Authentication required'));
  }
  if (!req.ctx.orgId || !req.ctx.membershipId || !req.ctx.role) {
    return next(new AppError('FORBIDDEN_TENANT', 403, 'Organization context required'));
  }
  next();
};
