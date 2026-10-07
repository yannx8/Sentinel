/**
 * Organization settings and the setup checklist (docs/PRD.md F-ORG-02, F-ORG-03),
 * and the caller's own membership with the intervenant availability toggle (F-PPL-07).
 */
import type { Organization } from '@prisma/client';
import {
  availabilitySchema,
  updateOrganizationSchema,
  type Availability,
  type MembershipRole,
  type OrganizationSettings,
  type SetupChecklist,
  type UpdateOrganizationInput,
} from '@sentinel/shared';
import { Router } from 'express';
import { requireOwner, requireRole, tenantOf, type Tenant } from '../auth/context';
import { recordOrgEvent } from '../lib/audit';
import { prisma } from '../lib/prisma';
import { notFound } from '../http/errors';
import { parse } from '../http/validate';
import { pendingInvitationWhere } from './people/service';

/** The caller's membership in the active organization. Intervenant fields are null for other roles. */
export type MembershipSelf = {
  id: string;
  role: MembershipRole;
  isOwner: boolean;
  availability: Availability | null;
  companyName: string | null;
};

/* Settings */

const settingsFields = [
  'displayName',
  'legalName',
  'registrationNumber',
  'timezone',
  'defaultLocale',
  'billingEmail',
  'website',
  'requireResolutionPhoto',
  'showReporterPhone',
] as const;

type SettingsField = (typeof settingsFields)[number];

function toSettings(org: Organization): OrganizationSettings {
  return {
    id: org.id,
    legalName: org.legalName,
    displayName: org.displayName,
    registrationNumber: org.registrationNumber,
    industry: org.industry,
    sizeBand: org.sizeBand,
    country: org.country,
    city: org.city,
    timezone: org.timezone,
    defaultLocale: org.defaultLocale === 'fr' ? 'fr' : 'en',
    website: org.website,
    billingEmail: org.billingEmail,
    requireResolutionPhoto: org.requireResolutionPhoto,
    showReporterPhone: org.showReporterPhone,
    plan: org.plan,
    trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    status: org.status,
    createdAt: org.createdAt.toISOString(),
  };
}

export async function getSettings(tenant: Tenant): Promise<OrganizationSettings> {
  const org = await prisma.organization.findUnique({ where: { id: tenant.orgId } });
  if (!org) throw notFound('Organization');
  return toSettings(org);
}

/** Saves the settings form. Only fields that actually changed are written to the audit trail. */
export async function updateSettings(tenant: Tenant, input: UpdateOrganizationInput): Promise<OrganizationSettings> {
  const org = await prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({ where: { id: tenant.orgId } });
    if (!current) throw notFound('Organization');
    const next: Pick<Organization, SettingsField> = {
      displayName: input.displayName,
      legalName: input.legalName,
      registrationNumber: input.registrationNumber ?? null,
      timezone: input.timezone,
      defaultLocale: input.defaultLocale,
      billingEmail: input.billingEmail,
      website: input.website ?? null,
      requireResolutionPhoto: input.requireResolutionPhoto,
      showReporterPhone: input.showReporterPhone,
    };
    const fields = settingsFields.filter((key) => next[key] !== current[key]);
    if (fields.length === 0) return current;
    const updated = await tx.organization.update({ where: { id: tenant.orgId }, data: next });
    await recordOrgEvent(tx, tenant, 'ORG_UPDATED', { fields });
    return updated;
  });
  return toSettings(org);
}

/** What the first-run checklist on the dashboard still asks for. A pending invitation counts as a member on the way. */
export async function getSetupChecklist(tenant: Tenant): Promise<SetupChecklist> {
  const orgId = tenant.orgId;
  const select = { id: true } as const;
  const memberOrInvited = (role: 'INTERVENANT' | 'REPORTER') =>
    Promise.all([
      prisma.membership.findFirst({ where: { organizationId: orgId, role, status: 'ACTIVE' }, select }),
      prisma.invitation.findFirst({ where: { organizationId: orgId, role, ...pendingInvitationWhere() }, select }),
    ]).then(([member, invitation]) => member !== null || invitation !== null);

  const [site, category, hasIntervenant, hasEmployee, incident] = await Promise.all([
    prisma.site.findFirst({ where: { organizationId: orgId, isActive: true }, select }),
    prisma.incidentCategory.findFirst({ where: { organizationId: orgId, isActive: true }, select }),
    memberOrInvited('INTERVENANT'),
    memberOrInvited('REPORTER'),
    prisma.incident.findFirst({ where: { organizationId: orgId }, select }),
  ]);
  return {
    hasSite: site !== null,
    hasCategory: category !== null,
    hasIntervenant,
    hasEmployee,
    hasIncident: incident !== null,
  };
}

/* Own membership */

async function intervenantProfile(tenant: Tenant) {
  return prisma.intervenantProfile.findFirst({
    where: { membershipId: tenant.membershipId, organizationId: tenant.orgId },
    select: { availability: true, companyName: true },
  });
}

function toMembershipSelf(
  tenant: Tenant,
  profile: { availability: Availability; companyName: string | null } | null,
): MembershipSelf {
  const intervenant = tenant.role === 'INTERVENANT';
  return {
    id: tenant.membershipId,
    role: tenant.role,
    isOwner: tenant.isOwner,
    // An intervenant without a profile row yet has the column default.
    availability: intervenant ? (profile?.availability ?? 'AVAILABLE') : null,
    companyName: intervenant ? (profile?.companyName ?? null) : null,
  };
}

export async function getMembershipSelf(tenant: Tenant): Promise<MembershipSelf> {
  const profile = tenant.role === 'INTERVENANT' ? await intervenantProfile(tenant) : null;
  return toMembershipSelf(tenant, profile);
}

/** Self-service toggle. Supervisors see it in candidate ranking; it never blocks an assignment. */
export async function setAvailability(tenant: Tenant, availability: Availability): Promise<MembershipSelf> {
  const profile = await prisma.intervenantProfile.upsert({
    where: { membershipId_organizationId: { membershipId: tenant.membershipId, organizationId: tenant.orgId } },
    create: { membershipId: tenant.membershipId, organizationId: tenant.orgId, availability },
    update: { availability },
    select: { availability: true, companyName: true },
  });
  return toMembershipSelf(tenant, profile);
}

/* Routes */

/** Mounted at /v1/organization. */
export const organizationRoutes = Router();

organizationRoutes.get('/', requireRole('SUPERVISOR'), async (req, res) => {
  res.json({ data: await getSettings(tenantOf(req)) });
});

organizationRoutes.patch('/', requireOwner, async (req, res) => {
  const input = parse(updateOrganizationSchema, req.body);
  res.json({ data: await updateSettings(tenantOf(req), input) });
});

organizationRoutes.get('/setup', requireRole('SUPERVISOR'), async (req, res) => {
  res.json({ data: await getSetupChecklist(tenantOf(req)) });
});

/** Mounted at /v1/membership. */
export const membershipRoutes = Router();

membershipRoutes.get('/', async (req, res) => {
  res.json({ data: await getMembershipSelf(tenantOf(req)) });
});

membershipRoutes.patch('/availability', requireRole('INTERVENANT'), async (req, res) => {
  const { availability } = parse(availabilitySchema, req.body);
  res.json({ data: await setAvailability(tenantOf(req), availability) });
});
