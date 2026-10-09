/**
 * Employee CSV import (docs/PRD.md F-PPL-02). A dry run reports what would
 * happen to each row. A real run re-checks every row under the invitation lock
 * and invites the valid ones exactly like single invitations.
 */
import type { Prisma } from '../../generated/prisma/client';
import {
  employeeProfileSchema,
  inviteMemberSchema,
  parseCsv,
  type importEmployeesSchema,
  type ImportResult,
  type ImportRowResult,
} from '@sentinel/shared';
import type { z } from 'zod';
import type { Tenant } from '../../auth/context';
import { hashToken, newToken } from '../../lib/crypto';
import { prisma, type Tx } from '../../lib/prisma';
import { AppError } from '../../http/errors';
import {
  currentStatuses,
  employeeProfileJson,
  INVITATION_TTL_MS,
  lockInvitations,
  messages,
  pendingInvitationWhere,
  sendInvitationEmail,
} from './service';

type Db = Tx | typeof prisma;
export type ImportEmployeesInput = z.output<typeof importEmployeesSchema>;

const MAX_ROWS = 2000;
const MAIL_BATCH = 10;
const requiredColumns = ['email', 'first_name', 'last_name'] as const;
const optionalColumns = ['employee_code', 'job_title', 'department', 'home_site_code'] as const;
type Column = (typeof requiredColumns)[number] | (typeof optionalColumns)[number];

const reporterInviteSchema = inviteMemberSchema.options[0];
type ReporterInvite = z.output<typeof reporterInviteSchema>;

/** Plain words for each field the row schema can reject. */
const fieldMessages: Record<string, string> = {
  email: 'Enter a valid email address.',
  firstName: 'Add a first name of 60 characters at most.',
  lastName: 'Add a last name of 60 characters at most.',
  'employee.employeeCode': 'Keep the employee code to 40 characters at most.',
  'employee.jobTitle': 'Keep the job title to 80 characters at most.',
  'employee.department': 'Keep the department to 80 characters at most.',
};

type Row = {
  line: number;
  email: string;
  code: string;
  input: ReporterInvite | null;
  status: ImportRowResult['status'];
  errors: string[];
};

function csvError(message: string) {
  return new AppError('VALIDATION_FAILED', message, { fields: { csv: [message] } });
}

/** Column positions by name. Headers match case-insensitively, and "First name" reads as first_name. */
function readHeader(cells: string[]): Map<Column, number> {
  const known: readonly Column[] = [...requiredColumns, ...optionalColumns];
  const columns = new Map<Column, number>();
  cells.forEach((cell, index) => {
    const name = cell
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const column = known.find((c) => c === name);
    if (column && !columns.has(column)) columns.set(column, index);
  });
  const missing = requiredColumns.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    throw csvError(
      `Add the missing ${missing.length === 1 ? 'column' : 'columns'} to the header row: ${missing.join(', ')}.`,
    );
  }
  return columns;
}

