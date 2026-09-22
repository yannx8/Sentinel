import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { requireRole } from '../../middleware/requireRole.js';
import { createIncident, comment, resolution, reject } from './incidents.schema.js';
import { assertTransition } from './incident-lifecycle.js';
import { audit } from '../shared/audit.js';
import { createNotification } from '../notifications/notifications.service.js';

const router = Router();

function ctx(req: any) {
  if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication required');
  return req.auth;
}

/**
 * Returns a Prisma `where` clause scoped to the caller's visibility.
 *
 * - ADMINISTRATOR: sees all incidents in their organization.
 * - RESPONSABLE: sees incidents that have at least one assignment linked to their
 *   responsable profile. This deliberately includes historical (ended) assignments
 *   so responsable users retain audit trail visibility of past work.
 * - USER: sees only incidents they personally reported.
 */
function incidentScope(a: any) {
  if (a.roles.includes('ADMINISTRATOR')) return { organizationId: a.organizationId };
  if (a.roles.includes('RESPONSABLE'))
    return {
      organizationId: a.organizationId,
      assignments: { some: { responsable: { userId: a.userId } } }
    };
  return { organizationId: a.organizationId, reporterId: a.userId };
}

async function getOrgIncident(req: any) {
  const a = req.auth!;
  const i = await prisma.incident.findFirst({ where: { id: req.params.id, organizationId: a.organizationId } });
  if (!i) throw new AppError('FORBIDDEN_TENANT', 403, 'Resource belongs to another tenant');
  return { a, i };
}

