import { describe, it, expect } from 'vitest';
import { hasRole } from '../authorization/index.js';
import { MembershipRole } from '@prisma/client';

describe('authorization', () => {
  it('keeps role checks explicit with single-role model', () => {
    expect(hasRole(MembershipRole.INTERVENANT, MembershipRole.INTERVENANT)).toBe(true);
    expect(hasRole(MembershipRole.REPORTER, MembershipRole.INTERVENANT)).toBe(false);
    expect(hasRole(MembershipRole.INTERVENANT, MembershipRole.SUPERVISOR)).toBe(false);
  });
});
