/**
 * Incident and assignment rules shared by the API (enforcement) and the web
 * app (which actions to show). Pure functions only, no I/O.
 * Source: docs/PRD.md sections 5.2 and 6.2.
 */
import type { AssignmentStatus, IncidentStatus, LiveAssignmentStatus, MembershipRole } from './enums';
import { liveAssignmentStatuses } from './enums';

export type IncidentTrigger =
  'assign' | 'reassign' | 'unassign' | 'accept' | 'decline' | 'resolve' | 'close' | 'send-back' | 'dismiss';

type Transition = { from: IncidentStatus; trigger: IncidentTrigger; to: IncidentStatus };

/** Every legal incident transition. Anything else is INVALID_STATE_TRANSITION. */
export const incidentTransitions: readonly Transition[] = [
  { from: 'NEW', trigger: 'assign', to: 'ASSIGNED' },
  { from: 'NEW', trigger: 'dismiss', to: 'CLOSED' },
  { from: 'ASSIGNED', trigger: 'accept', to: 'IN_PROGRESS' },
  { from: 'ASSIGNED', trigger: 'decline', to: 'NEW' },
  { from: 'ASSIGNED', trigger: 'unassign', to: 'NEW' },
  { from: 'ASSIGNED', trigger: 'reassign', to: 'ASSIGNED' },
  { from: 'IN_PROGRESS', trigger: 'reassign', to: 'ASSIGNED' },
  { from: 'IN_PROGRESS', trigger: 'unassign', to: 'NEW' },
  { from: 'IN_PROGRESS', trigger: 'resolve', to: 'RESOLVED' },
  { from: 'RESOLVED', trigger: 'close', to: 'CLOSED' },
  { from: 'RESOLVED', trigger: 'send-back', to: 'IN_PROGRESS' },
];

/** Target status, or null when the transition is not allowed. */
export function nextStatus(from: IncidentStatus, trigger: IncidentTrigger): IncidentStatus | null {
  return incidentTransitions.find((t) => t.from === from && t.trigger === trigger)?.to ?? null;
}

export function isLiveAssignment(status: AssignmentStatus): status is LiveAssignmentStatus {
  return (liveAssignmentStatuses as readonly string[]).includes(status);
}

/**
 * I14: while an incident is open, its status mirrors its live assignment.
 * RESOLVED is the exception: the assignment stays ACCEPTED until close.
 */
export function statusForAssignment(status: LiveAssignmentStatus | null): IncidentStatus {
  if (status === null) return 'NEW';
  return status === 'PENDING_ACCEPTANCE' ? 'ASSIGNED' : 'IN_PROGRESS';
}

export type IncidentAction =
  | 'assign'
  | 'reassign'
  | 'unassign'
  | 'triage'
  | 'dismiss'
  | 'close'
  | 'send-back'
  | 'accept'
  | 'decline'
  | 'request-reassignment'
  | 'progress'
  | 'resolve'
  | 'comment-public'
  | 'comment-internal';

export type IncidentViewer = {
  role: MembershipRole;
  membershipId: string;
};

export type IncidentFacts = {
  status: IncidentStatus;
  /** Null for a visitor's report. */
  reporterMembershipId: string | null;
  liveAssignment: { intervenantMembershipId: string; status: LiveAssignmentStatus } | null;
};

/**
 * Actions the viewer may take right now. The API enforces the same rules in
 * its services; this list only drives which controls the UI shows.
 */
export function incidentActions(viewer: IncidentViewer, incident: IncidentFacts): IncidentAction[] {
  const { status, liveAssignment } = incident;
  if (status === 'CLOSED') return [];

  if (viewer.role === 'SUPERVISOR') {
    const actions: IncidentAction[] = [];
    if (status === 'NEW') actions.push('assign', 'triage', 'dismiss');
    if (status === 'ASSIGNED' || status === 'IN_PROGRESS') actions.push('reassign', 'unassign', 'triage');
    if (status === 'RESOLVED') actions.push('close', 'send-back');
    actions.push('comment-public', 'comment-internal');
    return actions;
  }

  if (viewer.role === 'INTERVENANT') {
    const mine = liveAssignment?.intervenantMembershipId === viewer.membershipId;
    if (!mine || !liveAssignment) return [];
    const actions: IncidentAction[] = [];
    if (liveAssignment.status === 'PENDING_ACCEPTANCE') actions.push('accept', 'decline');
    if (status === 'IN_PROGRESS') {
      actions.push('progress', 'resolve');
      if (liveAssignment.status === 'ACCEPTED') actions.push('request-reassignment');
    }
    actions.push('comment-public', 'comment-internal');
    return actions;
  }

  return incident.reporterMembershipId === viewer.membershipId ? ['comment-public'] : [];
}

/** Built-in views of the supervisor inbox. */
export const inboxViews = ['attention', 'unassigned', 'in-progress', 'review', 'open', 'closed', 'all'] as const;
export type InboxView = (typeof inboxViews)[number];

/** Reference format: INC-2026-00042. */
export function formatReference(year: number, sequence: number): string {
  return `INC-${year}-${String(sequence).padStart(5, '0')}`;
}

export const referencePattern = /^INC-\d{4}-\d{5,}$/;
