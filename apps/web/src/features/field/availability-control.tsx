import { availabilities, type Availability } from '@sentinel/shared';
import { useId } from 'react';
import { useSession } from '../../app/session';
import { Skeleton } from '../../components/ui/feedback';
import { Segmented } from '../../components/ui/segmented';
import { useT } from '../../i18n';
import { largeSegments } from './parts';
import { useMembershipSelf, useSetAvailability } from './queries';

/** One availability for every organization the intervenant serves. Large segments so it works with gloves. */
export function AvailabilityControl() {
  const { t } = useT();
  const id = useId();
  const { me } = useSession();
  const query = useMembershipSelf();
  const change = useSetAvailability();
  const value = query.data?.availability ?? null;
  const many = (me?.memberships.filter((m) => m.role === 'INTERVENANT').length ?? 0) > 1;
  const label = many ? t('field.work.availabilityAll') : t('field.work.availability');

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
