import { IncidentStatus } from '@prisma/client';
import { AppError } from '../../lib/errors.js';

/**
 * Allowed incident lifecycle transitions. Enforced both in this module and at the
 * database layer via updateMany version checks to prevent race conditions.
 *
 * RESOLVED -> IN_PROGRESS is allowed so administrators can reject a resolution
 * and send the incident back for further work. There is no path from NEW directly
 * to RESOLVED; an incident must be ASSIGNED and accepted first.
 */
const allowed: Record<IncidentStatus, IncidentStatus[]> = {
  NEW: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [] // Terminal state: no transitions out. Reopening requires a new incident.
};

export function assertTransition(from: IncidentStatus, to: IncidentStatus) {
  if (!allowed[from].includes(to)) {
    throw new AppError('CONFLICT_STATE', 409, `Invalid transition ${from} -> ${to}`);
  }
}
