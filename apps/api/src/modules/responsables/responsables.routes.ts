import { Router } from 'express';
import { MembershipRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();


router.get('/', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    res.json(
      await prisma.intervenantProfile.findMany({
        where: { organizationId: a.orgId },
        include: {
          membership: {
            include: {
              user: true,
              specialties: { include: { specialty: true } },
              siteAccesses: { include: { site: true } }
            }
          }
        }
      })
    );
  } catch (e) {
    next(e);
  }
});

// Catalog of specialty names used in the team form (deduplicated)
router.get('/specialties', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    res.json(await prisma.specialty.findMany({ where: { organizationId: a.orgId }, orderBy: { name: 'asc' } }));
  } catch (e) {
    next(e);
  }
});

// Org members that can be promoted to intervenants (excludes existing intervenants)
router.get('/candidates', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const existing = await prisma.intervenantProfile.findMany({
      where: { organizationId: a.orgId },
      select: { membershipId: true }
    });
    const existingMembershipIds = existing.map((r) => r.membershipId);
    const members = await prisma.membership.findMany({
      where: { organizationId: a.orgId, status: 'ACTIVE', id: { notIn: existingMembershipIds } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { user: { firstName: 'asc' } }
    });
    res.json(members.map((m) => m.user));
  } catch (e) {
    next(e);
  }
});

// Update intervenant: toggle active, assign specialties and sites (by id arrays)
router.patch('/:id', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const b = req.body as any;
    const existing = await prisma.intervenantProfile.findFirst({
      where: { membershipId: req.params.id, organizationId: a.orgId }
    });
    if (!existing) throw new AppError('NOT_FOUND', 404, 'Intervenant not found');

    await prisma.$transaction(async (tx: any) => {
      if (Array.isArray(b.specialtyIds)) {
        await tx.intervenantSpecialty.deleteMany({ where: { membershipId: existing.membershipId } });
        for (const sid of b.specialtyIds) {
          const spec = await tx.specialty.findFirst({ where: { id: sid, organizationId: a.orgId } });
          if (spec) await tx.intervenantSpecialty.create({ data: { membershipId: existing.membershipId, specialtyId: sid, organizationId: a.orgId } });
        }
      }
      if (Array.isArray(b.siteIds)) {
        await tx.siteAccess.deleteMany({ where: { membershipId: existing.membershipId } });
        for (const sid of b.siteIds) {
          const site = await tx.site.findFirst({ where: { id: sid, organizationId: a.orgId } });
          if (site) await tx.siteAccess.create({ data: { membershipId: existing.membershipId, siteId: sid, organizationId: a.orgId } });
        }
      }
    });
    const updated = await prisma.intervenantProfile.findUnique({
      where: { membershipId: existing.membershipId },
      include: {
        membership: {
          include: {
            user: true,
            specialties: { include: { specialty: true } },
            siteAccesses: { include: { site: true } }
          }
        }
      }
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Create specialty (used by team form when typing a new specialty name)
router.post('/specialties', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 60) throw new AppError('VALIDATION_ERROR', 400, 'Invalid specialty name');
    const existing = await prisma.specialty.findFirst({ where: { organizationId: a.orgId, name } });
    if (existing) return res.status(200).json(existing);
    const s = await prisma.specialty.create({
      data: { organizationId: a.orgId, name }
    });
    res.status(201).json(s);
  } catch (e) {
    next(e);
  }
});

// Upsert creates or adds an intervenant profile for a membership. The membership role
// is set to INTERVENANT to enable assignment. The membershipId serves as the profile PK.
router.post('/', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const { membershipId } = req.body;
    if (typeof membershipId !== 'string') throw new AppError('VALIDATION_ERROR', 400, 'membershipId required');
    const membership = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId: a.orgId, status: 'ACTIVE' }
    });
    if (!membership)
      throw new AppError('FORBIDDEN_TENANT', 403, 'User is not an active member of this organization');
    const r = await prisma.intervenantProfile.upsert({
      where: { membershipId: membership.id },
      create: { membershipId: membership.id, organizationId: a.orgId },
      update: {}
    });
    // Set role to INTERVENANT if not already set.
    if (membership.role !== MembershipRole.INTERVENANT) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { role: MembershipRole.INTERVENANT }
      });
    }
    res.status(201).json(r);
  } catch (e) {
    next(e);
  }
});

export default router;
