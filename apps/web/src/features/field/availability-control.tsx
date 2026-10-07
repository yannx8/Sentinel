import { availabilities, type Availability } from '@sentinel/shared';
import { useId } from 'react';
import { useMembership, useSession } from '../../app/session';
import { Skeleton } from '../../components/ui/feedback';
import { Segmented } from '../../components/ui/segmented';
import { useT } from '../../i18n';
import { largeSegments } from './parts';
import { useMembershipSelf, useSetAvailability } from './queries';

/** Availability in the active organization. Large segments so it works with gloves. */
export function AvailabilityControl() {
  const { t } = useT();
  const id = useId();
  const { me } = useSession();
  const membership = useMembership();
  const query = useMembershipSelf();
  const change = useSetAvailability();
  const value = query.data?.availability ?? null;
  const many = (me?.memberships.length ?? 0) > 1;
  const label = many
    ? t('field.work.availabilityIn', { organization: membership.organization.displayName })
    : t('field.work.availability');

  if (query.isError) return null;

  return (
    <section aria-labelledby={id} className="grid gap-2 border-b border-line pb-5">
      <h2 id={id} className="text-sm font-medium text-ink">
        {label}
      </h2>
      {query.isPending || !value ? (
        <Skeleton className="h-12 w-full rounded-sm" />
      ) : (
        <Segmented<Availability>
          label={label}
          value={value}
          onChange={(next) => {
            if (next !== value) change.mutate(next);
          }}
          options={availabilities.map((option) => ({ value: option, label: t(`common.availability.${option}`) }))}
          className={largeSegments}
        />
      )}
      <p className="text-sm text-ink-3">{t('field.work.availabilityHint')}</p>
    </section>
  );
}
