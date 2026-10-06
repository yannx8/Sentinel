import { describe, expect, it } from 'vitest';
import { formatReference, incidentActions, nextStatus, statusForAssignment, type IncidentFacts } from './domain';
import { incidentStatuses } from './enums';
import { rankCandidates, type CandidateInput } from './ranking';
import { isThreadEventVisible, redactThreadPayload } from './thread';
import { parseCsv, toCsv } from './csv';
import { createIncidentSchema, inviteMemberSchema, listIncidentsQuery } from './schemas';

describe('incident state machine', () => {
  it('allows only the documented transitions', () => {
    expect(nextStatus('NEW', 'assign')).toBe('ASSIGNED');
    expect(nextStatus('ASSIGNED', 'accept')).toBe('IN_PROGRESS');
    expect(nextStatus('IN_PROGRESS', 'resolve')).toBe('RESOLVED');
    expect(nextStatus('RESOLVED', 'close')).toBe('CLOSED');
    expect(nextStatus('RESOLVED', 'send-back')).toBe('IN_PROGRESS');
    expect(nextStatus('NEW', 'dismiss')).toBe('CLOSED');
  });

  it('treats CLOSED as terminal', () => {
    for (const trigger of ['assign', 'reassign', 'unassign', 'accept', 'resolve', 'close', 'send-back'] as const) {
      expect(nextStatus('CLOSED', trigger)).toBeNull();
    }
  });

  it('rejects resolving an incident that was never accepted', () => {
    expect(nextStatus('NEW', 'resolve')).toBeNull();
    expect(nextStatus('ASSIGNED', 'resolve')).toBeNull();
  });

  it('mirrors the live assignment (I14)', () => {
    expect(statusForAssignment(null)).toBe('NEW');
    expect(statusForAssignment('PENDING_ACCEPTANCE')).toBe('ASSIGNED');
    expect(statusForAssignment('ACCEPTED')).toBe('IN_PROGRESS');
    expect(statusForAssignment('REASSIGNMENT_REQUESTED')).toBe('IN_PROGRESS');
  });

  it('formats references with five digits', () => {
    expect(formatReference(2026, 42)).toBe('INC-2026-00042');
    expect(formatReference(2026, 123456)).toBe('INC-2026-123456');
  });
});

describe('incident actions', () => {
  const base: IncidentFacts = { status: 'NEW', reporterMembershipId: 'rep', liveAssignment: null };

  it('gives supervisors the triage actions on NEW and none on CLOSED', () => {
    expect(incidentActions({ role: 'SUPERVISOR', membershipId: 's' }, base)).toEqual(
      expect.arrayContaining(['assign', 'dismiss', 'triage']),
    );
    expect(incidentActions({ role: 'SUPERVISOR', membershipId: 's' }, { ...base, status: 'CLOSED' })).toEqual([]);
  });

  it('only lets the live assignee act, and only on their state', () => {
    const assigned: IncidentFacts = {
      status: 'ASSIGNED',
      reporterMembershipId: 'rep',
      liveAssignment: { intervenantMembershipId: 'tech', status: 'PENDING_ACCEPTANCE' },
    };
    expect(incidentActions({ role: 'INTERVENANT', membershipId: 'tech' }, assigned)).toContain('accept');
    expect(incidentActions({ role: 'INTERVENANT', membershipId: 'tech' }, assigned)).not.toContain('resolve');
    expect(incidentActions({ role: 'INTERVENANT', membershipId: 'other' }, assigned)).toEqual([]);

    const requested: IncidentFacts = {
      ...assigned,
      status: 'IN_PROGRESS',
      liveAssignment: { intervenantMembershipId: 'tech', status: 'REASSIGNMENT_REQUESTED' },
    };
    const actions = incidentActions({ role: 'INTERVENANT', membershipId: 'tech' }, requested);
    expect(actions).toContain('progress');
    expect(actions).not.toContain('request-reassignment');
  });

  it('lets an employee comment publicly on their own incident only', () => {
    expect(incidentActions({ role: 'REPORTER', membershipId: 'rep' }, base)).toEqual(['comment-public']);
    expect(incidentActions({ role: 'REPORTER', membershipId: 'someone' }, base)).toEqual([]);
  });

  it('never offers an action on a status outside the enum', () => {
    for (const status of incidentStatuses) {
      expect(Array.isArray(incidentActions({ role: 'SUPERVISOR', membershipId: 's' }, { ...base, status }))).toBe(true);
    }
  });
});

