import { describe, it, expect } from 'vitest';

function incidentScope(ctx: any) {
  if (ctx.role === 'SUPERVISOR') return { organizationId: ctx.orgId };
  if (ctx.role === 'INTERVENANT')
    return {
      organizationId: ctx.orgId,
      assignments: { some: { intervenantMembershipId: ctx.membershipId } }
    };
  return { organizationId: ctx.orgId, reporterMembershipId: ctx.membershipId };
}

describe('incident scope', () => {
  it('supervisor sees all incidents in organization', () => {
    const ctx = { role: 'SUPERVISOR', orgId: 'org-1', membershipId: 'mem-1' };
    const scope = incidentScope(ctx);
    expect(scope).toEqual({ organizationId: 'org-1' });
  });

  it('intervenant sees incidents with any assignment (active or historical)', () => {
    const ctx = { role: 'INTERVENANT', orgId: 'org-1', membershipId: 'mem-1' };
    const scope = incidentScope(ctx);
    expect(scope).toEqual({
      organizationId: 'org-1',
      assignments: { some: { intervenantMembershipId: 'mem-1' } }
    });
  });

  it('regular user sees only own reported incidents', () => {
    const ctx = { role: 'REPORTER', orgId: 'org-1', membershipId: 'mem-1' };
    const scope = incidentScope(ctx);
    expect(scope).toEqual({ organizationId: 'org-1', reporterMembershipId: 'mem-1' });
  });
});
