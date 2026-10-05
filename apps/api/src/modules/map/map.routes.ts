import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { incidentScope } from '../incidents/incidents.service.js';

const router = Router();


// Single endpoint returns both sites and incidents for the map view.
// Sites are org-wide (all org sites shown as reference points).
// Incidents use incidentScope to respect the user's role-based visibility
// (e.g. responsables see only their assigned incidents).
router.get('/data', async (req: any, res, next) => {
  try {
    const a = req.ctx;
    res.json({
      sites: await prisma.site.findMany({ where: { organizationId: a.orgId } }),
      incidents: await prisma.incident.findMany({
        where: incidentScope(a),
        select: { id: true, title: true, status: true, priority: true, latitude: true, longitude: true }
      })
    });
  } catch (e) {
    next(e);
  }
});

export default router;
