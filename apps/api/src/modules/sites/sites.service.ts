import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { Site } from '@prisma/client';

export type SiteCreateData = {
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string;
  boundaryType?: 'CIRCLE';
  radiusMeters?: number;
  isActive?: boolean;
};

export type SiteUpdateData = Partial<SiteCreateData>;

function mapSiteToDTO(site: Site & { _count?: { incidents: number } }) {
  return {
    id: site.id,
    name: site.name,
    code: site.code,
    address: site.address,
    latitude: site.latitude,
    longitude: site.longitude,
    timezone: site.timezone,
    boundaryType: site.boundaryType,
    radiusMeters: site.radiusMeters,
    isActive: site.isActive,
    organizationId: site.organizationId,
    createdAt: site.createdAt,
    incidentsCount: site._count?.incidents
  };
}

export class SitesService {
  static async listSites(organizationId: string) {
    const sites = await prisma.site.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { incidents: true } } }
    });
    return sites.map(mapSiteToDTO);
  }

  static async createSite(organizationId: string, data: SiteCreateData) {
    const code = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const site = await prisma.site.create({
      data: {
        name: data.name,
        code,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone || 'UTC',
        boundaryType: data.boundaryType || 'CIRCLE',
        radiusMeters: data.radiusMeters || 250,
        isActive: data.isActive !== false,
        organizationId
      }
    });
    return mapSiteToDTO(site);
  }

  static async updateSite(id: string, organizationId: string, data: SiteUpdateData) {
    const site = await prisma.site.updateMany({
      where: { id, organizationId },
      data
    });
    if (!site.count) throw new AppError('NOT_FOUND', 404, 'Site not found');
    return { ok: true };
  }
}
