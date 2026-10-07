import { priorities, type AgeingBucket, type DashboardDTO, type Priority } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { IncidentsSearch } from '../../app/router';
import { PriorityIcon, PriorityLabel } from '../../components/domain/glyphs';
import { Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { usePlural } from './plural';
import { cn } from '../../lib/cn';

export type BarItem = {
  key: string;
  /** Accessible text of the row; `display` replaces it visually when given. */
  label: string;
  display?: ReactNode;
  value: number;
  /** Mark colour class. Accent by default; semantic colours only when the row is a priority. */
  tone?: string;
  /** Opens the matching incidents view. */
  search?: IncidentsSearch;
  aside?: ReactNode;
};

/**
 * Horizontal bar list. It is a real table (row header, count) so screen
 * readers get the values; the bars themselves are decoration over the same numbers.
 */
export function BarList({ items, caption, max }: { items: BarItem[]; caption: string; max?: number }) {
  const { t, number } = useT();
  const scale = Math.max(max ?? 0, ...items.map((item) => item.value), 1);
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{t('dashboard.bars.label')}</th>
          <th scope="col">{t('dashboard.bars.count')}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const label = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{item.display ?? item.label}</span>
                {item.aside}
              </span>
              <span aria-hidden className="mt-1.5 block h-1.5">
                {item.value > 0 && (
                  <span
                    className={cn('block h-full min-w-0.5 rounded-r-xs', item.tone ?? 'bg-accent')}
                    style={{ width: `${(item.value / scale) * 100}%` }}
                  />
                )}
              </span>
            </>
          );
          return (
            <tr key={item.key}>
              <th scope="row" className="w-full max-w-0 py-1 pr-4 text-left font-normal text-ink-2">
                {item.search ? (
                  <Link
                    to="/app/incidents"
                    search={item.search}
                    className="-mx-2 block rounded-sm px-2 py-1 transition-colors hover:bg-subtle hover:text-ink"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="-mx-2 block px-2 py-1">{label}</span>
                )}
              </th>
              <td className="py-1 text-right align-top font-medium whitespace-nowrap text-ink tabular-nums">
                <span className="block py-1">{number(item.value)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="px-4 py-3">{children}</div>
    </Panel>
  );
}

function EmptyBars() {
  const { t } = useT();
  return <p className="py-6 text-center text-sm text-ink-3">{t('dashboard.bars.none')}</p>;
}

const bucketOrder: AgeingBucket[] = ['UNDER_4H', 'H4_TO_24H', 'D1_TO_3D', 'OVER_3D'];

export function AgeingChart({ ageing }: { ageing: DashboardDTO['ageing'] }) {
  const { t } = useT();
  const items: BarItem[] = bucketOrder.map((bucket) => ({
    key: bucket,
    label: t(`dashboard.ageing.${bucket}`),
    value: ageing.find((row) => row.bucket === bucket)?.count ?? 0,
  }));
  return (
    <ChartPanel title={t('dashboard.ageing.title')}>
      <BarList items={items} caption={t('dashboard.ageing.caption')} />
    </ChartPanel>
  );
}

const priorityTone: Record<Priority, string> = {
  CRITICAL: 'bg-critical',
  HIGH: 'bg-high',
  MEDIUM: 'bg-medium',
  LOW: 'bg-low',
};

export function PriorityChart({ byPriority }: { byPriority: DashboardDTO['byPriority'] }) {
  const { t } = useT();
  const items: BarItem[] = [...priorities].reverse().map((priority) => ({
    key: priority,
    label: t(`common.priority.${priority}`),
    display: <PriorityLabel priority={priority} />,
    value: byPriority.find((row) => row.priority === priority)?.count ?? 0,
    tone: priorityTone[priority],
    search: { view: 'open', priority },
  }));
  return (
    <ChartPanel title={t('dashboard.priority.title')}>
      <BarList items={items} caption={t('dashboard.priority.caption')} />
    </ChartPanel>
  );
}

const TOP = 6;

/** Keeps the longest rows and folds the rest into one comparison row, so the list never grows past seven lines. */
function fold(items: BarItem[], other: (count: number) => string): BarItem[] {
  const sorted = [...items].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  if (sorted.length <= TOP + 1) return sorted;
  const rest = sorted.slice(TOP);
  return [
    ...sorted.slice(0, TOP),
    {
      key: 'other',
      label: other(rest.length),
      value: rest.reduce((sum, item) => sum + item.value, 0),
      tone: 'bg-ink-3',
    },
  ];
}

export function SiteChart({ bySite }: { bySite: DashboardDTO['bySite'] }) {
  const { t } = useT();
  const tn = usePlural();
  const items = fold(
    bySite
      .filter((site) => site.open > 0)
      .map((site): BarItem => ({
        key: site.id,
        label: site.name,
        value: site.open,
        search: { view: 'open', site: site.id },
        aside:
          site.critical > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-3">
              <PriorityIcon priority="CRITICAL" className="size-3" />
              {tn('dashboard.site.critical', site.critical)}
            </span>
          ) : undefined,
      })),
    (count) => tn('dashboard.site.other', count),
  );
  return (
    <ChartPanel title={t('dashboard.site.title')}>
      {items.length === 0 ? <EmptyBars /> : <BarList items={items} caption={t('dashboard.site.caption')} />}
    </ChartPanel>
  );
}

export function CategoryChart({ byCategory }: { byCategory: DashboardDTO['byCategory'] }) {
  const { t } = useT();
  const tn = usePlural();
  const items = fold(
    byCategory
      .filter((category) => category.open > 0)
      .map((category): BarItem => ({
        key: category.id,
        label: category.name,
        value: category.open,
        search: { view: 'open', category: category.id },
      })),
    (count) => tn('dashboard.category.other', count),
  );
  return (
    <ChartPanel title={t('dashboard.category.title')}>
      {items.length === 0 ? <EmptyBars /> : <BarList items={items} caption={t('dashboard.category.caption')} />}
    </ChartPanel>
  );
}
