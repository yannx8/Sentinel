import {
  importEmployeesSchema,
  inviteMemberSchema,
  listMembersQuery,
  memberStatusChangeSchema,
  updateMemberSchema,
} from '@sentinel/shared';
import { Router, type Request, type Response } from 'express';
import { requireOwner, requireRole, tenantOf } from '../../auth/context';
import { idempotent } from '../../http/idempotency';
import { parse, parseId } from '../../http/validate';
import { importEmployees } from './import';
import {
  changeMemberStatus,
  getMember,
  inviteMember,
  listInvitations,
  listMembers,
  resendInvitation,
  revokeInvitation,
  transferOwnership,
  updateMember,
  type MemberStatusAction,
} from './service';

/** Mounted at /v1/members. */
export const memberRoutes = Router();
memberRoutes.use(requireRole('SUPERVISOR'));

memberRoutes.get('/', async (req, res) => {
  const query = parse(listMembersQuery, req.query);
  res.json({ data: await listMembers(tenantOf(req), query) });
});

memberRoutes.post('/import', async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(importEmployeesSchema, req.body);
  const result = await idempotent(req, 'members.import', async () => ({
    status: input.dryRun ? 200 : 201,
    body: { data: await importEmployees(tenant, input) },
  }));
  res.status(result.status).json(result.body);
});

memberRoutes.get('/:id', async (req, res) => {
  res.json({ data: await getMember(tenantOf(req), parseId(req.params.id, 'Member')) });
});

memberRoutes.patch('/:id', async (req, res) => {
  const input = parse(updateMemberSchema, req.body);
  res.json({ data: await updateMember(tenantOf(req), parseId(req.params.id, 'Member'), input) });
});

function statusChange(action: MemberStatusAction) {
  return async (req: Request, res: Response) => {
    const tenant = tenantOf(req);
    const id = parseId(req.params.id, 'Member');
    const { reason } = parse(memberStatusChangeSchema, req.body ?? {});
    const result = await idempotent(req, `members.${action}`, async () => ({
      status: 200,
      body: { data: await changeMemberStatus(tenant, id, action, reason) },
    }));
    res.status(result.status).json(result.body);
  };
}

memberRoutes.post('/:id/suspend', statusChange('suspend'));
memberRoutes.post('/:id/reactivate', statusChange('reactivate'));
memberRoutes.post('/:id/revoke', statusChange('revoke'));

memberRoutes.post('/:id/transfer-ownership', requireOwner, async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Member');
  const result = await idempotent(req, 'members.transfer-ownership', async () => ({
    status: 200,
    body: { data: await transferOwnership(tenant, id) },
  }));
  res.status(result.status).json(result.body);
});

/** Mounted at /v1/invitations. */
export const invitationRoutes = Router();
invitationRoutes.use(requireRole('SUPERVISOR'));

invitationRoutes.get('/', async (req, res) => {
  res.json({ data: await listInvitations(tenantOf(req)) });
});

// Create and resend skip Idempotency-Key replay on purpose: the stored response
// would keep the invitation link in clear. A retried create gets the pending
// invitation conflict instead.
invitationRoutes.post('/', async (req, res) => {
  const input = parse(inviteMemberSchema, req.body);
  res.status(201).json({ data: await inviteMember(tenantOf(req), input) });
});

invitationRoutes.post('/:id/resend', async (req, res) => {
  res.json({ data: await resendInvitation(tenantOf(req), parseId(req.params.id, 'Invitation')) });
});

invitationRoutes.post('/:id/revoke', async (req, res) => {
  const tenant = tenantOf(req);
  const id = parseId(req.params.id, 'Invitation');
  const result = await idempotent(req, 'invitations.revoke', async () => ({
    status: 200,
    body: { data: await revokeInvitation(tenant, id) },
  }));
  res.status(result.status).json(result.body);
});
