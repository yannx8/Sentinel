import {
  declineSchema,
  progressSchema,
  rejectReassignmentSchema,
  requestReassignmentSchema,
  resolveSchema,
} from '@sentinel/shared';
import { Router } from 'express';
import { requireRole, tenantOf } from '../../auth/context';
import { parse, parseId } from '../../http/validate';
import { respondOnce } from './routes';
import {
  acceptAssignment,
  declineAssignment,
  listReassignmentRequests,
  postProgress,
  rejectReassignment,
  requestReassignment,
  resolveAssignment,
} from './service';

/** The assignee's side of an assignment. Each action answers the case file as the intervenant now sees it. */
export const assignmentRoutes = Router();

assignmentRoutes.post('/:id/accept', requireRole('INTERVENANT'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Assignment');
  await respondOnce(req, res, 'assignments.accept', 200, () => acceptAssignment(tenant, id));
});

assignmentRoutes.post('/:id/decline', requireRole('INTERVENANT'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Assignment');
  const input = parse(declineSchema, req.body);
  await respondOnce(req, res, 'assignments.decline', 200, () => declineAssignment(tenant, id, input));
});

assignmentRoutes.post('/:id/request-reassignment', requireRole('INTERVENANT'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Assignment');
  const input = parse(requestReassignmentSchema, req.body);
  await respondOnce(req, res, 'assignments.request-reassignment', 200, () => requestReassignment(tenant, id, input));
});

assignmentRoutes.post('/:id/progress', requireRole('INTERVENANT'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Assignment');
  const input = parse(progressSchema, req.body);
  await respondOnce(req, res, 'assignments.progress', 200, () => postProgress(tenant, id, input));
});

assignmentRoutes.post('/:id/resolve', requireRole('INTERVENANT'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Assignment');
  const input = parse(resolveSchema, req.body);
  await respondOnce(req, res, 'assignments.resolve', 200, () => resolveAssignment(tenant, id, input));
});

/** The supervisor queue of reassignment requests. Approving one is a reassign: POST /incidents/:key/assign. */
export const reassignmentRoutes = Router();

reassignmentRoutes.get('/', requireRole('SUPERVISOR'), async (req, res) => {
  res.json({ data: await listReassignmentRequests(tenantOf(req)) });
});

reassignmentRoutes.post('/:assignmentId/reject', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.assignmentId, 'Reassignment request');
  const input = parse(rejectReassignmentSchema, req.body);
  await respondOnce(req, res, 'reassignments.reject', 200, () => rejectReassignment(tenant, id, input));
});
