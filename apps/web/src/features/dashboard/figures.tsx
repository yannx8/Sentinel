import type { DashboardDTO } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { PriorityIcon } from '../../components/domain/glyphs';
import type { IncidentsSearch } from '../../app/router';
import { useT } from '../../i18n';
import { usePlural } from './plural';

function Figure({
  value,
  label,
  context,
  search,
  icon,
}: {
  value: string;
  label: string;
  context?: string;
  search: IncidentsSearch;
  icon?: ReactNode;
}) {
  return (
    <li className="min-w-0">
      <Link
        to="/app/incidents"
        search={search}
        className="group -mx-2 -my-1.5 block rounded-md px-2 py-1.5 transition-colors hover:bg-subtle"
      >
        <span className="block text-figure font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-ink-2 group-hover:text-ink">
          {icon}
          {label}
        </span>
        {context && <span className="mt-0.5 block truncate text-xs text-ink-3">{context}</span>}
      </Link>
    </li>
  );
}

/** Headline counts, set directly on the page. Each one opens the matching incidents view. */
export function FiguresRow({ data }: { data: DashboardDTO }) {
  const { t, number, duration } = useT();
  const tn = usePlural();
  const { counts, medians } = data;
  return (
    <ul
      aria-label={t('dashboard.figures.label')}
      className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-5"
    >
      <Figure
        value={number(counts.open)}
        label={t('dashboard.figures.open')}
        context={tn('dashboard.figures.inProgress', counts.inProgress)}
        search={{ view: 'open' }}
      />
      <Figure
        value={number(counts.unassigned)}
        label={t('dashboard.figures.unassigned')}
        context={counts.pendingAcceptance > 0 ? tn('dashboard.figures.pending', counts.pendingAcceptance) : undefined}
        search={{ view: 'unassigned' }}
      />
      <Figure
        value={number(counts.awaitingReview)}
        label={t('dashboard.figures.review')}
        context={
          counts.reassignmentRequests > 0 ? tn('dashboard.figures.reassignment', counts.reassignmentRequests) : undefined
        }
        search={{ view: 'review' }}
      />
      <Figure
        value={number(counts.criticalOpen)}
        label={t('dashboard.figures.critical')}
        icon={<PriorityIcon priority="CRITICAL" className="size-3.5" />}
        context={counts.criticalOpen === 0 ? t('dashboard.figures.criticalNone') : undefined}
        search={{ view: 'open', priority: 'CRITICAL' }}
      />
      <Figure
        value={duration(medians.toResolve)}
        label={t('dashboard.figures.resolution')}
        context={t('dashboard.figures.last30')}
        search={{ view: 'closed' }}
      />
    </ul>
  );
}
