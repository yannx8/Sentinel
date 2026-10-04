import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '@prisma/client';
import { AppError } from '../lib/errors.js';

export const requireRole = (...roles: MembershipRole[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.ctx?.userId) {
    return next(new AppError('AUTH_REQUIRED', 401, 'Authentication required'));
  }

  const userRole = req.ctx.role as MembershipRole;
  
  if (!userRole || !roles.includes(userRole)) {
    return next(new AppError('FORBIDDEN_ROLE', 403, 'Insufficient role'));
  }
  
  next();
};
