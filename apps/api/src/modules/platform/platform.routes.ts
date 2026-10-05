import { Router } from 'express';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { prisma } from '../../lib/prisma.js';
import { z } from 'zod';
import { OrganizationStatus } from '@prisma/client';

const router = Router();

router.use(requirePlatformAdmin);

router.get('/organizations', async (req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany();
    res.json({ data: orgs });
  } catch (error) {
    next(error);
  }
});

const patchStatusSchema = z.object({
  status: z.nativeEnum(OrganizationStatus),
});

router.patch('/organizations/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = patchStatusSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { status } = parseResult.data;

    const org = await prisma.organization.update({
      where: { id },
      data: { status },
    });

    res.json({ data: org });
  } catch (error) {
    next(error);
  }
});

export default router;
