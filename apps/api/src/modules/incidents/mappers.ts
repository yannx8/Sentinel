/**
 * Prisma shapes and pure mappers from incident rows to the shared DTOs.
 * Viewer-dependent fields (phones, notes, actions) are decided here, in one place.
 */
import type { Prisma } from '@prisma/client';
import {
  incidentActions,
  isLiveAssignment,
  liveAssignmentStatuses,
  type AssignmentStatus,
  type AttachmentDTO,
  type IncidentDetail,
  type IncidentListItem,
  type LiveAssignmentDTO,
  type LiveAssignmentStatus,
  type PersonRef,
} from '@sentinel/shared';
import type { Tenant } from '../../auth/context';

export const liveStatuses = [...liveAssignmentStatuses];

export const personSelect = {
  id: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.MembershipSelect;

type PersonRow = { id: string; user: { firstName: string; lastName: string } };

export function personRef(membership: PersonRow): PersonRef {
  return { membershipId: membership.id, name: `${membership.user.firstName} ${membership.user.lastName}` };
}

export const incidentListInclude = {
  organization: { select: { id: true, displayName: true } },
  site: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true } },
  reporter: { select: personSelect },
  // At most one row: one live assignment per incident (I4).
  assignments: {
    where: { status: { in: liveStatuses } },
    take: 1,
    select: { id: true, status: true, intervenant: { select: personSelect } },
  },
} satisfies Prisma.IncidentInclude;

export type IncidentListRow = Prisma.IncidentGetPayload<{ include: typeof incidentListInclude }>;

export const incidentDetailInclude = {
  organization: { select: { id: true, displayName: true } },
  site: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true } },
  reportedCategory: { select: { id: true, name: true } },
  reporter: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
  assignments: {
    where: { status: { in: liveStatuses } },
    take: 1,
    include: {
      intervenant: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
          intervenantProfile: { select: { companyName: true } },
        },
      },
      assignedBy: { select: personSelect },
    },
  },
  attachments: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { uploadedBy: { select: personSelect } },
  },
} satisfies Prisma.IncidentInclude;

export type IncidentDetailRow = Prisma.IncidentGetPayload<{ include: typeof incidentDetailInclude }>;

/** The live assignment among `assignments`, with its status narrowed. */
export function liveOf<A extends { status: AssignmentStatus }>(
  assignments: readonly A[],
): (A & { status: LiveAssignmentStatus }) | null {
  for (const assignment of assignments) {
    const { status } = assignment;
    if (isLiveAssignment(status)) return { ...assignment, status };
  }
  return null;
}

export function toListItem(row: IncidentListRow): IncidentListItem {
  const live = liveOf(row.assignments);
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    priority: row.priority,
    triaged: row.triagedAt !== null,
    site: { id: row.site.id, code: row.site.code, name: row.site.name },
    category: { id: row.category.id, name: row.category.name },
    reporter: personRef(row.reporter),
    assignee: live ? { ...personRef(live.intervenant), assignmentId: live.id, status: live.status } : null,
    flags: {
      declined: row.status === 'NEW' && row.declinedAt !== null,
      reassignmentRequested: live?.status === 'REASSIGNMENT_REQUESTED',
      sentBack: row.status === 'IN_PROGRESS' && row.sentBackAt !== null,
    },
    organization: { id: row.organization.id, displayName: row.organization.displayName },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

type LiveAssignmentRow = IncidentDetailRow['assignments'][number] & { status: LiveAssignmentStatus };

function toLiveAssignment(assignment: LiveAssignmentRow, tenant: Tenant): LiveAssignmentDTO {
  const { intervenant } = assignment;
  const isReporter = tenant.role === 'REPORTER';
  const seesPhone = tenant.role === 'SUPERVISOR' || tenant.membershipId === intervenant.id;
  const requested =
    assignment.status === 'REASSIGNMENT_REQUESTED' &&
    assignment.reassignmentReason &&
    assignment.reassignmentRequestedAt
      ? {
          reasonCode: assignment.reassignmentReason,
          note: assignment.reassignmentNote,
          requestedAt: assignment.reassignmentRequestedAt.toISOString(),
        }
      : null;
  return {
    id: assignment.id,
    status: assignment.status,
    intervenant: {
      ...personRef(intervenant),
      companyName: intervenant.intervenantProfile?.companyName ?? null,
      phone: seesPhone ? intervenant.user.phone : null,
    },
    assignedBy: personRef(assignment.assignedBy),
    assignedAt: assignment.assignedAt.toISOString(),
    respondedAt: assignment.respondedAt?.toISOString() ?? null,
    note: isReporter ? null : assignment.note,
    reassignment: isReporter ? null : requested,
  };
}

function toAttachment(attachment: IncidentDetailRow['attachments'][number]): AttachmentDTO {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    kind: attachment.kind,
    uploadedBy: personRef(attachment.uploadedBy),
    createdAt: attachment.createdAt.toISOString(),
    url: `/v1/attachments/${attachment.id}/file`,
  };
}

function reporterPhoneFor(row: IncidentDetailRow, tenant: Tenant): string | null {
  if (tenant.role === 'SUPERVISOR') return row.reporter.user.phone;
  if (tenant.role === 'INTERVENANT' && tenant.org.showReporterPhone) return row.reporter.user.phone;
  return null;
}

/** The case file as `tenant` may see it. The caller has already checked that the incident is in scope. */
export function toDetail(row: IncidentDetailRow, tenant: Tenant): IncidentDetail {
  const live = liveOf(row.assignments);
  const attachments =
    tenant.role === 'REPORTER' ? row.attachments.filter((a) => a.kind !== 'PROGRESS') : row.attachments;
  return {
    ...toListItem(row),
    description: row.description,
    locationDetail: row.locationDetail,
    latitude: row.latitude,
    longitude: row.longitude,
    reportedPriority: row.reportedPriority,
    reportedCategory: { id: row.reportedCategory.id, name: row.reportedCategory.name },
    reporterPhone: reporterPhoneFor(row, tenant),
    triagedAt: row.triagedAt?.toISOString() ?? null,
    firstAssignedAt: row.firstAssignedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    dismissReason: row.dismissReason,
    dismissNote: row.dismissNote,
    liveAssignment: live ? toLiveAssignment(live, tenant) : null,
    attachments: attachments.map(toAttachment),
    actions: incidentActions(
      { role: tenant.role, membershipId: tenant.membershipId },
      {
        status: row.status,
        reporterMembershipId: row.reporterMembershipId,
        liveAssignment: live ? { intervenantMembershipId: live.intervenant.id, status: live.status } : null,
      },
    ),
    requireResolutionPhoto: tenant.org.requireResolutionPhoto,
  };
}
