import type { IncidentDetail, ThreadEvent } from '@sentinel/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, prisma, reportIncident, resetDb, scenario, signIn } from './helpers';

type Scenario = Awaited<ReturnType<typeof scenario>>;
let s: Scenario;

beforeEach(async () => {
  await resetDb();
  s = await scenario();
});

async function detail(client: Scenario['supervisor'], reference: string) {
  const response = await client.get(`/incidents/${reference}`);
  expect(response.status).toBe(200);
  return response.body.data as IncidentDetail;
}

async function assign(reference: string, version: number, intervenantMembershipId = s.intervenant.membership.id) {
  return s.supervisor.post(`/incidents/${reference}/assign`, {
    expectedVersion: version,
    intervenantMembershipId,
    priority: 'CRITICAL',
  });
}

describe('incident loop', () => {
  it('runs report, assign, accept, progress, resolve and close end to end', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    expect(created.reference).toMatch(/^INC-\d{4}-00001$/);

    const assigned = await assign(created.reference, created.version);
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.status).toBe('ASSIGNED');
    const assignmentId = assigned.body.data.liveAssignment.id as string;

    const accepted = await s.tech.post(`/assignments/${assignmentId}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('IN_PROGRESS');
    expect(accepted.body.data.startedAt).not.toBeNull();

    expect(
      (
        await s.tech.post(`/assignments/${assignmentId}/progress`, {
          progressType: 'ON_SITE',
          note: 'Arrived, shutting the valve',
        })
      ).status,
    ).toBe(200);
    const resolved = await s.tech.post(`/assignments/${assignmentId}/resolve`, {
      note: 'Replaced the cracked pipe joint and dried the floor.',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.status).toBe('RESOLVED');

    const current = await detail(s.supervisor, created.reference);
    const closed = await s.supervisor.post(`/incidents/${created.reference}/close`, {
      expectedVersion: current.version,
    });
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('CLOSED');
    expect(closed.body.data.actions).toEqual([]);

    const assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(assignment.status).toBe('COMPLETED');

    const types = ((await s.supervisor.get(`/incidents/${created.reference}/thread`)).body.data as ThreadEvent[]).map(
      (e) => e.type,
    );
    expect(types).toEqual([
      'INCIDENT_CREATED',
      'TRIAGED',
      'ASSIGNED',
      'ASSIGNMENT_ACCEPTED',
      'PROGRESS_POSTED',
      'RESOLVED',
      'CLOSED',
    ]);
  });

  it('numbers references per organization in sequence', async () => {
    const first = await reportIncident(s.reporter, s.site.id, s.category.id);
    const second = await reportIncident(s.reporter, s.site.id, s.category.id);
    expect(Number(second.reference.slice(-5))).toBe(Number(first.reference.slice(-5)) + 1);
  });

  it('lets a supervisor report on behalf of an employee', async () => {
    const created = await reportIncident(s.supervisor, s.site.id, s.category.id, {
      onBehalfOfMembershipId: s.employee.membership.id,
    });
    const mine = await s.reporter.get(`/incidents/${created.reference}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.reporter.membershipId).toBe(s.employee.membership.id);
  });

  it('rejects reports on an inactive site', async () => {
    await prisma.site.update({ where: { id: s.site.id }, data: { isActive: false } });
    const response = await s.reporter.post('/incidents', {
      title: 'Broken door',
      description: 'The front door does not close anymore.',
      siteId: s.site.id,
      categoryId: s.category.id,
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('does not let intervenants report', async () => {
    const response = await s.tech.post('/incidents', {
      title: 'Broken door',
      description: 'The front door does not close anymore.',
      siteId: s.site.id,
      categoryId: s.category.id,
    });
    expect(response.status).toBe(403);
  });
});

describe('decline, reassignment and send back', () => {
  it('returns a declined incident to NEW with a declined flag', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const assigned = await assign(created.reference, created.version);
    const response = await s.tech.post(`/assignments/${assigned.body.data.liveAssignment.id}/decline`, {
      reason: 'Not my trade',
    });
    expect(response.status).toBe(200);
    const after = await detail(s.supervisor, created.reference);
    expect(after.status).toBe('NEW');
    expect(after.flags.declined).toBe(true);
    expect(after.liveAssignment).toBeNull();
  });

  it('handles a reassignment request and its rejection', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const assigned = await assign(created.reference, created.version);
    const assignmentId = assigned.body.data.liveAssignment.id as string;
    await s.tech.post(`/assignments/${assignmentId}/accept`);
    const requested = await s.tech.post(`/assignments/${assignmentId}/request-reassignment`, {
      reasonCode: 'CANNOT_ACCESS',
      note: 'Gate locked',
    });
    expect(requested.status).toBe(200);
    expect(requested.body.data.flags.reassignmentRequested).toBe(true);

    const queue = await s.supervisor.get('/reassignments');
    expect(queue.body.data).toHaveLength(1);

    const rejected = await s.supervisor.post(`/reassignments/${assignmentId}/reject`, {
      note: 'The key is at the front desk',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.liveAssignment.status).toBe('ACCEPTED');
    expect((await s.supervisor.get('/reassignments')).body.data).toHaveLength(0);
  });

  it('reassigns: the old assignment is superseded, never deleted, and the old assignee can no longer act', async () => {
    const other = await addMember(s.org.id, 'INTERVENANT', { names: ['Anna', 'Roussel'], siteIds: [s.site.id] });
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const first = await assign(created.reference, created.version);
    const firstId = first.body.data.liveAssignment.id as string;
    const second = await assign(created.reference, first.body.data.version, other.membership.id);
    expect(second.status).toBe(200);
    expect(second.body.data.liveAssignment.intervenant.membershipId).toBe(other.membership.id);
    expect((await prisma.assignment.findUniqueOrThrow({ where: { id: firstId } })).status).toBe('SUPERSEDED');

    const late = await s.tech.post(`/assignments/${firstId}/accept`);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('sends a resolved incident back to work with a reason', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const assigned = await assign(created.reference, created.version);
    const assignmentId = assigned.body.data.liveAssignment.id as string;
    await s.tech.post(`/assignments/${assignmentId}/accept`);
    await s.tech.post(`/assignments/${assignmentId}/resolve`, { note: 'Tightened the joint, should be fine now.' });
    const current = await detail(s.supervisor, created.reference);
    const sentBack = await s.supervisor.post(`/incidents/${created.reference}/send-back`, {
      expectedVersion: current.version,
      reason: 'Still dripping this morning, please check again.',
    });
    expect(sentBack.status).toBe(200);
    expect(sentBack.body.data.status).toBe('IN_PROGRESS');
    expect(sentBack.body.data.flags.sentBack).toBe(true);
  });

  it('dismisses from NEW only, with a reason', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const dismissed = await s.supervisor.post(`/incidents/${created.reference}/dismiss`, {
      expectedVersion: created.version,
      reason: 'DUPLICATE',
    });
    expect(dismissed.status).toBe(200);
    expect(dismissed.body.data.status).toBe('CLOSED');
    expect(dismissed.body.data.dismissReason).toBe('DUPLICATE');
  });
});

describe('state machine and invariants', () => {
  it('refuses transitions that are not allowed from the current state', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const close = await s.supervisor.post(`/incidents/${created.reference}/close`, {
      expectedVersion: created.version,
    });
    expect(close.status).toBe(409);
    expect(close.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('lets only one of two concurrent assignments win (6.4)', async () => {
    const other = await addMember(s.org.id, 'INTERVENANT', { siteIds: [s.site.id] });
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const [a, b] = await Promise.all([
      assign(created.reference, created.version),
      assign(created.reference, created.version, other.membership.id),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('CONFLICT_CONCURRENT_UPDATE');
    expect(await prisma.assignment.count({ where: { incidentId: created.id } })).toBe(1);
  });

  it('refuses an intervenant without access to the site (I10)', async () => {
    const outsider = await addMember(s.org.id, 'INTERVENANT', { siteIds: [] });
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const response = await assign(created.reference, created.version, outsider.membership.id);
    expect(response.status).toBe(422);
  });

  it('keeps closed incidents read-only, including comments (I8)', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    await s.supervisor.post(`/incidents/${created.reference}/dismiss`, {
      expectedVersion: created.version,
      reason: 'NO_ACTION_NEEDED',
    });
    const comment = await s.supervisor.post(`/incidents/${created.reference}/comments`, {
      body: 'Late note',
      visibility: 'INTERNAL',
    });
    expect(comment.status).toBe(409);
    await expect(prisma.incident.update({ where: { id: created.id }, data: { priority: 'LOW' } })).rejects.toThrow();
  });

  it('never changes the original report (I5) and keeps audit rows append-only (I7)', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    await expect(prisma.incident.update({ where: { id: created.id }, data: { title: 'Edited' } })).rejects.toThrow();
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { incidentId: created.id } });
    await expect(prisma.auditEvent.update({ where: { id: event.id }, data: { payload: {} } })).rejects.toThrow();
    await expect(prisma.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow();
  });

  it('allows at most one live assignment per incident at the database level (I4)', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const data = {
      organizationId: s.org.id,
      incidentId: created.id,
      intervenantMembershipId: s.intervenant.membership.id,
      assignedByMembershipId: s.owner.membership.id,
    };
    await prisma.assignment.create({ data });
    await expect(prisma.assignment.create({ data })).rejects.toThrow();
  });
});

describe('idempotency', () => {
  const body = () => ({
    title: 'Light flickering',
    description: 'The ceiling light in meeting room 2 keeps flickering.',
    siteId: s.site.id,
    categoryId: s.category.id,
  });

  it('replays a retried create instead of creating a duplicate', async () => {
    const headers = { 'Idempotency-Key': 'offline-retry-1' };
    const first = await s.reporter.post('/incidents', body(), headers);
    const second = await s.reporter.post('/incidents', body(), headers);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.reference).toBe(first.body.data.reference);
    expect(await prisma.incident.count()).toBe(1);
  });

  it('rejects the same key with a different body', async () => {
    const headers = { 'Idempotency-Key': 'offline-retry-2' };
    await s.reporter.post('/incidents', body(), headers);
    const reused = await s.reporter.post('/incidents', { ...body(), title: 'Something else' }, headers);
    expect(reused.status).toBe(422);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });
});

