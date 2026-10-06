import type { NotificationType } from '@sentinel/shared';
import type { Tx } from './prisma';

type Notice = {
  orgId: string;
  type: NotificationType;
  incidentId: string | null;
  actorMembershipId: string | null;
  actorName: string | null;
  recipients: (string | null | undefined)[];
  /** Distinguishes repeated events of the same type on one incident (F-NTF-02). */
  dedupe: string | number;
};

/** In-app notifications, written in the same transaction as the event. The actor is never notified. */
export async function notify(tx: Tx, notice: Notice) {
  const recipients = [...new Set(notice.recipients.filter((id): id is string => !!id))].filter(
    (id) => id !== notice.actorMembershipId,
  );
  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((recipientMembershipId) => ({
      organizationId: notice.orgId,
      recipientMembershipId,
      type: notice.type,
      incidentId: notice.incidentId,
      actorName: notice.actorName,
      dedupeKey: `${notice.type}:${notice.incidentId ?? '-'}:${notice.dedupe}`,
    })),
    skipDuplicates: true,
  });
}

export async function activeSupervisorIds(tx: Tx, orgId: string): Promise<string[]> {
  const rows = await tx.membership.findMany({
    where: { organizationId: orgId, role: 'SUPERVISOR', status: 'ACTIVE' },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
