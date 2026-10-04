import { NextFunction, Request, Response } from 'express';
import { AssignmentsService } from './assignments.service.js';
import { AppError } from '../../lib/errors.js';

export class AssignmentsController {
  static async acceptAssignment(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const assignment = await AssignmentsService.acceptAssignment(req.params.id, a.membershipId, a.orgId);
      res.json(assignment);
    } catch (e) {
      next(e);
    }
  }

  static async requestReassignment(req: any, res: Response, next: NextFunction) {
    try {
      const a = req.ctx;
      const reason = String(req.body.reason || '').trim();
      if (reason.length < 5 || reason.length > 500) {
        throw new AppError('VALIDATION_ERROR', 400, 'Reason must be 5-500 chars');
      }
      
      const assignment = await AssignmentsService.requestReassignment(req.params.id, a.membershipId, a.orgId, reason);
      res.json(assignment);
    } catch (e) {
      next(e);
    }
  }
}
