import type { MemberDTO, MembershipRole } from '@sentinel/shared';
import { useState, type ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT, type TKey } from '../../i18n';
import { cn } from '../../lib/cn';
import type { InviteDraft } from './invite-dialog';
import { MemberActions } from './member-actions';
import { AvailabilityLabel, DateText, MemberStatusBadge, NameChips, NotSet, PersonCell, Text, fullName } from './parts';
import { usePlural } from './plural';

type Column = {
  key: string;
  header: TKey;
  /** Applied to the header and the cells, for responsive hiding and alignment. */
  className?: string;
  cell: (member: MemberDTO) => ReactNode;
  skeleton?: string;
};

const numeric = 'text-right tabular-nums';

function Count({ value }: { value: number }) {
  const { number } = useT();
  return <span className={cn(value === 0 ? 'text-ink-3' : 'text-ink')}>{number(value)}</span>;
}

const columns: Record<MembershipRole, Column[]> = {
  REPORTER: [
    {
      key: 'code',
      header: 'team.columns.employeeCode',
      className: 'hidden sm:table-cell',
      cell: (m) => <Text value={m.employee?.employeeCode} className="max-w-32 tabular-nums" />,
      skeleton: 'w-16',
    },
    {
      key: 'job',
      header: 'team.columns.jobTitle',
      className: 'hidden lg:table-cell',
      cell: (m) => <Text value={m.employee?.jobTitle} className="max-w-48" />,
    },
    {
      key: 'department',
      header: 'team.columns.department',
      className: 'hidden xl:table-cell',
      cell: (m) => <Text value={m.employee?.department} className="max-w-40" />,
    },
    {
      key: 'site',
      header: 'team.columns.homeSite',
      className: 'hidden md:table-cell',
      cell: (m) => <Text value={m.employee?.homeSite?.name} className="max-w-44" />,
    },
    {
      key: 'status',
      header: 'team.columns.status',
      cell: (m) => <MemberStatusBadge status={m.status} />,
      skeleton: 'w-14',
    },
    {
      key: 'joined',
      header: 'team.columns.joined',
      className: 'hidden lg:table-cell',
      cell: (m) => <DateText iso={m.joinedAt} />,
      skeleton: 'w-20',
    },
  ],
  INTERVENANT: [
    {
      key: 'company',
      header: 'team.columns.company',
      className: 'hidden md:table-cell',
      cell: (m) => <Text value={m.intervenant?.companyName} className="max-w-44" />,
    },
    {
      key: 'specialties',
      header: 'team.columns.specialties',
      className: 'hidden lg:table-cell',
      cell: (m) => <NameChips names={m.intervenant?.specialties.map((specialty) => specialty.name) ?? []} />,
      skeleton: 'w-32',
    },
    {
      key: 'sites',
      header: 'team.columns.sites',
      className: cn('hidden sm:table-cell', numeric),
      cell: (m) => <Count value={m.intervenant?.sites.length ?? 0} />,
      skeleton: 'ml-auto w-6',
    },
    {
      key: 'availability',
      header: 'team.columns.availability',
      className: 'hidden sm:table-cell',
      cell: (m) => (m.intervenant ? <AvailabilityLabel availability={m.intervenant.availability} /> : <NotSet />),
      skeleton: 'w-20',
    },
    {
      key: 'live',
      header: 'team.columns.live',
      className: cn('hidden md:table-cell', numeric),
      cell: (m) => <Count value={m.intervenant?.liveAssignments ?? 0} />,
      skeleton: 'ml-auto w-6',
    },
    {
      key: 'status',
      header: 'team.columns.status',
      cell: (m) => <MemberStatusBadge status={m.status} />,
      skeleton: 'w-14',
    },
  ],
  SUPERVISOR: [
    {
      key: 'role',
      header: 'team.columns.role',
      cell: (m) => <SupervisorRole owner={m.isOwner} />,
      skeleton: 'w-20',
    },
    {
      key: 'status',
      header: 'team.columns.status',
      cell: (m) => <MemberStatusBadge status={m.status} />,
      skeleton: 'w-14',
    },
    {
      key: 'joined',
      header: 'team.columns.joined',
      className: 'hidden sm:table-cell',
      cell: (m) => <DateText iso={m.joinedAt} />,
      skeleton: 'w-20',
    },
  ],
};

function SupervisorRole({ owner }: { owner: boolean }) {
  const { t } = useT();
  return owner ? (
    <Badge>{t('common.role.OWNER')}</Badge>
  ) : (
    <span className="text-ink-2">{t('common.role.SUPERVISOR')}</span>
  );
}

/** Rows rendered at once. Larger teams reveal more on demand, so the page stays fast. */
const STEP = 100;

function SkeletonRows({ role }: { role: MembershipRole }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, row) => (
        <Tr key={row}>
          <Td>
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="grid gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          </Td>
          {columns[role].map((column) => (
            <Td key={column.key} className={column.className}>
              <Skeleton className={cn('h-3.5', column.skeleton ?? 'w-24')} />
            </Td>
          ))}
          <Td className="w-12" />
        </Tr>
      ))}
    </>
  );
}

/** One role's members. A row opens the member sheet; the last cell holds the actions menu. */
export function MemberTable({
  role,
  members,
  loading,
  onOpen,
  onInviteAgain,
}: {
  role: MembershipRole;
  members: MemberDTO[];
  loading?: boolean;
  onOpen: (member: MemberDTO) => void;
  onInviteAgain: (draft: InviteDraft) => void;
}) {
  const { t, number } = useT();
  const tn = usePlural();
  const membership = useMembership();
  const [limit, setLimit] = useState(STEP);
  const shown = members.slice(0, limit);
  const remaining = members.length - shown.length;

  return (
    <>
      <Table>
        <caption className="sr-only">{t(`common.roles.${role}`)}</caption>
        <THead>
          <tr>
            <Th>{t('team.columns.name')}</Th>
            {columns[role].map((column) => (
              <Th key={column.key} className={column.className}>
                {t(column.header)}
              </Th>
            ))}
            <Th className="w-12">
              <span className="sr-only">{t('team.columns.actions')}</span>
            </Th>
          </tr>
        </THead>
        <tbody>
          {loading ? (
            <SkeletonRows role={role} />
          ) : (
            shown.map((member) => (
              <Tr key={member.id} interactive onClick={() => onOpen(member)}>
                <Td className="py-1.5">
                  <PersonCell
                    name={fullName(member)}
                    email={member.email}
                    onOpen={() => onOpen(member)}
                    flags={member.id === membership.id ? <Badge tone="outline">{t('common.you')}</Badge> : null}
                  />
                </Td>
                {columns[role].map((column) => (
                  <Td key={column.key} className={column.className}>
                    {column.cell(member)}
                  </Td>
                ))}
                <Td className="w-12 text-right last:pr-2" onClick={(event) => event.stopPropagation()}>
                  <MemberActions member={member} onInviteAgain={onInviteAgain} />
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
      {remaining > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-3 tabular-nums" aria-live="polite">
            {t('team.showing', { shown: number(shown.length), total: number(members.length) })}
          </p>
          <Button size="sm" onClick={() => setLimit((value) => value + STEP)}>
            {tn('team.showMore', Math.min(STEP, remaining))}
          </Button>
        </div>
      )}
    </>
  );
}
