import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { NotificationEventType } from '@prisma/client';

/**
 * Creates a notification for a membership. Callers intentionally invoke this outside
 * any DB transaction so that notification failures never block or roll back the
 * primary operation (e.g. incident creation). A best-effort log replaces a
 * throw on failure.
 */
export async function createNotification(
  organizationId: string,
  recipientMembershipId: string,
  eventType: NotificationEventType,
  title: string,
  body: string,
  incidentId?: string
) {
  try {
    await prisma.notification.create({
      data: { organizationId, recipientMembershipId, eventType, title, body, incidentId }
    });
  } catch (err) {
    logger.error('Failed to create notification', { recipientMembershipId, eventType, error: String(err) });
  }
}
