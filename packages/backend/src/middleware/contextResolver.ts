import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export const contextResolver = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkUserId = (req as any).auth?.userId;
    const clerkOrgId = (req as any).auth?.orgId;

    if (!clerkUserId) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return next();
    }

    let ctx: {
      userId: string;
      orgId?: string;
      membershipId?: string;
      role?: string;
    } = {
      userId: user.id
    };

    if (clerkOrgId) {
      const org = await prisma.organization.findUnique({
        where: { clerkOrgId },
        select: { id: true }
      });

      if (org) {
        ctx.orgId = org.id;

        const membership = await prisma.membership.findFirst({
          where: {
            userId: user.id,
            organizationId: org.id
          },
          select: { id: true, role: true }
        });

        if (membership) {
          ctx.membershipId = membership.id;
          ctx.role = membership.role;
        }
      }
    }

    req.ctx = ctx;
    next();
  } catch (error) {
    console.error('Context resolver error:', error);
    next(error);
  }
};
