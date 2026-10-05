import { describe, expect, it } from 'vitest';
import {
  canTransition,
  incidentStatuses,
  rankCandidates,
  supervisorActions,
  type Candidate,
} from './domain';

describe('incident transitions', () => {
  it('lets a supervisor assign a NEW incident', () => {
    expect(canTransition('NEW', 'assign', 'supervisor')?.to).toBe('ASSIGNED');
  });

  it('does not let an intervenant close an incident', () => {
    expect(canTransition('RESOLVED', 'close', 'intervenant')).toBeUndefined();
  });

  it('treats CLOSED as terminal', () => {
    for (const trigger of ['assign', 'accept', 'resolve', 'close', 'send-back', 'reassign', 'unassign', 'dismiss']) {
      for (const actor of ['supervisor', 'intervenant', 'system'] as const) {
        expect(canTransition('CLOSED', trigger, actor)).toBeUndefined();
      }
    }
  });

  it('only offers supervisor actions that are legal transitions', () => {
    const trigger = { 'triage-assign': 'assign', dismiss: 'dismiss', reassign: 'reassign', unassign: 'unassign', close: 'close', 'send-back': 'send-back' };
    for (const status of incidentStatuses) {
      for (const action of supervisorActions[status]) {
        expect(canTransition(status, trigger[action], 'supervisor'), `${status} ${action}`).toBeDefined();
      }
    }
  });
});

const base: Omit<Candidate, 'id' | 'name'> = {
  active: true,
  specialties: [],
  availability: 'AVAILABLE',
  openAssignments: 0,
  lastAssignedAt: null,
  siteAccess: ['site-2'],
};
const incident = { siteId: 'site-2', requiredSpecialty: 'Plumbing' };

describe('rankCandidates', () => {
  it('ranks specialty match first, then availability, then load, then oldest assignment', () => {
    const list: Candidate[] = [
      { ...base, id: 'busy-match', name: 'Busy match', specialties: ['Plumbing'], availability: 'BUSY' },
      { ...base, id: 'free-nomatch', name: 'Free no match' },
      { ...base, id: 'free-match-3', name: 'Free match 3', specialties: ['Plumbing'], openAssignments: 3 },
      { ...base, id: 'free-match-1-new', name: 'Free match 1 new', specialties: ['Plumbing'], openAssignments: 1, lastAssignedAt: 200 },
      { ...base, id: 'free-match-1-old', name: 'Free match 1 old', specialties: ['Plumbing'], openAssignments: 1, lastAssignedAt: 100 },
    ];
    expect(rankCandidates(list, incident).map((r) => r.candidate.id)).toEqual([
      'free-match-1-old',
      'free-match-1-new',
      'free-match-3',
      'busy-match',
      'free-nomatch',
    ]);
  });

  it('makes members without site access or active status ineligible, with a reason', () => {
    const [noAccess, inactive] = rankCandidates(
      [
        { ...base, id: 'a', name: 'A', siteAccess: ['site-9'] },
        { ...base, id: 'b', name: 'B', active: false },
      ],
      incident,
    );
    expect(noAccess).toMatchObject({ eligible: false, reason: 'No access to this site' });
    expect(inactive).toMatchObject({ eligible: false, reason: 'Not an active member' });
  });

  it('keeps ineligible candidates last even when they match the specialty', () => {
    const ranked = rankCandidates(
      [
        { ...base, id: 'blocked', name: 'Blocked', specialties: ['Plumbing'], siteAccess: [] },
        { ...base, id: 'ok', name: 'Ok' },
      ],
      incident,
    );
    expect(ranked.map((r) => r.candidate.id)).toEqual(['ok', 'blocked']);
  });

  it('lets a supervisor pick someone off duty, with a warning', () => {
    const [r] = rankCandidates([{ ...base, id: 'off', name: 'Off', availability: 'OFF' }], incident);
    expect(r).toMatchObject({ eligible: true, warning: 'Marked off duty' });
  });
});
