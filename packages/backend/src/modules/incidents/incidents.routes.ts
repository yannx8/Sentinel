import { Router } from 'express';
import { IncidentsController } from './incidents.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

router.get('/', IncidentsController.listIncidents);
router.get('/:id', IncidentsController.getIncident);
router.post('/', IncidentsController.createIncident);
router.patch('/:id/triage', requireRole('SUPERVISOR'), IncidentsController.triageIncident);
router.post('/:id/verify', requireRole('SUPERVISOR'), IncidentsController.verifyIncident);
router.post('/:id/assign', requireRole('SUPERVISOR'), IncidentsController.assignIncident);
router.post('/:id/resolution', requireRole('INTERVENANT'), IncidentsController.resolveIncident);
router.post('/:id/reject-resolution', requireRole('SUPERVISOR'), IncidentsController.rejectResolution);
router.post('/:id/closure', requireRole('SUPERVISOR'), IncidentsController.closeIncident);
router.post('/:id/progress', requireRole('INTERVENANT'), IncidentsController.addProgress);
router.post('/:id/comments', IncidentsController.addComment);
router.get('/:id/audit', IncidentsController.getAudit);

export default router;
