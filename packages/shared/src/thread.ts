/**
 * The Thread: an incident's chronological record, built from audit events.
 * Visibility rules come from docs/PRD.md section 5.3. The API filters and
 * redacts with these functions before anything leaves the server.
 */
import type {
  AttachmentKind,
  CommentVisibility,
  DismissReason,
  Priority,
  ProgressType,
  ReassignmentReason,
  ThreadEventType,
} from './enums';

/** A person as they were named when the event happened. */
export type PersonRef = { membershipId: string; name: string };

export type ThreadPayloads = {
  INCIDENT_CREATED: { onBehalfOf: PersonRef | null };
  TRIAGED: {
    from: { priority: Priority | null; category: string };
    to: { priority: Priority; category: string };
  };
  ASSIGNED: { assignee: PersonRef; previous: PersonRef | null; note: string | null };
  UNASSIGNED: { previous: PersonRef; reason: string | null };
  ASSIGNMENT_ACCEPTED: Record<string, never>;
  ASSIGNMENT_DECLINED: { reason: string };
  REASSIGNMENT_REQUESTED: { reasonCode: ReassignmentReason; note: string | null };
  REASSIGNMENT_REJECTED: { note: string | null; assignee: PersonRef };
  PROGRESS_POSTED: { progressType: ProgressType; note: string };
  RESOLVED: { note: string };
  SENT_BACK: { reason: string };
  CLOSED: Record<string, never>;
  DISMISSED: { reason: DismissReason; note: string | null };
  COMMENT_ADDED: { visibility: CommentVisibility; body: string };
  ATTACHMENT_ADDED: { attachmentId: string; fileName: string; kind: AttachmentKind };
};

export type ThreadEvent = {
  [K in ThreadEventType]: {
    id: string;
    type: K;
    actor: PersonRef | null;
    createdAt: string;
    payload: ThreadPayloads[K];
  };
}[ThreadEventType];

export type ThreadViewer =
  | { role: 'SUPERVISOR' }
  | { role: 'REPORTER' }
  | {
      role: 'INTERVENANT';
      /** Holds the live assignment right now. */
      liveAssignee: boolean;
      /** For past assignees: end of their last assignment. Later events are hidden. */
      accessEndsAt: Date | null;
    };

/** Milestones an employee sees, besides public comments and photos. */
const reporterMilestones: readonly ThreadEventType[] = [
  'INCIDENT_CREATED',
  'ASSIGNED',
  'ASSIGNMENT_ACCEPTED',
  'RESOLVED',
  'CLOSED',
  'DISMISSED',
];

type VisibilityInput = { type: ThreadEventType; createdAt: Date; payload: unknown };

export function isThreadEventVisible(event: VisibilityInput, viewer: ThreadViewer): boolean {
  if (viewer.role === 'SUPERVISOR') return true;

  if (viewer.role === 'REPORTER') {
    if (event.type === 'COMMENT_ADDED') return (event.payload as ThreadPayloads['COMMENT_ADDED']).visibility === 'PUBLIC';
    if (event.type === 'ATTACHMENT_ADDED') {
      return (event.payload as ThreadPayloads['ATTACHMENT_ADDED']).kind !== 'PROGRESS';
    }
    return reporterMilestones.includes(event.type);
  }

  if (viewer.accessEndsAt && event.createdAt > viewer.accessEndsAt) return false;
  if (event.type === 'COMMENT_ADDED') {
    const { visibility } = event.payload as ThreadPayloads['COMMENT_ADDED'];
    return visibility === 'PUBLIC' || viewer.liveAssignee;
  }
  return true;
}

/** Removes fields a viewer may not read from an otherwise visible event. */
export function redactThreadPayload<T extends ThreadEventType>(
  type: T,
  payload: ThreadPayloads[T],
  viewer: ThreadViewer,
): ThreadPayloads[T] {
  if (viewer.role !== 'REPORTER') return payload;
  if (type === 'ASSIGNED') {
    const assigned = payload as ThreadPayloads['ASSIGNED'];
    return { assignee: assigned.assignee, previous: null, note: null } as ThreadPayloads[T];
  }
  return payload;
}
