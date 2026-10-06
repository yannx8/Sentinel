import {
  assignSchema,
  closeSchema,
  commentSchema,
  createIncidentSchema,
  dismissSchema,
  listIncidentsQuery,
  sendBackSchema,
  triageSchema,
  unassignSchema,
} from '@sentinel/shared';
import { Router, type Request, type Response } from 'express';
import { requireRole, tenantOf } from '../../auth/context';
import { notFound } from '../../http/errors';
import { idempotent } from '../../http/idempotency';
import { parse } from '../../http/validate';
import {
  addComment,
  assignIncident,
  closeIncident,
  countIncidents,
  createIncident,
  dismissIncident,
  getIncident,
  getThread,
  listCandidates,
  listIncidents,
  sendBackIncident,
  triageIncident,
  unassignIncident,
} from './service';

/** Runs a create or transition once per Idempotency-Key and answers `{ data }`. */
export async function respondOnce(
  req: Request,
  res: Response,
  scope: string,
  status: number,
  run: () => Promise<unknown>,
) {
  const result = await idempotent(req, scope, async () => ({ status, body: { data: await run() } }));
  res.status(result.status).json(result.body);
}

/** The incident id or reference from the URL. findVisibleIncident decides whether it exists for the caller. */
function keyOf(req: Request): string {
  const { key } = req.params;
  if (typeof key !== 'string') throw notFound('Incident');
  return key;
}

export const incidentRoutes = Router();

incidentRoutes.get('/', async (req, res) => {
  const { data, page } = await listIncidents(tenantOf(req), parse(listIncidentsQuery, req.query));
  res.json({ data, page });
});

// Before '/:key', which would otherwise match it.
incidentRoutes.get('/counts', requireRole('SUPERVISOR'), async (req, res) => {
  res.json({ data: await countIncidents(tenantOf(req)) });
});

incidentRoutes.post('/', requireRole('REPORTER', 'SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(createIncidentSchema, req.body);
  await respondOnce(req, res, 'incidents.create', 201, () => createIncident(tenant, input));
});

incidentRoutes.get('/:key', async (req, res) => {
  res.json({ data: await getIncident(tenantOf(req), keyOf(req)) });
});

incidentRoutes.get('/:key/thread', async (req, res) => {
  res.json({ data: await getThread(tenantOf(req), keyOf(req)) });
});

incidentRoutes.get('/:key/candidates', requireRole('SUPERVISOR'), async (req, res) => {
  res.json({ data: await listCandidates(tenantOf(req), keyOf(req)) });
});

incidentRoutes.post('/:key/triage', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(triageSchema, req.body);
  await respondOnce(req, res, 'incidents.triage', 200, () => triageIncident(tenant, key, input));
});

incidentRoutes.post('/:key/assign', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(assignSchema, req.body);
  await respondOnce(req, res, 'incidents.assign', 200, () => assignIncident(tenant, key, input));
});

incidentRoutes.post('/:key/unassign', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(unassignSchema, req.body);
  await respondOnce(req, res, 'incidents.unassign', 200, () => unassignIncident(tenant, key, input));
});

incidentRoutes.post('/:key/close', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(closeSchema, req.body);
  await respondOnce(req, res, 'incidents.close', 200, () => closeIncident(tenant, key, input));
});

incidentRoutes.post('/:key/send-back', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(sendBackSchema, req.body);
  await respondOnce(req, res, 'incidents.send-back', 200, () => sendBackIncident(tenant, key, input));
});

incidentRoutes.post('/:key/dismiss', requireRole('SUPERVISOR'), async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(dismissSchema, req.body);
  await respondOnce(req, res, 'incidents.dismiss', 200, () => dismissIncident(tenant, key, input));
});

incidentRoutes.post('/:key/comments', async (req, res) => {
  const tenant = tenantOf(req);
  const key = keyOf(req);
  const input = parse(commentSchema, req.body);
  await respondOnce(req, res, 'incidents.comment', 201, () => addComment(tenant, key, input));
});
