import { MembershipRole } from '@prisma/client';
export const hasRole = (role: MembershipRole, target: MembershipRole) => role === target;
export const isAdmin = (role: MembershipRole) => hasRole(role, MembershipRole.SUPERVISOR);
export const isResp = (role: MembershipRole) => hasRole(role, MembershipRole.INTERVENANT);
