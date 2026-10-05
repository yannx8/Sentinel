/** Every possible state transition or action that produces an audit trail entry. */
export type AuditEventType =
  | 'CREATED'
  | 'TRIAGE'
  | 'VERIFIED'
  | 'ASSIGNMENT'
  | 'STATUS'
  | 'REASSIGNMENT'
  | 'RESOLUTION'
  | 'REJECTED'
  | 'CLOSED'
  | 'PROGRESS'
  | 'COMMENT'
  | 'ATTACHMENT';

/** Authenticated request context passed to service-layer functions for authorization and auditing. */
export interface AppContext {
  userId: string;
  organizationId: string;
  roles: string[];
  sessionId: string;
}