describe('what each role sees', () => {
  it('hides internal comments and progress notes from the employee', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const assigned = await assign(created.reference, created.version);
    const assignmentId = assigned.body.data.liveAssignment.id as string;
    await s.tech.post(`/assignments/${assignmentId}/accept`);
    await s.tech.post(`/assignments/${assignmentId}/progress`, { progressType: 'BLOCKED', note: 'Need a part' });
    await s.supervisor.post(`/incidents/${created.reference}/comments`, {
      body: 'Supplier is slow, escalate',
      visibility: 'INTERNAL',
    });
    await s.supervisor.post(`/incidents/${created.reference}/comments`, { body: 'We are on it', visibility: 'PUBLIC' });

    const employeeThread = (await s.reporter.get(`/incidents/${created.reference}/thread`)).body.data as ThreadEvent[];
    const types = employeeThread.map((e) => e.type);
    expect(types).not.toContain('PROGRESS_POSTED');
    expect(employeeThread.filter((e) => e.type === 'COMMENT_ADDED')).toHaveLength(1);

    const techThread = (await s.tech.get(`/incidents/${created.reference}/thread`)).body.data as ThreadEvent[];
    expect(techThread.filter((e) => e.type === 'COMMENT_ADDED')).toHaveLength(2);
  });

  it('scopes lists: employees see their own reports, intervenants their assignments', async () => {
    const colleague = await addMember(s.org.id, 'REPORTER');
    const colleagueClient = await signIn(colleague.user.email, s.org.id);
    await reportIncident(colleagueClient, s.site.id, s.category.id);
    const mine = await reportIncident(s.reporter, s.site.id, s.category.id);

    const employeeList = (await s.reporter.get('/incidents?view=all')).body.data as { reference: string }[];
    expect(employeeList.map((i) => i.reference)).toEqual([mine.reference]);

    expect((await s.tech.get('/incidents?view=all')).body.data).toHaveLength(0);
    await assign(mine.reference, mine.version);
    expect((await s.tech.get('/incidents?view=all')).body.data).toHaveLength(1);
    expect((await s.supervisor.get('/incidents?view=all')).body.data).toHaveLength(2);
  });

  it('notifies the right people and never the actor', async () => {
    const created = await reportIncident(s.reporter, s.site.id, s.category.id);
    const supervisorNotes = await prisma.notification.findMany({
      where: { recipientMembershipId: s.owner.membership.id },
    });
    expect(supervisorNotes.map((n) => n.type)).toContain('INCIDENT_CREATED');
    expect(await prisma.notification.count({ where: { recipientMembershipId: s.employee.membership.id } })).toBe(0);

    await assign(created.reference, created.version);
    const techNotes = await prisma.notification.findMany({
      where: { recipientMembershipId: s.intervenant.membership.id },
    });
    expect(techNotes.map((n) => n.type)).toEqual(['ASSIGNED']);
    const unread = await s.tech.get('/notifications/unread-count');
    expect(unread.body.data.count).toBe(1);
  });
});
