import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export const requirePlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.ctx?.userId;

    if (!userId) {
      return next(new AppError('UNAUTHORIZED', 401, 'Unauthorized: Missing user context'));
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { userId },
    });

    if (!admin) {
      return next(new AppError('FORBIDDEN_PLATFORM', 403, 'Forbidden: Requires Platform Admin privileges'));
    }

    next();
  } catch (error) {
    console.error('requirePlatformAdmin error:', error);
    next(error);
  }
};