describe('candidate ranking', () => {
  const make = (id: string, over: Partial<CandidateInput> = {}): CandidateInput => ({
    membershipId: id,
    active: true,
    specialtyIds: [],
    availability: 'AVAILABLE',
    openAssignments: 0,
    lastAssignedAt: null,
    siteIds: ['site'],
    ...over,
  });

  it('ranks by specialty, availability, load, then oldest assignment', () => {
    const ranked = rankCandidates(
      [
        make('busy-match', { specialtyIds: ['plumbing'], availability: 'BUSY' }),
        make('free-nomatch'),
        make('free-match-loaded', { specialtyIds: ['plumbing'], openAssignments: 3 }),
        make('free-match', { specialtyIds: ['plumbing'], openAssignments: 1 }),
      ],
      { siteId: 'site', specialtyId: 'plumbing' },
    );
    expect(ranked.map((r) => r.candidate.membershipId)).toEqual([
      'free-match',
      'free-match-loaded',
      'busy-match',
      'free-nomatch',
    ]);
  });

  it('keeps ineligible people last with a reason (I10)', () => {
    const ranked = rankCandidates([make('no-site', { siteIds: [] }), make('inactive', { active: false }), make('ok')], {
      siteId: 'site',
      specialtyId: null,
    });
    expect(ranked[0]?.candidate.membershipId).toBe('ok');
    expect(ranked.find((r) => r.candidate.membershipId === 'no-site')?.reason).toBe('NO_SITE_ACCESS');
    expect(ranked.find((r) => r.candidate.membershipId === 'inactive')?.reason).toBe('NOT_ACTIVE');
  });

  it('warns but allows people marked off duty', () => {
    const [only] = rankCandidates([make('off', { availability: 'OFF' })], { siteId: 'site', specialtyId: null });
    expect(only?.eligible).toBe(true);
    expect(only?.warning).toBe('OFF_DUTY');
  });
});

describe('thread visibility', () => {
  const at = new Date('2026-01-10T10:00:00Z');

  it('hides internal comments and progress from employees', () => {
    const viewer = { role: 'REPORTER' } as const;
    expect(
      isThreadEventVisible({ type: 'COMMENT_ADDED', createdAt: at, payload: { visibility: 'INTERNAL', body: 'x' } }, viewer),
    ).toBe(false);
    expect(
      isThreadEventVisible({ type: 'COMMENT_ADDED', createdAt: at, payload: { visibility: 'PUBLIC', body: 'x' } }, viewer),
    ).toBe(true);
    expect(isThreadEventVisible({ type: 'PROGRESS_POSTED', createdAt: at, payload: {} }, viewer)).toBe(false);
    expect(isThreadEventVisible({ type: 'ASSIGNMENT_DECLINED', createdAt: at, payload: {} }, viewer)).toBe(false);
  });

  it('cuts a past assignee off at the end of their assignment', () => {
    const viewer = { role: 'INTERVENANT', liveAssignee: false, accessEndsAt: at } as const;
    expect(isThreadEventVisible({ type: 'CLOSED', createdAt: new Date(at.getTime() + 1000), payload: {} }, viewer)).toBe(
      false,
    );
    expect(
      isThreadEventVisible({ type: 'COMMENT_ADDED', createdAt: at, payload: { visibility: 'INTERNAL', body: 'x' } }, viewer),
    ).toBe(false);
  });

  it('removes the internal assignment note for employees', () => {
    const payload = { assignee: { membershipId: 'a', name: 'A' }, previous: null, note: 'Bring the ladder' };
    expect(redactThreadPayload('ASSIGNED', payload, { role: 'REPORTER' }).note).toBeNull();
    expect(redactThreadPayload('ASSIGNED', payload, { role: 'SUPERVISOR' }).note).toBe('Bring the ladder');
  });
});

describe('csv', () => {
  it('reads quoted fields, escaped quotes and semicolon exports', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
    expect(parseCsv('﻿email;name\nlea@acme.test;Léa\n')).toEqual([
      ['email', 'name'],
      ['lea@acme.test', 'Léa'],
    ]);
  });

  it('neutralizes formulas on export', () => {
    expect(toCsv(['v'], [['=HYPERLINK("x")']])).toBe('v\r\n"\'=HYPERLINK(""x"")"\r\n');
  });
});

describe('schemas', () => {
  it('trims and validates an incident report', () => {
    const parsed = createIncidentSchema.safeParse({
      title: '  Leak  ',
      description: 'Water on the floor of corridor B',
      siteId: '9b2f3c1e-7a4d-4e8f-9c0a-1b2c3d4e5f60',
      categoryId: '9b2f3c1e-7a4d-4e8f-9c0a-1b2c3d4e5f61',
    });
    expect(parsed.success && parsed.data.title).toBe('Leak');
    expect(createIncidentSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it('parses comma separated filters and rejects unknown values', () => {
    expect(listIncidentsQuery.parse({ priority: 'HIGH,CRITICAL' }).priority).toEqual(['HIGH', 'CRITICAL']);
    expect(listIncidentsQuery.safeParse({ priority: 'URGENT' }).success).toBe(false);
  });

  it('lower-cases invitation emails and fills empty profiles', () => {
    const parsed = inviteMemberSchema.parse({ role: 'REPORTER', email: ' Lea@ACME.test ', firstName: 'Léa', lastName: 'M' });
    expect(parsed.email).toBe('lea@acme.test');
    expect(parsed.role === 'REPORTER' && parsed.employee.homeSiteId).toBeNull();
  });
});
