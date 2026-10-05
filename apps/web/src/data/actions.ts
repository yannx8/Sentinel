import { canTransition, type Priority } from '@sentinel/shared';
import { categories } from './seed';
import type { DismissCode, Incident, ThreadEvent } from './types';

export type IncidentAction =
  | { type: 'assign'; assignee: { id: string; name: string }; priority: Priority; categoryId: string; note?: string }
  | { type: 'unassign' }
  | { type: 'close' }
  | { type: 'send-back'; reason: string }
  | { type: 'dismiss'; code: DismissCode; note?: string }
  | { type: 'comment'; visibility: 'PUBLIC' | 'INTERNAL'; body: string };

export class ApiError extends Error {
  constructor(
    public code: 'INVALID_STATE_TRANSITION' | 'CONFLICT_CONCURRENT_UPDATE' | 'NOT_FOUND' | 'VALIDATION_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let eventCounter = 0;
const event = <E extends Omit<ThreadEvent, 'id'>>(e: E): ThreadEvent => ({ ...e, id: `local-${++eventCounter}` }) as ThreadEvent;

/**
 * Pure transition. The fake API and the optimistic cache update both call this,
 * so the UI can never predict a result the "server" would refuse.
 */
export function applyAction(incident: Incident, action: IncidentAction, actor: string, now: number): Incident {
  const base = { at: now, actor };
  const bump = (patch: Partial<Incident>, ...events: ThreadEvent[]): Incident => ({
    ...incident,
    ...patch,
    version: incident.version + 1,
    thread: [...incident.thread, ...events],
  });
  const refuse = (trigger: string): never => {
    throw new ApiError('INVALID_STATE_TRANSITION', `${incident.reference} cannot ${trigger} while ${incident.status}`);
  };

  switch (action.type) {
    case 'assign': {
      const trigger = incident.status === 'NEW' ? 'assign' : 'reassign';
      const t = canTransition(incident.status, trigger, 'supervisor');
      if (!t) return refuse(trigger);
      const events: ThreadEvent[] = [];
      if (incident.priority !== action.priority || incident.categoryId !== action.categoryId) {
        const category = categories.find((c) => c.id === action.categoryId)?.name ?? '';
        events.push(event({ ...base, kind: 'triaged', priority: action.priority, category }));
      }
      events.push(event({ ...base, kind: 'assigned', assignee: action.assignee.name, note: action.note }));
      return bump(
        {
          status: t.to,
          priority: action.priority,
          categoryId: action.categoryId,
          assignee: action.assignee,
          declined: null,
          reassignmentRequested: null,
        },
        ...events,
      );
    }
    case 'unassign': {
      const t = canTransition(incident.status, 'unassign', 'supervisor');
      if (!t || !incident.assignee) return refuse('unassign');
      return bump(
        { status: t.to, assignee: null, reassignmentRequested: null },
        event({ ...base, kind: 'unassigned', assignee: incident.assignee.name }),
      );
    }
    case 'close': {
      const t = canTransition(incident.status, 'close', 'supervisor');
      if (!t) return refuse('close');
      return bump({ status: t.to }, event({ ...base, kind: 'closed' }));
    }
    case 'send-back': {
      const t = canTransition(incident.status, 'send-back', 'supervisor');
      if (!t) return refuse('send back');
      if (action.reason.trim().length < 10) throw new ApiError('VALIDATION_FAILED', 'Give a reason of at least 10 characters.');
      return bump({ status: t.to }, event({ ...base, kind: 'sent-back', reason: action.reason.trim() }));
    }
    case 'dismiss': {
      const t = canTransition(incident.status, 'dismiss', 'supervisor');
      if (!t) return refuse('dismiss');
      return bump({ status: t.to }, event({ ...base, kind: 'dismissed', code: action.code, note: action.note }));
    }
    case 'comment': {
      if (incident.status === 'CLOSED') return refuse('comment');
      return bump({}, event({ ...base, kind: 'comment', visibility: action.visibility, body: action.body }));
    }
  }
}
