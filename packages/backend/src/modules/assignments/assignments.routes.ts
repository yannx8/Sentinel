import { Router } from 'express';
import { AssignmentsController } from './assignments.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

router.post('/:id/accept', requireRole('INTERVENANT'), AssignmentsController.acceptAssignment);
router.post('/:id/reassignment-request', requireRole('INTERVENANT'), AssignmentsController.requestReassignment);

export default router;
