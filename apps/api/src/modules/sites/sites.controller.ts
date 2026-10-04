import { NextFunction, Request, Response } from 'express';
import { SitesService, SiteCreateData, SiteUpdateData } from './sites.service.js';
import { AppError } from '../../lib/errors.js';

function perimeterData(body: any) {
  const boundaryType = body.boundaryType === undefined ? undefined : String(body.boundaryType);
  const radiusMeters = body.radiusMeters === undefined || body.radiusMeters === null ? undefined : Number(body.radiusMeters);
  if (boundaryType !== undefined && boundaryType !== 'CIRCLE') {
    throw new AppError('VALIDATION_ERROR', 400, 'Only circular site perimeters are supported');
  }
  if (radiusMeters !== undefined && (!Number.isFinite(radiusMeters) || radiusMeters < 25 || radiusMeters > 5000)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Site perimeter radius must be between 25 and 5000 meters');
  }
  return { boundaryType: boundaryType as 'CIRCLE' | undefined, radiusMeters };
}

export class SitesController {
  static async listSites(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const sites = await SitesService.listSites(a.orgId);
      res.json(sites);
    } catch (e) {
      next(e);
    }
  }

  static async createSite(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const b = req.body as any;
      const name = String(b.name || '').trim();
      const address = b.address == null ? null : String(b.address).trim();
      const latitude = Number(b.latitude);
      const longitude = Number(b.longitude);
      const perimeter = perimeterData(b);

      if (
        name.length < 2 ||
        name.length > 150 ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid site data');
      }

      const data: SiteCreateData = {
        name,
        address,
        latitude,
        longitude,
        timezone: b.timezone,
        boundaryType: perimeter.boundaryType,
        radiusMeters: perimeter.radiusMeters,
        isActive: b.isActive !== false,
      };

      const site = await SitesService.createSite(a.orgId, data);
      res.status(201).json(site);
    } catch (e) {
      next(e);
    }
  }

  static async updateSite(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const b = req.body as any;
      const data: SiteUpdateData = {};
      const perimeter = perimeterData(b);
      
      if (b.name !== undefined) {
        const name = String(b.name).trim();
        if (name.length < 2 || name.length > 150) throw new AppError('VALIDATION_ERROR', 400, 'Invalid site name');
        data.name = name;
      }
      if (b.address !== undefined) data.address = b.address == null ? null : String(b.address).trim();
      if (b.latitude !== undefined) {
        data.latitude = Number(b.latitude);
        if (!Number.isFinite(data.latitude) || data.latitude < -90 || data.latitude > 90)
          throw new AppError('VALIDATION_ERROR', 400, 'Invalid latitude');
      }
      if (b.longitude !== undefined) {
        data.longitude = Number(b.longitude);
        if (!Number.isFinite(data.longitude) || data.longitude < -180 || data.longitude > 180)
          throw new AppError('VALIDATION_ERROR', 400, 'Invalid longitude');
      }
      if (b.isActive !== undefined) data.isActive = Boolean(b.isActive);
      if (perimeter.boundaryType !== undefined) data.boundaryType = perimeter.boundaryType;
      if (perimeter.radiusMeters !== undefined) data.radiusMeters = perimeter.radiusMeters;

      await SitesService.updateSite(req.params.id, a.orgId, data);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
}
