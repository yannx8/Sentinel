/**
 * Catalog (docs/PRD.md F-ORG-04 to F-ORG-06): sites, incident categories and
 * specialties. Supervisors manage them. Employees and intervenants read the
 * active entries they report on or work at.
 */
import type { Prisma, Site } from '@prisma/client';
import {
  categorySchema,
  siteSchema,
  specialtySchema,
  updateCategorySchema,
  updateSiteSchema,
  type CategoryDTO,
  type CategoryInput,
  type SiteDTO,
  type SiteInput,
  type SpecialtyDTO,
} from '@sentinel/shared';
import { Router } from 'express';
import type { z } from 'zod';
import { requireRole, tenantOf, type Tenant } from '../auth/context';
import { recordOrgEvent } from '../lib/audit';
import { prisma, type Tx } from '../lib/prisma';
import { AppError, conflict, notFound } from '../http/errors';
import { idempotent } from '../http/idempotency';
import { parse, parseId } from '../http/validate';
import { isUniqueViolation } from './people/service';

type SiteUpdate = z.output<typeof updateSiteSchema>;
type CategoryUpdate = z.output<typeof updateCategorySchema>;
type SpecialtyInput = z.output<typeof specialtySchema>;

const messages = {
  siteCode: 'Another site uses this code.',
  categoryName: 'Another category uses this name.',
  specialtyName: 'Another specialty uses this name.',
  foreignSpecialty: 'Choose a specialty from this organization.',
};

/* Shared helpers */

function fieldConflict(field: string, message: string) {
  return conflict(message, { fields: { [field]: [message] } });
}

/**
 * Runs a write and reports a unique violation as `onConflict`. The checks before
 * the write give the same answer; this covers two supervisors saving at once.
 */
async function guardUnique<T>(write: () => Promise<T>, onConflict: () => AppError): Promise<T> {
  try {
    return await write();
  } catch (error) {
    throw isUniqueViolation(error) ? onConflict() : error;
  }
}

/**
 * Next value of an optional text field on an update. zod keeps a key the client
 * sent, even when a blank value became undefined, and drops keys left out:
 * blank clears the field, left out keeps it.
 */
function nextText<K extends string>(input: Partial<Record<K, string>>, key: K, current: string | null): string | null {
  return key in input ? (input[key] ?? null) : current;
}

/** Which of `keys` differ between two states, for the audit payload. */
function changedFields<T, K extends keyof T>(keys: readonly K[], current: T, next: Pick<T, K>): K[] {
  return keys.filter((key) => next[key] !== current[key]);
}

/* Sites */

const siteCounts = {
  _count: {
    select: {
      incidents: { where: { status: { not: 'CLOSED' } } },
      accesses: { where: { membership: { role: 'INTERVENANT', status: 'ACTIVE' } } },
    },
  },
} satisfies Prisma.SiteInclude;

type SiteRow = Prisma.SiteGetPayload<{ include: typeof siteCounts }>;

const siteOrder = [{ name: 'asc' }, { code: 'asc' }] satisfies Prisma.SiteOrderByWithRelationInput[];

const siteFields = ['code', 'name', 'address', 'city', 'contactName', 'contactPhone', 'isActive'] as const;

function toSiteDTO(
  site: Site,
  counts: { openIncidents: number; intervenants: number } = { openIncidents: 0, intervenants: 0 },
): SiteDTO {
  return {
    id: site.id,
    code: site.code,
    name: site.name,
    address: site.address,
    city: site.city,
    contactName: site.contactName,
    contactPhone: site.contactPhone,
    isActive: site.isActive,
    openIncidents: counts.openIncidents,
    intervenants: counts.intervenants,
    createdAt: site.createdAt.toISOString(),
  };
}

const siteWithCounts = (row: SiteRow) =>
  toSiteDTO(row, { openIncidents: row._count.incidents, intervenants: row._count.accesses });

const siteCodeTaken = () => fieldConflict('code', messages.siteCode);

