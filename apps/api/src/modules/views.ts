import { savedViewSchema, type SavedViewDTO } from '@sentinel/shared';
import type { SavedView } from '@prisma/client';
import { Router } from 'express';
import { requireRole, tenantOf } from '../auth/context';
import { AppError, notFound } from '../http/errors';
import { parse, parseId } from '../http/validate';
import { prisma } from '../lib/prisma';

/** A supervisor's own saved inbox filters. Always scoped to their membership. */
export const viewRoutes = Router();
viewRoutes.use(requireRole('SUPERVISOR'));

const MAX_VIEWS = 20;

const toDto = (row: SavedView): SavedViewDTO => ({
  id: row.id,
  name: row.name,
  params: row.params as Record<string, string>,
  createdAt: row.createdAt.toISOString(),
});

viewRoutes.get('/', async (req, res) => {
  const tenant = tenantOf(req);
  const rows = await prisma.savedView.findMany({
    where: { organizationId: tenant.orgId, membershipId: tenant.membershipId },
    orderBy: { name: 'asc' },
  });
  res.json({ data: rows.map(toDto) });
});

viewRoutes.post('/', async (req, res) => {
  const tenant = tenantOf(req);
  const input = parse(savedViewSchema, req.body);
  const where = { organizationId: tenant.orgId, membershipId: tenant.membershipId };
  if ((await prisma.savedView.count({ where })) >= MAX_VIEWS) {
    throw new AppError('CONFLICT', `You can keep up to ${MAX_VIEWS} saved views. Delete one first.`);
  }
  const row = await prisma.savedView.create({ data: { ...where, name: input.name, params: input.params } });
  res.status(201).json({ data: toDto(row) });
});

viewRoutes.delete('/:id', async (req, res) => {
  const tenant = tenantOf(req);
  const { count } = await prisma.savedView.deleteMany({
    where: {
      id: parseId(req.params.id, 'View'),
      organizationId: tenant.orgId,
      membershipId: tenant.membershipId,
    },
  });
  if (count === 0) throw notFound('View');
  res.json({ data: { id: req.params.id } });
});
