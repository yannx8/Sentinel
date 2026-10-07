import type { Availability, InvitationStatus, MembershipStatus } from '@sentinel/shared';
import type { ReactNode } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Badge, type Tone } from '../../components/ui/badge';
import { Tooltip } from '../../components/ui/tooltip';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

export const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`;

const memberTones: Record<MembershipStatus, Tone> = { ACTIVE: 'neutral', SUSPENDED: 'warning', REVOKED: 'outline' };

export function MemberStatusBadge({ status }: { status: MembershipStatus }) {
  const { t } = useT();
  return <Badge tone={memberTones[status]}>{t(`common.memberStatus.${status}`)}</Badge>;
}

const invitationTones: Record<InvitationStatus, Tone> = {
  PENDING: 'neutral',
  EXPIRED: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'outline',
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const { t } = useT();
  return <Badge tone={invitationTones[status]}>{t(`team.invitationStatus.${status}`)}</Badge>;
}

/** Avatar, name and email. The name is a button when the row opens a detail view, so the row works from the keyboard. */
export function PersonCell({
  name,
  email,
  onOpen,
  flags,
}: {
  name: string;
  email: string;
  onOpen?: () => void;
  flags?: ReactNode;
}) {
  return (
    <div className="flex max-w-40 min-w-0 items-center gap-2.5 sm:max-w-64 lg:max-w-80">
      <Avatar name={name} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {onOpen ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              className="truncate rounded-xs text-left font-medium text-ink underline-offset-2 hover:underline"
            >
              {name}
            </button>
          ) : (
            <span className="truncate font-medium text-ink">{name}</span>
          )}
          {flags}
        </div>
        <p className="truncate text-xs text-ink-3">{email}</p>
      </div>
    </div>
  );
}

/** A missing value in a table or a detail list: a quiet dash, read out as "Not set". */
export function NotSet() {
  const { t } = useT();
  return (
    <span className="text-ink-3">
      <span aria-hidden>-</span>
      <span className="sr-only">{t('team.notSet')}</span>
    </span>
  );
}

export function Text({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <NotSet />;
  return <span className={cn('block truncate text-ink-2', className)}>{value}</span>;
}

const availabilityDots: Record<Availability, string> = {
  AVAILABLE: 'bg-success',
  BUSY: 'bg-medium',
  OFF: 'border-[1.5px] border-ink-3',
};

export function AvailabilityLabel({ availability }: { availability: Availability }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <span className={cn('size-2 shrink-0 rounded-full', availabilityDots[availability])} aria-hidden />
      {t(`common.availability.${availability}`)}
    </span>
  );
}

const chipClass =
  'inline-block h-5 shrink-0 rounded-xs bg-muted px-1.5 text-xs leading-5 font-medium whitespace-nowrap text-ink-2';

/** Up to two names, then "+N" with the rest in a tooltip. */
export function NameChips({ names, max = 2 }: { names: string[]; max?: number }) {
  const { t } = useT();
  if (names.length === 0) return <NotSet />;
  const shown = names.slice(0, max);
  const rest = names.slice(max);
  return (
    <span className="flex items-center gap-1">
      {shown.map((name) => (
        <span key={name} className={cn(chipClass, 'max-w-32 truncate')}>
          {name}
        </span>
      ))}
      {rest.length > 0 && (
        <Tooltip content={rest.join(', ')}>
          <span tabIndex={0} className={chipClass}>
            <span aria-hidden>{t('team.moreCount', { count: rest.length })}</span>
            <span className="sr-only">{rest.join(', ')}</span>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

/** Absolute date, with date and time in the tooltip. */
export function DateText({ iso }: { iso: string }) {
  const { date } = useT();
  return (
    <time dateTime={iso} title={date(iso, 'datetime')} className="whitespace-nowrap text-ink-2 tabular-nums">
      {date(iso, 'date')}
    </time>
  );
}

/** Relative under a week, absolute in the tooltip. */
export function RelativeText({ iso }: { iso: string }) {
  const { date, relative } = useT();
  return (
    <time dateTime={iso} title={date(iso, 'datetime')} className="whitespace-nowrap text-ink-2 tabular-nums">
      {relative(iso)}
    </time>
  );
}
