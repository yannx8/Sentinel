import type { Prisma } from '../generated/prisma/client';
import type { AuditEventType, ThreadEventType, ThreadPayloads } from '@sentinel/shared';
import type { Tenant } from '../auth/context';
import type { Tx } from './prisma';

/** Appends an incident event. It is both the audit record and a Thread entry. */
export function recordIncidentEvent<T extends ThreadEventType>(
  tx: Tx,
  tenant: Pick<Tenant, 'orgId'> & Partial<Pick<Tenant, 'membershipId' | 'userId'>>,
  incidentId: string,
  type: T,
  payload: ThreadPayloads[T],
) {
  return tx.auditEvent.create({
    data: {
      organizationId: tenant.orgId,
      incidentId,
      actorMembershipId: tenant.membershipId ?? null,
      actorUserId: tenant.userId ?? null,
      type,
      payload: payload as Prisma.InputJsonObject,
    },
  });
}

/** Appends an organization event (people, sites, settings). */
export function recordOrgEvent(tx: Tx, tenant: Tenant, type: AuditEventType, payload: Prisma.InputJsonObject) {
  return tx.auditEvent.create({
    data: {
      organizationId: tenant.orgId,
      actorMembershipId: tenant.membershipId,
      actorUserId: tenant.userId,
      type,
      payload,
    },
  });
}
