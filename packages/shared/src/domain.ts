/**
 * Incident domain rules shared by API, web and mobile.
 * Source: docs/PRD.md sections 6.2 and 6.3. Keep this file pure (no I/O).
 */

export const incidentStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof priorities)[number];

export const availabilities = ['AVAILABLE', 'BUSY', 'OFF'] as const;
export type Availability = (typeof availabilities)[number];

export type IncidentActor = 'supervisor' | 'intervenant' | 'system';

export type IncidentTransition = {
  from: IncidentStatus;
  to: IncidentStatus;
  trigger: string;
  actors: readonly IncidentActor[];
};

/** Every legal incident transition. Anything else is INVALID_STATE_TRANSITION. */
export const incidentTransitions: readonly IncidentTransition[] = [
  { from: 'NEW', to: 'ASSIGNED', trigger: 'assign', actors: ['supervisor'] },
  { from: 'ASSIGNED', to: 'IN_PROGRESS', trigger: 'accept', actors: ['intervenant'] },
  { from: 'ASSIGNED', to: 'NEW', trigger: 'decline', actors: ['intervenant'] },
  { from: 'ASSIGNED', to: 'NEW', trigger: 'unassign', actors: ['supervisor', 'system'] },
  { from: 'ASSIGNED', to: 'ASSIGNED', trigger: 'reassign', actors: ['supervisor'] },
  { from: 'IN_PROGRESS', to: 'ASSIGNED', trigger: 'reassign', actors: ['supervisor'] },
  { from: 'IN_PROGRESS', to: 'NEW', trigger: 'unassign', actors: ['supervisor', 'system'] },
  { from: 'IN_PROGRESS', to: 'RESOLVED', trigger: 'resolve', actors: ['intervenant'] },
  { from: 'RESOLVED', to: 'CLOSED', trigger: 'close', actors: ['supervisor'] },
  { from: 'RESOLVED', to: 'IN_PROGRESS', trigger: 'send-back', actors: ['supervisor'] },
  { from: 'NEW', to: 'CLOSED', trigger: 'dismiss', actors: ['supervisor'] },
];

export function canTransition(from: IncidentStatus, trigger: string, actor: IncidentActor): IncidentTransition | undefined {
  return incidentTransitions.find((t) => t.from === from && t.trigger === trigger && t.actors.includes(actor));
}

export type SupervisorAction = 'triage-assign' | 'dismiss' | 'reassign' | 'unassign' | 'close' | 'send-back';

/** Actions the supervisor action bar offers per status (docs/DESIGN_SYSTEM.md section 5.2). First entry is the primary action. */
export const supervisorActions: Record<IncidentStatus, readonly SupervisorAction[]> = {
  NEW: ['triage-assign', 'dismiss'],
  ASSIGNED: ['reassign', 'unassign'],
  IN_PROGRESS: ['reassign', 'unassign'],
  RESOLVED: ['close', 'send-back'],
  CLOSED: [],
};

export type Candidate = {
  id: string;
  name: string;
  /** Membership is ACTIVE. Anything else is not selectable. */
  active: boolean;
  specialties: readonly string[];
  availability: Availability;
  /** Live assignments right now. */
  openAssignments: number;
  /** Used to spread work: oldest first. */
  lastAssignedAt: number | null;
  /** Site ids with ACTIVE access. */
  siteAccess: readonly string[];
};

export type CandidateFit = {
  specialtyMatch: boolean;
  availability: Availability;
  openAssignments: number;
  siteAccess: boolean;
};

export type RankedCandidate = {
  candidate: Candidate;
  fit: CandidateFit;
  /** False means not selectable (I10). `reason` explains it in plain words. */
  eligible: boolean;
  reason: string | null;
  /** True when selectable but worth a warning (availability OFF). */
  warning: string | null;
};

const availabilityRank: Record<Availability, number> = { AVAILABLE: 0, BUSY: 1, OFF: 2 };

/**
 * Explainable ranking, in order: specialty match, availability, fewer live
 * assignments, oldest last assignment. Ineligible candidates sort last.
 */
export function rankCandidates(
  candidates: readonly Candidate[],
  incident: { siteId: string; requiredSpecialty: string | null },
): RankedCandidate[] {
  const ranked = candidates.map((candidate): RankedCandidate => {
    const siteAccess = candidate.siteAccess.includes(incident.siteId);
    const specialtyMatch = incident.requiredSpecialty !== null && candidate.specialties.includes(incident.requiredSpecialty);
    const fit: CandidateFit = {
      specialtyMatch,
      availability: candidate.availability,
      openAssignments: candidate.openAssignments,
      siteAccess,
    };
    if (!candidate.active) return { candidate, fit, eligible: false, reason: 'Not an active member', warning: null };
    if (!siteAccess) return { candidate, fit, eligible: false, reason: 'No access to this site', warning: null };
    return {
      candidate,
      fit,
      eligible: true,
      reason: null,
      warning: candidate.availability === 'OFF' ? 'Marked off duty' : null,
    };
  });

  return ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.fit.specialtyMatch !== b.fit.specialtyMatch) return a.fit.specialtyMatch ? -1 : 1;
    const av = availabilityRank[a.fit.availability] - availabilityRank[b.fit.availability];
    if (av !== 0) return av;
    if (a.fit.openAssignments !== b.fit.openAssignments) return a.fit.openAssignments - b.fit.openAssignments;
    return (a.candidate.lastAssignedAt ?? 0) - (b.candidate.lastAssignedAt ?? 0);
  });
}
