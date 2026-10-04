import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

import { getAuth } from '@clerk/express';
function ctx(req: any) {
  const auth = getAuth(req);
  if (!auth.userId || !auth.orgId) throw new AppError('AUTH_REQUIRED', 401, 'Authentication required');
  return { organizationId: auth.orgId, userId: auth.userId };
}

// Dashboard aggregates are all independent read-only queries against the same
// org scope. Promise.all lets the database resolve them concurrently rather
// than serially, which matters when each query touches the incidents table.
router.get('/', requireRole('SUPERVISOR'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const where = { organizationId: a.orgId };

    const [all, active, critical, toReview, closed, statuses, priorities, categories, recentTrend] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.count({ where: { ...where, status: { not: 'CLOSED' } } }),
      prisma.incident.count({ where: { ...where, priority: 'CRITICAL', status: { not: 'CLOSED' } } }),
      prisma.incident.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.incident.count({ where: { ...where, status: 'CLOSED' } }),
      prisma.incident.groupBy({ by: ['status'], where, _count: true }),
      prisma.incident.groupBy({ by: ['priority'], where, _count: true }),
      prisma.incident.groupBy({ by: ['categoryId'], where, _count: true }),
      getRecentTrend(where)
    ]);

    res.json({ all, active, critical, toReview, closed, statuses, priorities, categories, recentTrend });
  } catch (e) {
    next(e);
  }
});

// Iterates the last 7 days and counts incidents per day sequentially.
// Kept serial rather than parallelized because the day-range calculation is
// order-dependent and the dataset is small (7 queries max).
async function getRecentTrend(where: any) {
  const now = new Date();
  const days = 7;
  const trend = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const count = await prisma.incident.count({
      where: {
        ...where,
        createdAt: { gte: start, lt: end }
      }
    });

    trend.push({
      date: start.toISOString().slice(0, 10),
      count
    });
  }

  return trend;
}

export default router;
