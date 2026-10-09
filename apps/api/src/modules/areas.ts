/**
 * Areas and QR tokens (docs/IMPLEMENTATIONPLAN-SENTINELV2.md 2.6). Supervisors manage areas; a token
 * lets anyone with the printed code learn the site it names, nothing more.
 */
import { areaSchema, updateAreaSchema, type AreaDTO, type PublicSiteDTO, type SiteAreasDTO } from '@sentinel/shared';
import { Router } from 'express';
import { tenantOf } from '../auth/context';
import { notFound } from '../http/errors';
import { publicLimiter } from '../http/rate-limit';
import { parse, parseId } from '../http/validate';
import { recordOrgEvent } from '../lib/audit';
import { newToken } from '../lib/crypto';
import { prisma } from '../lib/prisma';

const toAreaDTO = (area: { id: string; name: string; isActive: boolean; publicToken: string }): AreaDTO => ({
  id: area.id,
  name: area.name,
  isActive: area.isActive,
  token: area.publicToken,
});

/** Mounted at /v1/sites/:id/areas, Supervisor only. The site token is created on first use. */
export const areaRoutes = Router({ mergeParams: true });

async function ownSite(orgId: string, id: string) {
  const site = await prisma.site.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, publicToken: true },
  });
  if (!site) throw notFound('Site');
  return site;
}

areaRoutes.get('/', async (req, res) => {
  const tenant = tenantOf(req);
  const site = await ownSite(tenant.orgId, parseId((req.params as Record<string, string>).id, 'Site'));
  const siteToken =
    site.publicToken ??
    (
      await prisma.site.update({
        where: { id: site.id },
        data: { publicToken: newToken() },
        select: { publicToken: true },
      })
    ).publicToken!;
  const areas = await prisma.siteArea.findMany({
    where: { siteId: site.id, organizationId: tenant.orgId },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  });
  const data: SiteAreasDTO = { siteToken, areas: areas.map(toAreaDTO) };
  res.json({ data });
});

areaRoutes.post('/', async (req, res) => {
  const tenant = tenantOf(req);
  const site = await ownSite(tenant.orgId, parseId((req.params as Record<string, string>).id, 'Site'));
  const input = parse(areaSchema, req.body);
  const area = await prisma.$transaction(async (tx) => {
    const created = await tx.siteArea.create({
      data: { organizationId: tenant.orgId, siteId: site.id, name: input.name, publicToken: newToken() },
    });
    await recordOrgEvent(tx, tenant, 'AREA_CREATED', { areaId: created.id, siteId: site.id, name: created.name });
    return created;
  });
  res.status(201).json({ data: toAreaDTO(area) });
});

areaRoutes.patch('/:areaId', async (req, res) => {
  const tenant = tenantOf(req);
  const site = await ownSite(tenant.orgId, parseId((req.params as Record<string, string>).id, 'Site'));
  const areaId = parseId((req.params as Record<string, string>).areaId, 'Area');
  const input = parse(updateAreaSchema, req.body);
  const area = await prisma.$transaction(async (tx) => {
    const current = await tx.siteArea.findFirst({
      where: { id: areaId, siteId: site.id, organizationId: tenant.orgId },
    });
    if (!current) throw notFound('Area');
    const fields = (['name', 'isActive'] as const).filter(
      (key) => input[key] !== undefined && input[key] !== current[key],
    );
    if (fields.length === 0) return current;
    const updated = await tx.siteArea.update({ where: { id: current.id }, data: input });
    await recordOrgEvent(tx, tenant, 'AREA_UPDATED', {
      areaId: updated.id,
      siteId: site.id,
      name: updated.name,
      fields,
    });
    return updated;
  });
  res.json({ data: toAreaDTO(area) });
});

/** Mounted at /v1/areas, any member: the name of an area, scoped to the active organization. */
export const areaLookupRoutes = Router();

areaLookupRoutes.get('/:id', async (req, res) => {
  const tenant = tenantOf(req);
  const area = await prisma.siteArea.findFirst({
    where: { id: parseId(req.params.id, 'Area'), organizationId: tenant.orgId, isActive: true },
    select: { id: true, name: true, siteId: true },
  });
  if (!area) throw notFound('Area');
  res.json({ data: area });
});

/** Mounted at /v1/public/sites. An unknown, inactive or suspended token answers 404, like a cross-tenant id. */
export const publicSiteRoutes = Router();

publicSiteRoutes.get('/:token', publicLimiter, async (req, res) => {
  const token = req.params.token as string;
  const area = await prisma.siteArea.findUnique({
    where: { publicToken: token },
    include: { site: { include: { organization: true } } },
  });
  const site =
    area?.site ?? (await prisma.site.findUnique({ where: { publicToken: token }, include: { organization: true } }));
  const live = site?.isActive && site.organization.status === 'ACTIVE' && (area ? area.isActive : true);
  if (!site || !live) throw notFound('Site');
  const data: PublicSiteDTO = {
    organizationId: site.organizationId,
    organizationName: site.organization.displayName,
    siteId: site.id,
    siteName: site.name,
    areaId: area?.id ?? null,
    areaName: area?.name ?? null,
    guestReporting: site.guestReporting,
  };
  res.json({ data });
});
