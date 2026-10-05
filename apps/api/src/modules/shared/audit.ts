import { AuditEventType } from './types.js';

/**
 * Write an audit event within an existing Prisma transaction. Called from service
 * functions that use $transaction to ensure audit writes are atomic with the
 * triggering operation.
 */
export function audit(
  tx: any,
  organizationId: string,
  incidentId: string | undefined,
  actorId: string,
  eventType: AuditEventType,
  payload: any
) {
  return tx.auditEvent.create({
    data: { organizationId, incidentId, actorMembershipId: actorId, eventType, payload }
  });
}
