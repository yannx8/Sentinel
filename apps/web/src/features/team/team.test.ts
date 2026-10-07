import { parseCsv, type InvitationDTO, type MemberDTO, type MembershipSummary } from '@sentinel/shared';
import { describe, expect, it } from 'vitest';
import { importColumns, readCsv, templateCsv } from './csv';
import { memberActions } from './member-actions';
import { matchInvitations } from './team-panels';

function membership(overrides: Partial<MembershipSummary> = {}): MembershipSummary {
  return {
    id: 'me',
    role: 'SUPERVISOR',
    isOwner: false,
    organization: {
      id: 'org',
      displayName: 'Acme',
      status: 'ACTIVE',
      timezone: 'Europe/Paris',
      defaultLocale: 'en',
      ownerName: null,
      ownerEmail: null,
    },
    ...overrides,
  };
}

function member(overrides: Partial<MemberDTO> = {}): MemberDTO {
  return {
    id: 'm1',
    role: 'REPORTER',
    isOwner: false,
    status: 'ACTIVE',
    firstName: 'Lea',
    lastName: 'Moreau',
    email: 'lea.moreau@example.com',
    phone: null,
    joinedAt: '2026-01-05T09:00:00.000Z',
    employee: null,
    intervenant: null,
    ...overrides,
  };
}

const describeActions = (target: MemberDTO, viewer: MembershipSummary) =>
  memberActions(target, viewer).map((action) =>
    action.blockedBy ? `${action.key} (${action.blockedBy})` : action.key,
  );

describe('memberActions', () => {
  it('offers nothing on your own membership', () => {
    expect(describeActions(member({ id: 'me', role: 'SUPERVISOR' }), membership({ isOwner: true }))).toEqual([]);
  });

  it('lets any supervisor suspend, reactivate and revoke employees and intervenants', () => {
    expect(describeActions(member(), membership())).toEqual(['suspend', 'revoke']);
    expect(describeActions(member({ role: 'INTERVENANT', status: 'SUSPENDED' }), membership())).toEqual([
      'reactivate',
      'revoke',
    ]);
  });

  it('offers a new invitation to a revoked member', () => {
    expect(describeActions(member({ status: 'REVOKED' }), membership())).toEqual(['inviteAgain']);
  });

  it('shows supervisor changes to other supervisors as blocked', () => {
    expect(describeActions(member({ role: 'SUPERVISOR' }), membership())).toEqual([
      'suspend (team.actions.ownerOnly)',
      'revoke (team.actions.ownerOnly)',
    ]);
    expect(describeActions(member({ role: 'SUPERVISOR', status: 'REVOKED' }), membership())).toEqual([]);
  });

  it('never removes access from the owner', () => {
    const owner = member({ role: 'SUPERVISOR', isOwner: true });
    expect(describeActions(owner, membership())).toEqual([
      'suspend (team.actions.ownerLocked)',
      'revoke (team.actions.ownerLocked)',
    ]);
    expect(describeActions(owner, membership({ isOwner: true }))).toEqual([
      'suspend (team.actions.ownerLocked)',
      'revoke (team.actions.ownerLocked)',
    ]);
  });

  it('lets the owner hand ownership to an active supervisor only', () => {
    const owner = membership({ isOwner: true });
    expect(describeActions(member({ role: 'SUPERVISOR' }), owner)).toEqual(['suspend', 'transfer', 'revoke']);
    expect(describeActions(member({ role: 'SUPERVISOR', status: 'SUSPENDED' }), owner)).toEqual([
      'reactivate',
      'transfer (team.actions.transferActiveOnly)',
      'revoke',
    ]);
    expect(describeActions(member({ role: 'SUPERVISOR', status: 'REVOKED' }), owner)).toEqual(['inviteAgain']);
  });
});

const csvFile = (text: string, name = 'team.csv', type = 'text/csv') => new File([text], name, { type });

describe('readCsv', () => {
  it('reads a semicolon file whose header uses spaces and capitals', async () => {
    const text = 'Email;First name;Last name\nlea@example.com;Léa;Moreau\nkarim@example.com;Karim;Benali\n';
    expect(await readCsv(csvFile(text))).toEqual({ name: 'team.csv', text, rows: 2 });
  });

  it('names the missing required columns', async () => {
    expect(await readCsv(csvFile('email,first_name\nlea@example.com,Lea\n'))).toEqual({
      kind: 'columns',
      missing: ['last_name'],
    });
  });

  it('refuses other file types, empty files and a header alone', async () => {
    expect(await readCsv(csvFile('email', 'team.xlsx', ''))).toEqual({ kind: 'type' });
    expect(await readCsv(csvFile(''))).toEqual({ kind: 'empty' });
    expect(await readCsv(csvFile('email,first_name,last_name\n'))).toEqual({ kind: 'noRows' });
  });

  it('refuses more than 2,000 employees', async () => {
    const rows = Array.from({ length: 2001 }, (_, i) => `p${i}@example.com,P,${i}`).join('\n');
    expect(await readCsv(csvFile(`email,first_name,last_name\n${rows}`))).toEqual({ kind: 'tooMany', rows: 2001 });
  });

  it('writes a template whose example row fills every column', () => {
    const example = Object.fromEntries(importColumns.map((column) => [column, `${column}-value`])) as Record<
      (typeof importColumns)[number],
      string
    >;
    const [header, row] = parseCsv(templateCsv(example));
    expect(header).toEqual([...importColumns]);
    expect(row).toEqual(importColumns.map((column) => `${column}-value`));
  });
});

describe('matchInvitations', () => {
  const invitation = (firstName: string, lastName: string, email: string): InvitationDTO => ({
    id: email,
    email,
    firstName,
    lastName,
    role: 'REPORTER',
    status: 'PENDING',
    invitedBy: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    expiresAt: '2026-10-08T09:00:00.000Z',
  });
  const all = [invitation('Lea', 'Moreau', 'lea@acme.fr'), invitation('Karim', 'Benali', 'kbenali@acme.fr')];

  it('needs every word to appear in the name or the email', () => {
    expect(matchInvitations(all, 'karim ben').map((i) => i.email)).toEqual(['kbenali@acme.fr']);
    expect(matchInvitations(all, 'acme').length).toBe(2);
    expect(matchInvitations(all, 'lea benali')).toEqual([]);
    expect(matchInvitations(all, '  ')).toEqual(all);
  });
});
