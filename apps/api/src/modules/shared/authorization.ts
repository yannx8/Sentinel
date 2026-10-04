import { AppContext } from './types.js';

/** Check if the user has administrator privileges. */
export function isAdmin(ctx: AppContext): boolean {
  return ctx.roles.includes('ADMINISTRATOR');
}

/** Check if the user has the responsable (responsible party) role. */
export function isResp(ctx: AppContext): boolean {
  return ctx.roles.includes('RESPONSABLE');
}

/** Generic role check for any single role string. */
export function hasRole(ctx: AppContext, role: string): boolean {
  return ctx.roles.includes(role);
}

/**
 * Enforce multi-tenant isolation: ensure the resource belongs to the caller's organization.
 * Throws a typed error code caught by the error handler to return 403.
 */
export function assertSameTenant(ctx: AppContext, resourceOrgId: string): void {
  if (ctx.organizationId !== resourceOrgId) {
    throw new Error('FORBIDDEN_TENANT');
  }
}

/** Assert that an organization membership is currently active. Used after DB lookups. */
export function assertActiveMembership(status: string): void {
  if (status !== 'ACTIVE') {
    throw new Error('FORBIDDEN');
  }
}
