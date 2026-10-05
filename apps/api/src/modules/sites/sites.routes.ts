import { Router } from 'express';
import { SitesController } from './sites.controller.js';
import { requireRole } from '../../middleware/requireRole.js';

const router = Router();

router.get('/', SitesController.listSites);
router.post('/', requireRole('SUPERVISOR'), SitesController.createSite);
router.patch('/:id', requireRole('SUPERVISOR'), SitesController.updateSite);

export default router;
