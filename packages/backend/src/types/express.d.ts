import { MembershipRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      ctx?: {
        userId: string;
        orgId?: string;
        membershipId?: string;
        role?: MembershipRole | string;
      };
    }
  }
}

export {};
