/**
 * Explainable candidate ranking for the assign dialog (docs/PRD.md 6.3).
 * Order: specialty match, availability, fewer live assignments, oldest last
 * assignment. Ineligible candidates are kept, sorted last, with a reason.
 */
import type { Availability } from './enums';

export type CandidateInput = {
  membershipId: string;
  active: boolean;
  specialtyIds: readonly string[];
  availability: Availability;
  openAssignments: number;
  /** Epoch milliseconds of the most recent assignment, null if never assigned. */
  lastAssignedAt: number | null;
  siteIds: readonly string[];
};

export type IneligibleReason = 'NOT_ACTIVE' | 'NO_SITE_ACCESS';
export type CandidateWarning = 'OFF_DUTY';

export type RankedCandidate<T extends CandidateInput = CandidateInput> = {
  candidate: T;
  specialtyMatch: boolean;
  siteAccess: boolean;
  eligible: boolean;
  reason: IneligibleReason | null;
  warning: CandidateWarning | null;
};

const availabilityOrder: Record<Availability, number> = { AVAILABLE: 0, BUSY: 1, OFF: 2 };

export function rankCandidates<T extends CandidateInput>(
  candidates: readonly T[],
  incident: { siteId: string; specialtyId: string | null },
): RankedCandidate<T>[] {
  const ranked = candidates.map((candidate): RankedCandidate<T> => {
    const siteAccess = candidate.siteIds.includes(incident.siteId);
    const specialtyMatch = incident.specialtyId !== null && candidate.specialtyIds.includes(incident.specialtyId);
    const reason: IneligibleReason | null = !candidate.active ? 'NOT_ACTIVE' : !siteAccess ? 'NO_SITE_ACCESS' : null;
    return {
      candidate,
      specialtyMatch,
      siteAccess,
      eligible: reason === null,
      reason,
      warning: reason === null && candidate.availability === 'OFF' ? 'OFF_DUTY' : null,
    };
  });

  return ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.specialtyMatch !== b.specialtyMatch) return a.specialtyMatch ? -1 : 1;
    const availability = availabilityOrder[a.candidate.availability] - availabilityOrder[b.candidate.availability];
    if (availability !== 0) return availability;
    if (a.candidate.openAssignments !== b.candidate.openAssignments) {
      return a.candidate.openAssignments - b.candidate.openAssignments;
    }
    return (a.candidate.lastAssignedAt ?? 0) - (b.candidate.lastAssignedAt ?? 0);
  });
}
