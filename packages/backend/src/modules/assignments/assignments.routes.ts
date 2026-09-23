import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { requireRole } from '../../middleware/requireRole.js';
import { audit } from '../shared/audit.js';

const router = Router();

function ctx(req: any) {
  if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication required');
  return req.auth;
}

/** Verifies the responsable is actively assigned to the incident's site.
 *  This prevents cross-site assignments where a responsable lacks local context. */
async function assertResponsableEligible(prisma: any, responsableId: string, siteId: string, organizationId: string) {
  const siteAssignment = await prisma.responsableSite.findFirst({
    where: { responsableProfileId: responsableId, siteId, isActive: true }
  });
  if (!siteAssignment) {
    throw new AppError('FORBIDDEN_NOT_ELIGIBLE', 403, 'Responsable is not assigned to this site');
  }
}

router.post('/incidents/:id/assignments', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const i = await prisma.incident.findFirst({
      where: { id: req.params.id, organizationId: a.organizationId }
    });
    if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident is read-only');
    if (!['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(i.status))
      throw new AppError('CONFLICT_STATE', 409, 'Incident cannot be reassigned in current status');

    const responsableId = req.body.responsableProfileId;
    if (typeof responsableId !== 'string') throw new AppError('VALIDATION_ERROR', 400, 'responsableProfileId required');

    const r = await prisma.responsableProfile.findFirst({
      where: { id: responsableId, organizationId: a.organizationId, isActive: true }
    });
    if (!r) throw new AppError('FORBIDDEN_TENANT', 403, 'Responsable not in tenant');

    await assertResponsableEligible(prisma, responsableId, i.siteId, a.organizationId);

    const x = await prisma.$transaction(async (tx: any) => {
      // Deactivate ALL current active assignments for this incident before creating
      // the new one. Using updateMany (not delete) preserves the audit trail: the old
      // assignment is soft-deleted with an endedAt timestamp.
      await tx.assignment.updateMany({
        where: { incidentId: i.id, isActive: true },
        data: { isActive: false, endedAt: new Date() }
      });
      const as = await tx.assignment.create({
        data: { incidentId: i.id, responsableProfileId: responsableId, assignedById: a.userId }
      });
      // Only transition NEW -> ASSIGNED on first assignment. Reassignment from
      // ASSIGNED or IN_PROGRESS does not change incident status; the responsable
      // who accepts the new assignment will move it to IN_PROGRESS later.
      if (i.status === 'NEW') {
        // Optimistic concurrency: version check prevents two admins from
        // racing on the same NEW incident.
        await tx.incident.updateMany({
          where: { id: i.id, version: i.version, status: 'NEW' },
          data: { status: 'ASSIGNED', version: { increment: 1 } }
        });
      }
      await audit(tx, i.id, a.userId, 'ASSIGNMENT', { responsableProfileId: responsableId });
      return as;
    });
    res.status(201).json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/accept', requireRole('RESPONSABLE'), async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const as = await prisma.assignment.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
        responsable: { userId: a.userId },
        incident: { organizationId: a.organizationId }
      },
      include: { incident: true }
    });
    if (!as) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Assignment not assigned to you');
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.assignment.update({ where: { id: as.id }, data: { status: 'ACCEPTED' } });
      // Accepting moves the incident from ASSIGNED to IN_PROGRESS. The assignment
      // status and incident status are updated atomically: if either fails, both roll back.
      await tx.incident.update({ where: { id: as.incidentId }, data: { status: 'IN_PROGRESS', version: { increment: 1 } } });
      await audit(tx, as.incidentId, a.userId, 'STATUS', { from: 'ASSIGNED', to: 'IN_PROGRESS' });
      return n;
    });
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reassign', requireRole('RESPONSABLE'), async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5 || reason.length > 500)
      throw new AppError('VALIDATION_ERROR', 400, 'Reason must be 5-500 chars');
    const as = await prisma.assignment.findFirst({
      where: {
        id: req.params.id,
        isActive: true,
        responsable: { userId: a.userId },
        incident: { organizationId: a.organizationId }
      },
      include: { incident: true }
    });
    if (!as) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Assignment not assigned to you');
    // Reassignment is a REQUEST, not an immediate handoff. The assignment enters
    // REASSIGNMENT_REQUESTED status so an administrator can review and reassign
    // without losing the reason/request audit trail. The incident stays in its
    // current status; the admin creates a new assignment via the admin route.
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.assignment.update({
        where: { id: as.id },
        data: { status: 'REASSIGNMENT_REQUESTED', reassignReason: reason }
      });
      await audit(tx, as.incidentId, a.userId, 'REASSIGNMENT', { reason });
      return n;
    });
    res.json(x);
  } catch (e) {
    next(e);
  }
});

export default router;
