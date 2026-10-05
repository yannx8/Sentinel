import { Request, Response, NextFunction } from 'express';

// Clerk was removed in Phase 0. Session resolution (Better Auth session to
// User, active Membership and Organization, with status checks) lands in
// Phase 2. Until then no request carries a context, so requireTenant and
// requirePlatformAdmin reject every protected route with 401.
export const contextResolver = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};
