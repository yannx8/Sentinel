import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

const router = Router();


router.get('/', async (req: any, res, next) => {
  try {
    const a = req.ctx;
    res.json(await prisma.notification.findMany({ where: { recipientMembershipId: a.membershipId }, orderBy: { createdAt: 'desc' }, take: 50 }));
  } catch (e) {
    next(e);
  }
});

// updateMany returns 0 count if the notification doesn't belong to this user,
// which doubles as an ownership check without a separate SELECT.
router.patch('/:id/read', async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const n = await prisma.notification.updateMany({
      where: { id: req.params.id, recipientMembershipId: a.membershipId },
      data: { readAt: new Date() }
    });
    if (!n.count) throw new AppError('FORBIDDEN', 403, 'Notification not yours');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