router.get('/', async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const where: any = { ...incidentScope(a) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.siteId) where.siteId = req.query.siteId;
    if (req.query.category) where.category = req.query.category;
    if (req.query.search)
      where.OR = [
        { title: { contains: req.query.search, mode: 'insensitive' } },
        { description: { contains: req.query.search, mode: 'insensitive' } }
      ];
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const items = await prisma.incident.findMany({
      where,
      include: {
        site: true,
        reporter: true,
        assignments: { include: { responsable: { include: { user: true } } } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });
    const total = await prisma.incident.count({ where });
    res.json({ items, total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const i = await prisma.incident.findFirst({
      where: { id: req.params.id, ...incidentScope(a) },
      include: {
        site: true,
        reporter: true,
        assignments: { include: { responsable: { include: { user: true } } } },
        progress: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        attachments: true,
        auditEvents: { include: { actor: true }, orderBy: { createdAt: 'asc' } }
      }
    });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    res.json(i);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: any, res, next) => {
  try {
    const a = ctx(req);
    if (!a.roles.includes('USER') || !(await prisma.user.findUnique({ where: { id: a.userId } }))?.isVerified)
      throw new AppError('ACCOUNT_UNVERIFIED', 403, 'Verified account required');
    const d = createIncident.parse(req.body);
    const site = await prisma.site.findFirst({
      where: { id: d.siteId, organizationId: a.organizationId, isActive: true }
    });
    if (!site) throw new AppError('FORBIDDEN_TENANT', 403, 'Site is not available');
    const i = await prisma.$transaction(async (tx: any) => {
      const x = await tx.incident.create({
        data: { ...d, latitude: d.latitude ?? 0, longitude: d.longitude ?? 0, locationSource: d.locationSource ?? 'GPS', organizationId: a.organizationId, reporterId: a.userId }
      });
      await audit(tx, x.id, a.userId, 'CREATED', { status: 'NEW' });
      return x;
    });
    res.status(201).json(i);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/triage', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const { a, i } = await getOrgIncident(req);
    const d = createIncident.pick({ category: true, priority: true }).partial().parse(req.body);
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident is read-only');
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({ where: { id: i.id }, data: d });
      await audit(tx, i.id, a.userId, 'TRIAGE', d);
      return n;
    });
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/verify', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const { a, i } = await getOrgIncident(req);
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({ where: { id: i.id }, data: { verifiedAt: new Date() } });
      await audit(tx, i.id, a.userId, 'VERIFIED', {});
      return n;
    });
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/assign', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const { a, i } = await getOrgIncident(req);
    if (i.status !== 'NEW') throw new AppError('CONFLICT_STATE', 409, 'Incident must be NEW');
    const r = await prisma.responsableProfile.findFirst({
      where: { id: req.body.responsableProfileId, organizationId: a.organizationId, isActive: true }
    });
    if (!r) throw new AppError('FORBIDDEN_TENANT', 403, 'Responsable not in tenant');
    const x = await prisma.$transaction(async (tx: any) => {
      // Optimistic concurrency via updateMany: the WHERE clause includes both the
      // current version and expected status, so concurrent assigns are rejected
      // (count === 0) without a pessimistic lock. The version is bumped on success
      // so subsequent writes must re-read the fresher row.
      const n = await tx.incident.updateMany({
        where: { id: i.id, version: i.version, status: 'NEW' },
        data: { status: 'ASSIGNED', version: { increment: 1 } }
      });
      if (!n.count) throw new AppError('CONFLICT_CONCURRENT_UPDATE', 409, 'Incident changed concurrently');
      const as = await tx.assignment.create({
        data: { incidentId: i.id, responsableProfileId: r.id, assignedById: a.userId }
      });
      await audit(tx, i.id, a.userId, 'ASSIGNMENT', { responsableProfileId: r.id });
      return as;
    });
    createNotification(r.userId, 'ASSIGNMENT', 'Nouvelle assignation', `Vous avez été assigné à l'incident ${i.title}`, i.id);
    res.status(201).json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/resolution', requireRole('RESPONSABLE'), async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const d = resolution.parse(req.body);
    const i = await prisma.incident.findFirst({
      where: {
        id: req.params.id,
        organizationId: a.organizationId,
        assignments: { some: { isActive: true, responsable: { userId: a.userId }, status: 'ACCEPTED' } }
      }
    });
    if (!i) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Not the active assigned Responsable');
    // Lifecycle gate: only IN_PROGRESS incidents can be resolved (via assertTransition).
    // The route also checks for an ACTIVE, ACCEPTED assignment above, so a responsable
    // who was reassigned mid-flight cannot close someone else's work.
    assertTransition(i.status, 'RESOLVED');
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'RESOLVED', resolutionText: d.resolutionText, version: { increment: 1 } }
      });
      await audit(tx, i.id, a.userId, 'RESOLUTION', { resolutionText: d.resolutionText });
      return n;
    });
    const admins = await prisma.organizationMembership.findMany({
      where: { organizationId: a.organizationId, roles: { has: 'ADMINISTRATOR' }, status: 'ACTIVE' }
    });
    for (const admin of admins) {
      createNotification(admin.userId, 'RESOLUTION', 'Résolution soumise', `L'incident ${i.title} attend votre vérification`, i.id);
    }
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/reject-resolution', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const { a, i } = await getOrgIncident(req);
    const d = reject.parse(req.body);
    assertTransition(i.status, 'IN_PROGRESS');
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'IN_PROGRESS', version: { increment: 1 } }
      });
      await audit(tx, i.id, a.userId, 'REJECTED', { reason: d.reason });
      return n;
    });
    const assignment = await prisma.assignment.findFirst({
      where: { incidentId: i.id, isActive: true },
      include: { responsable: { include: { user: true } } }
    });
    if (assignment) {
      createNotification(assignment.responsable.userId, 'REJECTED', 'Résolution rejetée', `La résolution de l'incident ${i.title} a été rejetée: ${d.reason}`, i.id);
    }
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/closure', requireRole('ADMINISTRATOR'), async (req: any, res, next) => {
  try {
    const { a, i } = await getOrgIncident(req);
    assertTransition(i.status, 'CLOSED');
    const x = await prisma.$transaction(async (tx: any) => {
      const n = await tx.incident.update({
        where: { id: i.id },
        data: { status: 'CLOSED', version: { increment: 1 } }
      });
      await audit(tx, i.id, a.userId, 'CLOSED', {});
      return n;
    });
    createNotification(i.reporterId, 'CLOSED', 'Incident clôturé', `Votre incident ${i.title} a été clôturé`, i.id);
    res.json(x);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/progress', requireRole('RESPONSABLE'), async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const i = await prisma.incident.findFirst({
      where: {
        id: req.params.id,
        organizationId: a.organizationId,
        assignments: { some: { isActive: true, status: 'ACCEPTED', responsable: { userId: a.userId } } }
      }
    });
    if (!i) throw new AppError('FORBIDDEN_NOT_ASSIGNED', 403, 'Not assigned');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident');
    // Progress types are a closed enum rather than free text: enforced here and on the
    // frontend so the progress timeline is filterable and machine-readable.
    const type = req.body.type;
    if (!['STARTED', 'ON_SITE', 'BLOCKED', 'UPDATE'].includes(type))
      throw new AppError('VALIDATION_ERROR', 400, 'Invalid progress type');
    const note = String(req.body.note || '').trim();
    if (note.length < 1 || note.length > 3000) throw new AppError('VALIDATION_ERROR', 400, 'Invalid progress note');
    const p = await prisma.$transaction(async (tx: any) => {
      const x = await tx.progressUpdate.create({
        data: { incidentId: i.id, authorId: a.userId, type, note }
      });
      await audit(tx, i.id, a.userId, 'PROGRESS', { type });
      return x;
    });
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/comments', async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const i = await prisma.incident.findFirst({ where: { id: req.params.id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident');
    const d = comment.parse(req.body);
    const c = await prisma.$transaction(async (tx: any) => {
      const x = await tx.comment.create({
        data: { incidentId: i.id, authorId: a.userId, body: d.body },
        include: { author: true }
      });
      await audit(tx, i.id, a.userId, 'COMMENT', {});
      return x;
    });
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/audit', async (req: any, res, next) => {
  try {
    const a = ctx(req);
    const i = await prisma.incident.findFirst({ where: { id: req.params.id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    res.json(await prisma.auditEvent.findMany({ where: { incidentId: i.id }, include: { actor: true }, orderBy: { createdAt: 'asc' } }));
  } catch (e) {
    next(e);
  }
});

export { incidentScope };
export default router;
