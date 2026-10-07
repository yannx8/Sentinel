import type { InvitationDTO, MemberDTO, MembershipRole } from '@sentinel/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { InvitationsTable } from './invitations-table';
import type { InviteDraft } from './invite-dialog';
import { InviteMenu, useInvitableRoles } from './invite-menu';
import { MemberTable } from './member-table';

function LoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useT();
  return (
    <EmptyState
      title={t('common.errorTitle')}
      description={t('team.loadError')}
      action={
        <Button onClick={onRetry} loading={retrying}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}

function NoMatch({ onClear, searchOnly }: { onClear: () => void; searchOnly?: boolean }) {
  const { t } = useT();
  return (
    <EmptyState
      title={t('team.noMatch.title')}
      description={t(searchOnly ? 'team.noMatch.searchBody' : 'team.noMatch.body')}
      action={
        <Button icon={<X className="size-4" aria-hidden />} onClick={onClear}>
          {t(searchOnly ? 'team.filters.clearSearch' : 'team.filters.clear')}
        </Button>
      }
    />
  );
}

const emptyKeys = {
  REPORTER: { title: 'team.empty.REPORTER.title', body: 'team.empty.REPORTER.body' },
  INTERVENANT: { title: 'team.empty.INTERVENANT.title', body: 'team.empty.INTERVENANT.body' },
  SUPERVISOR: { title: 'team.empty.SUPERVISOR.title', body: 'team.empty.SUPERVISOR.body' },
} as const;

/** One role's tab: skeleton, error, empty, no match or the table. */
export function MembersPanel({
  role,
  query,
  filtered,
  onOpen,
  onInvite,
  onInviteAgain,
  onClear,
}: {
  role: MembershipRole;
  query: UseQueryResult<MemberDTO[]>;
  /** A search or status filter is on, so an empty list means "no match", not "nobody yet". */
  filtered: boolean;
  onOpen: (member: MemberDTO) => void;
  onInvite: (role: MembershipRole) => void;
  onInviteAgain: (draft: InviteDraft) => void;
  onClear: () => void;
}) {
  const { t } = useT();
  const invitable = useInvitableRoles();
  let body: ReactNode;

  if (query.isPending) {
    body = <MemberTable role={role} members={[]} loading onOpen={onOpen} onInviteAgain={onInviteAgain} />;
  } else if (query.isError && !query.data) {
    body = <LoadError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  } else if (query.data.length === 0) {
    body = filtered ? (
      <NoMatch onClear={onClear} />
    ) : (
      <EmptyState
        title={t(emptyKeys[role].title)}
        description={t(emptyKeys[role].body)}
        action={
          invitable.includes(role) ? (
            <Button onClick={() => onInvite(role)}>{t(`team.actions.inviteRole.${role}`)}</Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div
        className={cn('transition-opacity duration-150', query.isPlaceholderData && 'opacity-60')}
        aria-busy={query.isPlaceholderData || undefined}
      >
        <MemberTable role={role} members={query.data} onOpen={onOpen} onInviteAgain={onInviteAgain} />
      </div>
    );
  }
  return <Panel>{body}</Panel>;
}

/** Each word must appear in the name or the email, like the member search of the API. */
export function matchInvitations(invitations: InvitationDTO[], q: string | undefined) {
  const terms = q?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (terms.length === 0) return invitations;
  return invitations.filter((invitation) => {
    const text = `${invitation.firstName} ${invitation.lastName} ${invitation.email}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export function InvitationsPanel({
  query,
  q,
  onInvite,
  onClear,
}: {
  query: UseQueryResult<InvitationDTO[]>;
  q: string | undefined;
  onInvite: (role: MembershipRole) => void;
  onClear: () => void;
}) {
  const { t } = useT();
  let body: ReactNode;

  if (query.isPending) {
    body = <InvitationsTable invitations={[]} loading />;
  } else if (query.isError && !query.data) {
    body = <LoadError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        title={t('team.empty.invitations.title')}
        description={t('team.empty.invitations.body')}
        action={<InviteMenu onSelect={onInvite} variant="secondary" align="center" />}
      />
    );
  } else {
    const rows = matchInvitations(query.data, q);
    body = rows.length === 0 ? <NoMatch onClear={onClear} searchOnly /> : <InvitationsTable invitations={rows} />;
  }
  return <Panel>{body}</Panel>;
}