async function assertSiteCodeFree(tx: Tx, tenant: Tenant, code: string, exceptId?: string) {
  const other = await tx.site.findFirst({
    where: { organizationId: tenant.orgId, code, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (other) throw siteCodeTaken();
}

/**
 * Supervisors get every site with its counts. Employees report on any active
 * site; intervenants see the active sites they have access to. Counts stay 0
 * for them: open work across the organization is not theirs to see.
 */
export async function listSites(tenant: Tenant): Promise<SiteDTO[]> {
  if (tenant.role === 'SUPERVISOR') {
    const rows = await prisma.site.findMany({
      where: { organizationId: tenant.orgId },
      include: siteCounts,
      orderBy: siteOrder,
    });
    return rows.map(siteWithCounts);
  }
  const rows = await prisma.site.findMany({
    where: {
      organizationId: tenant.orgId,
      isActive: true,
      ...(tenant.role === 'INTERVENANT' ? { accesses: { some: { membershipId: tenant.membershipId } } } : {}),
    },
    orderBy: siteOrder,
  });
  return rows.map((site) => toSiteDTO(site));
}

export async function createSite(tenant: Tenant, input: SiteInput): Promise<SiteDTO> {
  const site = await guardUnique(
    () =>
      prisma.$transaction(async (tx) => {
        await assertSiteCodeFree(tx, tenant, input.code);
        const site = await tx.site.create({
          data: {
            organizationId: tenant.orgId,
            code: input.code,
            name: input.name,
            address: input.address ?? null,
            city: input.city ?? null,
            contactName: input.contactName ?? null,
            contactPhone: input.contactPhone ?? null,
          },
        });
        await recordOrgEvent(tx, tenant, 'SITE_CREATED', { siteId: site.id, name: site.name, code: site.code });
        return site;
      }),
    siteCodeTaken,
  );
  return toSiteDTO(site);
}

/**
 * Edits, activates or deactivates a site. Deactivating keeps its open
 * incidents; the incident service refuses new reports on it.
 */
export async function updateSite(tenant: Tenant, siteId: string, input: SiteUpdate): Promise<SiteDTO> {
  const site = await guardUnique(
    () =>
      prisma.$transaction(async (tx) => {
        const current = await tx.site.findFirst({ where: { id: siteId, organizationId: tenant.orgId }, include: siteCounts });
        if (!current) throw notFound('Site');
        const next = {
          code: input.code ?? current.code,
          name: input.name ?? current.name,
          address: nextText(input, 'address', current.address),
          city: nextText(input, 'city', current.city),
          contactName: nextText(input, 'contactName', current.contactName),
          contactPhone: nextText(input, 'contactPhone', current.contactPhone),
          isActive: input.isActive ?? current.isActive,
        };
        const fields = changedFields(siteFields, current, next);
        if (fields.length === 0) return current;
        if (next.code !== current.code) await assertSiteCodeFree(tx, tenant, next.code, current.id);
        const site = await tx.site.update({
          where: { id: current.id, organizationId: tenant.orgId },
          data: next,
          include: siteCounts,
        });
        await recordOrgEvent(tx, tenant, 'SITE_UPDATED', { siteId: site.id, name: site.name, fields });
        return site;
      }),
    siteCodeTaken,
  );
  return siteWithCounts(site);
}

/* Categories */

const categoryInclude = {
  specialty: { select: { id: true, name: true } },
} satisfies Prisma.IncidentCategoryInclude;

const categoryWithCounts = {
  ...categoryInclude,
  _count: { select: { incidents: { where: { status: { not: 'CLOSED' } } } } },
} satisfies Prisma.IncidentCategoryInclude;

type CategoryRow = Prisma.IncidentCategoryGetPayload<{ include: typeof categoryInclude }>;
type CategoryCountedRow = Prisma.IncidentCategoryGetPayload<{ include: typeof categoryWithCounts }>;

const categoryOrder = [{ name: 'asc' }, { id: 'asc' }] satisfies Prisma.IncidentCategoryOrderByWithRelationInput[];

const categoryFields = ['name', 'defaultPriority', 'specialtyId', 'isActive'] as const;

function toCategoryDTO(row: CategoryRow, openIncidents = 0): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    defaultPriority: row.defaultPriority,
    specialty: row.specialty ? { id: row.specialty.id, name: row.specialty.name } : null,
    isActive: row.isActive,
    openIncidents,
  };
}

const categoryWithCount = (row: CategoryCountedRow) => toCategoryDTO(row, row._count.incidents);

const categoryNameTaken = () => fieldConflict('name', messages.categoryName);

/** Names are unique per organization regardless of case, so "Water leak" and "water leak" cannot coexist. */
async function assertCategoryNameFree(tx: Tx, tenant: Tenant, name: string, exceptId?: string) {
  const other = await tx.incidentCategory.findFirst({
    where: {
      organizationId: tenant.orgId,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (other) throw categoryNameTaken();
}

/** Same answer for a missing specialty and one from another organization. */
async function assertSpecialtyInOrg(tx: Tx, tenant: Tenant, specialtyId: string) {
  const specialty = await tx.specialty.findFirst({
    where: { id: specialtyId, organizationId: tenant.orgId },
    select: { id: true },
  });
  if (!specialty) {
    throw new AppError('VALIDATION_FAILED', messages.foreignSpecialty, {
      fields: { specialtyId: [messages.foreignSpecialty] },
    });
  }
}

/** Supervisors get every category with its open incident count; other roles only the active ones. */
export async function listCategories(tenant: Tenant): Promise<CategoryDTO[]> {
  if (tenant.role === 'SUPERVISOR') {
    const rows = await prisma.incidentCategory.findMany({
      where: { organizationId: tenant.orgId },
      include: categoryWithCounts,
      orderBy: categoryOrder,
    });
    return rows.map(categoryWithCount);
  }
  const rows = await prisma.incidentCategory.findMany({
    where: { organizationId: tenant.orgId, isActive: true },
    include: categoryInclude,
    orderBy: categoryOrder,
  });
  return rows.map((row) => toCategoryDTO(row));
}

export async function createCategory(tenant: Tenant, input: CategoryInput): Promise<CategoryDTO> {
  const category = await guardUnique(
    () =>
      prisma.$transaction(async (tx) => {
        await assertCategoryNameFree(tx, tenant, input.name);
        if (input.specialtyId) await assertSpecialtyInOrg(tx, tenant, input.specialtyId);
        const category = await tx.incidentCategory.create({
          data: {
            organizationId: tenant.orgId,
            name: input.name,
            defaultPriority: input.defaultPriority,
            specialtyId: input.specialtyId,
          },
          include: categoryInclude,
        });
        await recordOrgEvent(tx, tenant, 'CATEGORY_CREATED', { categoryId: category.id, name: category.name });
        return category;
      }),
    categoryNameTaken,
  );
  return toCategoryDTO(category);
}

/** Renames, reprioritizes, relinks or (de)activates a category. Incidents already filed keep it. */
export async function updateCategory(tenant: Tenant, categoryId: string, input: CategoryUpdate): Promise<CategoryDTO> {
  const category = await guardUnique(
    () =>
      prisma.$transaction(async (tx) => {
        const current = await tx.incidentCategory.findFirst({
          where: { id: categoryId, organizationId: tenant.orgId },
          include: categoryWithCounts,
        });
        if (!current) throw notFound('Category');
        const next = {
          name: input.name ?? current.name,
          defaultPriority: input.defaultPriority ?? current.defaultPriority,
          // Absent keeps the link, null removes it.
          specialtyId: input.specialtyId === undefined ? current.specialtyId : input.specialtyId,
          isActive: input.isActive ?? current.isActive,
        };
        const fields = changedFields(categoryFields, current, next);
        if (fields.length === 0) return current;
        if (fields.includes('name')) await assertCategoryNameFree(tx, tenant, next.name, current.id);
        if (next.specialtyId && next.specialtyId !== current.specialtyId) {
          await assertSpecialtyInOrg(tx, tenant, next.specialtyId);
        }
        const category = await tx.incidentCategory.update({
          where: { id: current.id, organizationId: tenant.orgId },
          data: next,
          include: categoryWithCounts,
        });
        await recordOrgEvent(tx, tenant, 'CATEGORY_UPDATED', { categoryId: category.id, name: category.name, fields });
        return category;
      }),
    categoryNameTaken,
  );
  return categoryWithCount(category);
}

/* Specialties */

const specialtyCounts = {
  _count: {
    select: {
      intervenants: { where: { membership: { role: 'INTERVENANT', status: 'ACTIVE' } } },
      categories: true,
    },
  },
} satisfies Prisma.SpecialtyInclude;

const specialtyNameTaken = () => fieldConflict('name', messages.specialtyName);

export async function listSpecialties(tenant: Tenant): Promise<SpecialtyDTO[]> {
  const rows = await prisma.specialty.findMany({
    where: { organizationId: tenant.orgId },
    include: specialtyCounts,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    intervenants: row._count.intervenants,
    categories: row._count.categories,
  }));
}

export async function createSpecialty(tenant: Tenant, input: SpecialtyInput): Promise<SpecialtyDTO> {
  const specialty = await guardUnique(
    () =>
      prisma.$transaction(async (tx) => {
        const other = await tx.specialty.findFirst({
          where: { organizationId: tenant.orgId, name: { equals: input.name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (other) throw specialtyNameTaken();
        const specialty = await tx.specialty.create({ data: { organizationId: tenant.orgId, name: input.name } });
        await recordOrgEvent(tx, tenant, 'SPECIALTY_CREATED', { specialtyId: specialty.id, name: specialty.name });
        return specialty;
      }),
    specialtyNameTaken,
  );
  return { id: specialty.id, name: specialty.name, intervenants: 0, categories: 0 };
}

/* Routes */

/** Mounted at /v1/sites. */
export const siteRoutes = Router();

siteRoutes.get('/', async (req, res) => {
  res.json({ data: await listSites(tenantOf(req)) });
});

siteRoutes.post('/', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(siteSchema, req.body);
  const result = await idempotent(req, 'sites.create', async () => ({
    status: 201,
    body: { data: await createSite(tenant, input) },
  }));
  res.status(result.status).json(result.body);
});

siteRoutes.patch('/:id', requireRole('SUPERVISOR'), async (req, res) => {
  const input = parse(updateSiteSchema, req.body);
  res.json({ data: await updateSite(tenantOf(req), parseId(req.params.id, 'Site'), input) });
});

/** Mounted at /v1/categories. */
export const categoryRoutes = Router();

categoryRoutes.get('/', async (req, res) => {
  res.json({ data: await listCategories(tenantOf(req)) });
});

categoryRoutes.post('/', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(categorySchema, req.body);
  const result = await idempotent(req, 'categories.create', async () => ({
    status: 201,
    body: { data: await createCategory(tenant, input) },
  }));
  res.status(result.status).json(result.body);
});

categoryRoutes.patch('/:id', requireRole('SUPERVISOR'), async (req, res) => {
  const input = parse(updateCategorySchema, req.body);
  res.json({ data: await updateCategory(tenantOf(req), parseId(req.params.id, 'Category'), input) });
});

/** Mounted at /v1/specialties. Supervisors only. */
export const specialtyRoutes = Router();
specialtyRoutes.use(requireRole('SUPERVISOR'));

specialtyRoutes.get('/', async (req, res) => {
  res.json({ data: await listSpecialties(tenantOf(req)) });
});

specialtyRoutes.post('/', async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(specialtySchema, req.body);
  const result = await idempotent(req, 'specialties.create', async () => ({
    status: 201,
    body: { data: await createSpecialty(tenant, input) },
  }));
  res.status(result.status).json(result.body);
});
