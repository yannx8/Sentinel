/**
 * Visitor reports through a QR code (docs/IMPLEMENTATIONPLAN-SENTINELV2.md 2.6, D7). The token names the site;
 * the visitor gets a tracking link and nothing else.
 */
import { guestReportSchema, type PublicTrackDTO } from '@sentinel/shared';
import { Router } from 'express';
import { AppError, notFound } from '../http/errors';
import { guestReportLimiter, publicLimiter } from '../http/rate-limit';
import { parse } from '../http/validate';
import { recordIncidentEvent } from '../lib/audit';
import { hashToken, newToken } from '../lib/crypto';
import { activeSupervisorIds, notify } from '../lib/notify';
import { prisma } from '../lib/prisma';
import { resolveToken } from './areas';
import { activeCategory, invalidField, nextReference } from './incidents/service';

const DAILY_CAP_PER_SITE = 50;

/** Mounted at /v1/public/sites. */
export const publicReportRoutes = Router();

publicReportRoutes.post('/:token/reports', guestReportLimiter, async (req, res) => {
  const input = parse(guestReportSchema, req.body);
  // Honeypot: a filled hidden field is a bot. Answer like a success and create nothing.
  if (input.website) {
    res.status(201).json({ data: { reference: 'INC-0000-00000', trackingToken: newToken() } });
    return;
  }
  const { site, area } = await resolveToken(req.params.token as string);
  if (!site.guestReporting) throw notFound('Site');
  if (input.guestPhone && !input.consent)
    throw invalidField('consent', 'Agree to be contacted to share a phone number.');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await prisma.incident.count({
    where: { siteId: site.id, channel: 'QR_GUEST', createdAt: { gte: since } },
  });
  if (today >= DAILY_CAP_PER_SITE)
    throw new AppError('RATE_LIMITED', 'This site cannot take more visitor reports today.');

  const trackingToken = newToken();
  const reference = await prisma.$transaction(async (tx) => {
    const category = await activeCategory(tx, { orgId: site.organizationId }, input.categoryId);
    const reference = await nextReference(tx, site.organizationId, site.organization.timezone);
    const incident = await tx.incident.create({
      data: {
        organizationId: site.organizationId,
        reference,
        siteId: site.id,
        areaId: area?.id ?? null,
        channel: 'QR_GUEST',
        guestName: input.guestName ?? null,
        guestPhone: input.guestPhone ?? null,
        guestConsentAt: input.guestPhone && input.consent ? new Date() : null,
        trackingTokenHash: hashToken(trackingToken),
        title: category.name,
        description: input.description,
        reportedCategoryId: category.id,
        reportedPriority: category.defaultPriority,
        locationDetail: input.locationDetail ?? null,
        categoryId: category.id,
        priority: category.defaultPriority,
      },
    });
    await recordIncidentEvent(tx, { orgId: site.organizationId }, incident.id, 'INCIDENT_CREATED', {
      onBehalfOf: null,
    });
    await notify(tx, {
      orgId: site.organizationId,
      incidentId: incident.id,
      actorMembershipId: null,
      actorName: input.guestName ?? null,
      type: 'INCIDENT_CREATED',
      recipients: await activeSupervisorIds(tx, site.organizationId),
      dedupe: incident.version,
    });
    return reference;
  });
  res.status(201).json({ data: { reference, trackingToken } });
});

/** Mounted at /v1/public/track. The token is the only credential. */
export const publicTrackRoutes = Router();

const trackedEvents = ['ASSIGNED', 'ASSIGNMENT_ACCEPTED', 'RESOLVED', 'CLOSED'] as const;

publicTrackRoutes.get('/:token', publicLimiter, async (req, res) => {
  const incident = await prisma.incident.findUnique({
    where: { trackingTokenHash: hashToken(req.params.token as string) },
    include: { site: { select: { name: true } } },
  });
  if (!incident) throw notFound('Report');
  const events = await prisma.auditEvent.findMany({
    where: { incidentId: incident.id, type: { in: [...trackedEvents] } },
    orderBy: { createdAt: 'asc' },
    select: { type: true, createdAt: true },
  });
  const data: PublicTrackDTO = {
    reference: incident.reference,
    status: incident.status,
    siteName: incident.site.name,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    events: events.map((event) => ({
      type: event.type as PublicTrackDTO['events'][number]['type'],
      createdAt: event.createdAt.toISOString(),
    })),
  };
  res.json({ data });
});
