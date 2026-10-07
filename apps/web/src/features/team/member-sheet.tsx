import type { MemberDTO } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button, IconButton } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { useT } from '../../i18n';
import { draftFromMember, type InviteDraft } from './invite-dialog';
import { MemberActions } from './member-actions';
import { AvailabilityLabel, DateText, MemberStatusBadge, NotSet, fullName } from './parts';
import { usePlural } from './plural';
import { EmployeeProfileForm, IntervenantProfileForm } from './profile-forms';
import { useMember } from './queries';

const linkClass = 'text-accent underline-offset-2 hover:underline';

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 truncate text-ink">{children}</dd>
    </div>
  );
}

function Details({ member }: { member: MemberDTO }) {
  const { t } = useT();
  const tn = usePlural();
  const id = useId();
  const live = member.intervenant?.liveAssignments ?? 0;
  return (
    <section aria-labelledby={id} className="border-b border-line px-5 py-5">
      <h3 id={id} className="text-sm font-semibold text-ink">
        {t('team.sheet.details')}
      </h3>
      <dl className="mt-3 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        <DetailRow label={t('team.fields.email')}>
          <a href={`mailto:${member.email}`} className={linkClass}>
            {member.email}
          </a>
        </DetailRow>
        <DetailRow label={t('team.sheet.phone')}>
          {member.phone ? (
            <a href={`tel:${member.phone.replace(/[^\d+]/g, '')}`} className={linkClass}>
              {member.phone}
            </a>
          ) : (
            <NotSet />
          )}
        </DetailRow>
        <DetailRow label={t('team.columns.joined')}>
          <DateText iso={member.joinedAt} />
        </DetailRow>
        {member.intervenant && (
          <>
            <DetailRow label={t('team.columns.availability')}>
              <AvailabilityLabel availability={member.intervenant.availability} />
            </DetailRow>
            <DetailRow label={t('team.columns.live')}>
              {live > 0 ? (
                <Link to="/app/incidents" search={{ assignee: member.id }} className={linkClass}>
                  {tn('team.sheet.liveLink', live)}
                </Link>
              ) : (
                <span className="text-ink-2">{t('team.sheet.noLive')}</span>
              )}
            </DetailRow>
          </>
        )}
      </dl>
    </section>
  );
}

/** A short note under the header when this member's access works differently. */
function Note({ member, onInviteAgain }: { member: MemberDTO; onInviteAgain: (draft: InviteDraft) => void }) {
  const { t } = useT();
  const membership = useMembership();
  let content: ReactNode = null;
  if (member.id === membership.id) {
    content = (
      <>
        {t('team.sheet.selfNote')}{' '}
        <Link to="/app/account" className={linkClass}>
          {t('team.sheet.selfLink')}
        </Link>
      </>
    );
  } else if (member.status === 'REVOKED') {
    const canInvite = member.role !== 'SUPERVISOR' || membership.isOwner;
    content = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{t('team.sheet.revokedNote', { name: member.firstName })}</span>
        {canInvite && (
          <Button size="sm" onClick={() => onInviteAgain(draftFromMember(member))}>
            {t('team.actions.inviteAgain')}
          </Button>
        )}
      </div>
    );
  } else if (member.isOwner) {
    content = t('team.sheet.ownerNote', { name: member.firstName });
  } else if (member.status === 'SUSPENDED') {
    content = t('team.sheet.suspendedNote', { name: member.firstName });
  }
  if (!content) return null;
  return <div className="mx-5 mt-5 rounded-md bg-subtle px-3.5 py-3 text-sm text-ink-2">{content}</div>;
}

function SheetBody({
  member,
  onClose,
  onInviteAgain,
}: {
  member: MemberDTO;
  onClose: () => void;
  onInviteAgain: (draft: InviteDraft) => void;
}) {
  const { t } = useT();
  const membership = useMembership();
  const name = fullName(member);
  const self = member.id === membership.id;
  const editable = member.status !== 'REVOKED';
  const before = (
    <>
      <Note member={member} onInviteAgain={onInviteAgain} />
      <Details member={member} />
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <Avatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-ink">{name}</h2>
          <p className="truncate text-sm text-ink-3">{member.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{t(member.isOwner ? 'common.role.OWNER' : `common.role.${member.role}`)}</Badge>
            <MemberStatusBadge status={member.status} />
            {self && <Badge tone="outline">{t('common.you')}</Badge>}
          </div>
        </div>
        <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">
          <MemberActions member={member} onInviteAgain={onInviteAgain} />
          <IconButton label={t('common.close')} size="sm" onClick={onClose} tooltip={false}>
            <X className="size-4" />
          </IconButton>
        </div>
      </header>

      {member.role === 'REPORTER' ? (
        <EmployeeProfileForm key={member.id} member={member} before={before} editable={editable} />
      ) : member.role === 'INTERVENANT' ? (
        <IntervenantProfileForm key={member.id} member={member} before={before} editable={editable} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">{before}</div>
      )}
    </div>
  );
}

/**
 * Right slide-over with one member's details and profile. It opens at once
 * with the row's data and refreshes from the API.
 */
export function MemberSheet({
  member: opened,
  onClose,
  onInviteAgain,
}: {
  member: MemberDTO | null;
  onClose: () => void;
  onInviteAgain: (draft: InviteDraft) => void;
}) {
  const query = useMember(opened?.id ?? null, opened ?? undefined);
  const member = query.data ?? opened;
  return (
    <Sheet open={opened !== null} onOpenChange={(open) => !open && onClose()} title={member ? fullName(member) : ''}>
      {member && <SheetBody member={member} onClose={onClose} onInviteAgain={onInviteAgain} />}
    </Sheet>
  );
}