function readRow(cells: string[], line: number, columns: Map<Column, number>, siteIdByCode: Map<string, string>): Row {
  const cell = (column: Column) => {
    const index = columns.get(column);
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const email = cell('email').toLowerCase();
  const code = cell('employee_code');
  const errors: string[] = [];

  let homeSiteId: string | null = null;
  const siteCode = cell('home_site_code');
  if (siteCode) {
    homeSiteId = siteIdByCode.get(siteCode.toUpperCase()) ?? null;
    if (!homeSiteId) errors.push(`No site has the code ${siteCode}. Use a code from the Sites page.`);
  }

  const parsed = reporterInviteSchema.safeParse({
    role: 'REPORTER',
    email,
    firstName: cell('first_name'),
    lastName: cell('last_name'),
    employee: { employeeCode: code, jobTitle: cell('job_title'), department: cell('department'), homeSiteId },
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const message = fieldMessages[issue.path.join('.')] ?? 'Check the values in this row.';
      if (!errors.includes(message)) errors.push(message);
    }
  }
  return { line, email, code, input: parsed.success ? parsed.data : null, status: 'READY', errors };
}

/** Marks every row READY, SKIPPED or ERROR against the file itself and the organization's current data. */
async function evaluate(db: Db, tenant: Tenant, rows: Row[]) {
  const firstLineByEmail = new Map<string, number>();
  const firstLineByCode = new Map<string, number>();
  for (const row of rows) {
    if (row.email) {
      const first = firstLineByEmail.get(row.email);
      if (first === undefined) firstLineByEmail.set(row.email, row.line);
      else row.errors.push(`This email is already on line ${first}.`);
    }
    if (row.code) {
      const first = firstLineByCode.get(row.code);
      if (first === undefined) firstLineByCode.set(row.code, row.line);
      else row.errors.push(`Employee code ${row.code} is already on line ${first}.`);
    }
  }

  const emails = [...firstLineByEmail.keys()];
  const codes = [...firstLineByCode.keys()];
  const [members, employeesElsewhere, pending, codeHolders] = await Promise.all([
    db.membership.findMany({
      where: { organizationId: tenant.orgId, status: { in: currentStatuses }, user: { email: { in: emails } } },
      select: { user: { select: { email: true } } },
    }),
    db.membership.findMany({
      where: {
        organizationId: { not: tenant.orgId },
        role: 'REPORTER',
        status: { in: currentStatuses },
        user: { email: { in: emails } },
      },
      select: { user: { select: { email: true } } },
    }),
    db.invitation.findMany({
      where: {
        organizationId: tenant.orgId,
        ...pendingInvitationWhere(),
        OR: [{ email: { in: emails } }, { role: 'REPORTER' }],
      },
      select: { email: true, role: true, profile: true },
    }),
    db.employeeProfile.findMany({
      where: { organizationId: tenant.orgId, employeeCode: { in: codes } },
      select: { employeeCode: true, membership: { select: { user: { select: { email: true } } } } },
    }),
  ]);

  const memberEmails = new Set(members.map((m) => m.user.email));
  const elsewhereEmails = new Set(employeesElsewhere.map((m) => m.user.email));
  const pendingEmails = new Set(pending.map((invitation) => invitation.email));
  // Code to the email of whoever holds it. The person's own revoked profile does not count.
  const codeOwner = new Map<string, string>();
  for (const profile of codeHolders) {
    if (profile.employeeCode) codeOwner.set(profile.employeeCode, profile.membership.user.email);
  }
  for (const invitation of pending) {
    if (invitation.role !== 'REPORTER') continue;
    const profile = employeeProfileSchema.safeParse(invitation.profile);
    if (profile.success && profile.data.employeeCode) codeOwner.set(profile.data.employeeCode, invitation.email);
  }

  for (const row of rows) {
    // Nothing would happen to these rows, so their other problems do not matter.
    if (memberEmails.has(row.email)) {
      row.status = 'SKIPPED';
      row.errors = ['Already a member of this organization.'];
      continue;
    }
    if (pendingEmails.has(row.email)) {
      row.status = 'SKIPPED';
      row.errors = ['An invitation is already pending for this email.'];
      continue;
    }
    if (elsewhereEmails.has(row.email)) row.errors.push(messages.employeeElsewhere);
    const owner = row.code ? codeOwner.get(row.code) : undefined;
    if (row.code && owner !== undefined && owner !== row.email) row.errors.push(messages.employeeCodeTaken(row.code));
    row.status = row.errors.length > 0 || !row.input ? 'ERROR' : 'READY';
  }
}

/** One statement per table for up to 2,000 rows. Rows match what inviteMember writes for one person. */
async function createInvitations(tx: Tx, tenant: Tenant, invites: { input: ReporterInvite; token: string }[]) {
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await tx.invitation.createMany({
    data: invites.map(({ input, token }) => ({
      organizationId: tenant.orgId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'REPORTER' as const,
      profile: employeeProfileJson(input.employee),
      tokenHash: hashToken(token),
      invitedByMembershipId: tenant.membershipId,
      expiresAt,
    })),
  });
  await tx.auditEvent.createMany({
    data: invites.map(({ input }) => ({
      organizationId: tenant.orgId,
      actorMembershipId: tenant.membershipId,
      actorUserId: tenant.userId,
      type: 'MEMBER_INVITED' as const,
      payload: {
        email: input.email,
        role: 'REPORTER',
        name: `${input.firstName} ${input.lastName}`,
      } satisfies Prisma.InputJsonObject,
    })),
  });
}

function summarize(dryRun: boolean, rows: Row[]): ImportResult {
  const count = (status: ImportRowResult['status']) => rows.filter((row) => row.status === status).length;
  return {
    dryRun,
    total: rows.length,
    ready: count('READY'),
    created: count('CREATED'),
    skipped: count('SKIPPED'),
    failed: count('ERROR'),
    rows: rows.map(({ line, email, status, errors }) => ({ line, email, status, errors })),
  };
}

/** Line numbers count the header as line 1. */
export async function importEmployees(tenant: Tenant, input: ImportEmployeesInput): Promise<ImportResult> {
  const [header, ...cells] = parseCsv(input.csv);
  if (!header) throw csvError('The file is empty. Add a header row and one row per employee.');
  const columns = readHeader(header);
  if (cells.length === 0) throw csvError('The file has no employees. Add one row per employee under the header row.');
  if (cells.length > MAX_ROWS) {
    throw csvError(`The file has ${cells.length} employees. Import at most 2,000 at a time by splitting the file.`);
  }

  const sites = await prisma.site.findMany({
    where: { organizationId: tenant.orgId },
    select: { id: true, code: true },
  });
  const siteIdByCode = new Map(sites.map((site) => [site.code.toUpperCase(), site.id]));
  const rows = cells.map((row, index) => readRow(row, index + 2, columns, siteIdByCode));

  if (input.dryRun) {
    await evaluate(prisma, tenant, rows);
    return summarize(true, rows);
  }

  const invites = await prisma.$transaction(
    async (tx) => {
      await lockInvitations(tx, tenant);
      await evaluate(tx, tenant, rows);
      const ready = rows.flatMap((row) =>
        row.status === 'READY' && row.input ? [{ row, input: row.input, token: newToken() }] : [],
      );
      if (ready.length > 0) await createInvitations(tx, tenant, ready);
      return ready;
    },
    { timeout: 60_000 },
  );

  for (const { row } of invites) row.status = 'CREATED';
  for (let start = 0; start < invites.length; start += MAIL_BATCH) {
    await Promise.all(
      invites.slice(start, start + MAIL_BATCH).map(async ({ row, input, token }) => {
        const sent = await sendInvitationEmail(
          tenant,
          { email: input.email, firstName: input.firstName, role: 'REPORTER' },
          token,
        );
        if (!sent) row.errors.push('The invitation email was not sent. Resend it from the invitations list.');
      }),
    );
  }
  return summarize(false, rows);
}
