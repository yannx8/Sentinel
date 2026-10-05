import type { Candidate, IncidentStatus, Priority } from '@sentinel/shared';

export type Site = { id: string; name: string };

export type Category = { id: string; name: string; requiredSpecialty: string | null };

export type ProgressType = 'STARTED' | 'ON_SITE' | 'BLOCKED' | 'UPDATE';

export type ThreadEvent = { id: string; at: number; actor: string } & (
  | { kind: 'reported'; body: string }
  | { kind: 'comment'; visibility: 'PUBLIC' | 'INTERNAL'; body: string }
  | { kind: 'triaged'; priority: Priority; category: string }
  | { kind: 'assigned'; assignee: string; note?: string }
  | { kind: 'unassigned'; assignee: string }
  | { kind: 'accepted' }
  | { kind: 'declined'; reason: string }
  | { kind: 'reassignment-requested'; reason: string }
  | { kind: 'progress'; type: ProgressType; note: string }
  | { kind: 'resolved'; note: string }
  | { kind: 'sent-back'; reason: string }
  | { kind: 'closed' }
  | { kind: 'dismissed'; code: DismissCode; note?: string }
);

export type DismissCode = 'DUPLICATE' | 'NOT_AN_INCIDENT' | 'NO_ACTION_NEEDED';

export type Incident = {
  reference: string;
  title: string;
  description: string;
  siteId: string;
  categoryId: string;
  reporter: string;
  reportedPriority: Priority;
  /** Null until triage. */
  priority: Priority | null;
  status: IncidentStatus;
  createdAt: number;
  assignee: { id: string; name: string } | null;
  /** Set when the last assignment ended in a decline and the incident is back in the inbox. */
  declined: { by: string; reason: string } | null;
  reassignmentRequested: { reason: string } | null;
  attachments: { name: string; sizeKb: number }[];
  /** Optimistic concurrency token. */
  version: number;
  thread: ThreadEvent[];
};

export type Directory = {
  sites: Site[];
  categories: Category[];
  candidates: Candidate[];
};
