import { NextFunction, Request, Response } from 'express';
import { IncidentsService } from './incidents.service.js';
import { createIncident, comment, resolution, reject } from './incidents.schema.js';
import { AppError } from '../../lib/errors.js';

export class IncidentsController {
  static async listIncidents(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        siteId: req.query.siteId,
        categoryId: req.query.categoryId,
        search: req.query.search
      };
      
      const result = await IncidentsService.listIncidents(a, filters, page, limit);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }

  static async getIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const incident = await IncidentsService.getIncident(req.params.id, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async createIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const d = createIncident.parse(req.body);
      const incident = await IncidentsService.createIncident(d, a);
      res.status(201).json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async triageIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const d = createIncident.pick({ category: true, priority: true }).partial().parse(req.body);
      const incident = await IncidentsService.triageIncident(req.params.id, d, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async verifyIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const incident = await IncidentsService.verifyIncident(req.params.id, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async assignIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const assignment = await IncidentsService.assignIncident(req.params.id, req.body.intervenantMembershipId, a);
      res.status(201).json(assignment);
    } catch (e) {
      next(e);
    }
  }

  static async resolveIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const d = resolution.parse(req.body);
      const incident = await IncidentsService.resolveIncident(req.params.id, d.resolutionText, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async rejectResolution(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const d = reject.parse(req.body);
      const incident = await IncidentsService.rejectResolution(req.params.id, d.reason, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async closeIncident(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const incident = await IncidentsService.closeIncident(req.params.id, a);
      res.json(incident);
    } catch (e) {
      next(e);
    }
  }

  static async addProgress(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const progress = await IncidentsService.addProgress(req.params.id, req.body.type, String(req.body.note || ''), a);
      res.status(201).json(progress);
    } catch (e) {
      next(e);
    }
  }

  static async addComment(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const d = comment.parse(req.body);
      const c = await IncidentsService.addComment(req.params.id, d.body, a);
      res.status(201).json(c);
    } catch (e) {
      next(e);
    }
  }

  static async getAudit(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const audit = await IncidentsService.getAudit(req.params.id, a);
      res.json(audit);
    } catch (e) {
      next(e);
    }
  }
}
