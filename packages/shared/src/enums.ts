/**
 * Enum values shared by the database, the API and the web app.
 * Prisma enums in apps/api/prisma/schema.prisma must list the same values.
 */

export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];

export const organizationStatuses = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];

export const plans = ['TRIAL', 'STARTER', 'BUSINESS'] as const;
export type Plan = (typeof plans)[number];

export const industries = [
  'FACILITIES',
  'PROPERTY',
  'MANUFACTURING',
  'RETAIL',
  'HEALTHCARE',
  'EDUCATION',
  'HOSPITALITY',
  'LOGISTICS',
  'PUBLIC_SECTOR',
  'OTHER',
] as const;
export type Industry = (typeof industries)[number];

export const sizeBands = ['XS', 'S', 'M', 'L', 'XL'] as const;
export type SizeBand = (typeof sizeBands)[number];

export const membershipRoles = ['SUPERVISOR', 'REPORTER', 'INTERVENANT'] as const;
export type MembershipRole = (typeof membershipRoles)[number];

export const membershipStatuses = ['ACTIVE', 'SUSPENDED', 'REVOKED'] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const availabilities = ['AVAILABLE', 'BUSY', 'OFF'] as const;
export type Availability = (typeof availabilities)[number];

export const incidentStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];
export const openIncidentStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'] as const;

export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof priorities)[number];
/** Higher is more urgent. Used for sorting. */
export const priorityRank: Record<Priority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export const assignmentStatuses = [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'REASSIGNMENT_REQUESTED',
  'DECLINED',
  'SUPERSEDED',
  'COMPLETED',
] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];
/** At most one live assignment per incident (I4). */
export const liveAssignmentStatuses = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'REASSIGNMENT_REQUESTED'] as const;
export type LiveAssignmentStatus = (typeof liveAssignmentStatuses)[number];

export const progressTypes = ['ON_SITE', 'BLOCKED', 'UPDATE'] as const;
export type ProgressType = (typeof progressTypes)[number];

export const commentVisibilities = ['PUBLIC', 'INTERNAL'] as const;
export type CommentVisibility = (typeof commentVisibilities)[number];

export const dismissReasons = ['DUPLICATE', 'NOT_AN_INCIDENT', 'NO_ACTION_NEEDED'] as const;
export type DismissReason = (typeof dismissReasons)[number];

export const reassignmentReasons = ['CANNOT_ACCESS', 'WRONG_SPECIALTY', 'UNAVAILABLE', 'OTHER'] as const;
export type ReassignmentReason = (typeof reassignmentReasons)[number];

export const attachmentKinds = ['REPORT', 'EVIDENCE', 'PROGRESS'] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];

export const auditEventTypes = [
  'INCIDENT_CREATED',
  'TRIAGED',
  'ASSIGNED',
  'UNASSIGNED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_DECLINED',
  'REASSIGNMENT_REQUESTED',
  'REASSIGNMENT_REJECTED',
  'PROGRESS_POSTED',
  'RESOLVED',
  'SENT_BACK',
  'CLOSED',
  'DISMISSED',
  'COMMENT_ADDED',
  'ATTACHMENT_ADDED',
  'MEMBER_INVITED',
  'INVITATION_REVOKED',
  'MEMBER_JOINED',
  'MEMBER_UPDATED',
  'MEMBER_SUSPENDED',
  'MEMBER_REACTIVATED',
  'MEMBER_REVOKED',
  'SITE_CREATED',
  'SITE_UPDATED',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'SPECIALTY_CREATED',
  'ORG_UPDATED',
] as const;
export type AuditEventType = (typeof auditEventTypes)[number];

/** Audit events that belong to an incident's Thread. */
export const threadEventTypes = [
  'INCIDENT_CREATED',
  'TRIAGED',
  'ASSIGNED',
  'UNASSIGNED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_DECLINED',
  'REASSIGNMENT_REQUESTED',
  'REASSIGNMENT_REJECTED',
  'PROGRESS_POSTED',
  'RESOLVED',
  'SENT_BACK',
  'CLOSED',
  'DISMISSED',
  'COMMENT_ADDED',
  'ATTACHMENT_ADDED',
] as const satisfies readonly AuditEventType[];
export type ThreadEventType = (typeof threadEventTypes)[number];

export const notificationTypes = [
  'INCIDENT_CREATED',
  'ASSIGNED',
  'ASSIGNED_REPORTER',
  'ACCEPTED',
  'DECLINED',
  'REASSIGNMENT_REQUESTED',
  'REASSIGNMENT_REJECTED',
  'UNASSIGNED',
  'PROGRESS_POSTED',
  'RESOLVED',
  'SENT_BACK',
  'CLOSED',
  'COMMENT_ADDED',
  'INVITATION_ACCEPTED',
] as const;
export type NotificationType = (typeof notificationTypes)[number];

export const platformEventTypes = ['ORG_SUSPENDED', 'ORG_REACTIVATED', 'PLAN_CHANGED', 'REGISTRATION_RESENT'] as const;
export type PlatformEventType = (typeof platformEventTypes)[number];
