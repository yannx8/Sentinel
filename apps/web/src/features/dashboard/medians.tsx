import type { DashboardDTO } from '@sentinel/shared';
import { Panel } from '../../components/ui/layout';
import { useT, type TKey } from '../../i18n';

const rows: { key: keyof DashboardDTO['medians']; label: TKey; hint: TKey }[] = [
  { key: 'toAssign', label: 'dashboard.medians.toAssign', hint: 'dashboard.medians.toAssignHint' },
  { key: 'toAcknowledge', label: 'dashboard.medians.toAcknowledge', hint: 'dashboard.medians.toAcknowledgeHint' },
  { key: 'toResolve', label: 'dashboard.medians.toResolve', hint: 'dashboard.medians.toResolveHint' },
];

/** Median minutes from report to each milestone, over the last 30 days. */
export function MedianTimes({ medians }: { medians: DashboardDTO['medians'] }) {
  const { t, duration } = useT();
  return (
    <Panel
      title={t('dashboard.medians.title')}
      actions={<span className="text-xs text-ink-3">{t('dashboard.medians.description')}</span>}
    >
      <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {rows.map((row) => {
          const value = medians[row.key];
          return (
            <div key={row.key} className="flex flex-col-reverse gap-0.5 px-4 py-4">
              <dt className="text-sm text-ink-2">
                <span className="font-medium">{t(row.label)}</span>
                <span className="block text-xs text-ink-3">{t(row.hint)}</span>
              </dt>
              <dd className="text-2xl font-semibold text-ink tabular-nums">
                {value === null ? <span className="text-base font-normal text-ink-3">{t('dashboard.medians.none')}</span> : duration(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}
