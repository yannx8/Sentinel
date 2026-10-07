import type { DashboardDTO } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { Button, buttonClass } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Page, PageHeader } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { AgeingChart, CategoryChart, PriorityChart, SiteChart } from './bars';
import { DashboardSkeleton } from './dashboard-skeleton';
import { FiguresRow } from './figures';
import { MedianTimes } from './medians';
import { useDashboard, useSetupChecklist } from './queries';
import { SetupPanel } from './setup-panel';
import { NeedsDecision, Workload } from './tables';
import { TrendChart } from './trend-chart';

/** Used only when the setup checklist is unavailable. */
function looksEmpty(data: DashboardDTO) {
  return data.counts.open === 0 && data.oldestOpen.length === 0 && data.trend.every((day) => day.created === 0 && day.resolved === 0);
}

function DashboardContent({ data }: { data: DashboardDTO }) {
  return (
    <div className="grid gap-6">
      <FiguresRow data={data} />
      <div className="grid gap-6 lg:grid-cols-2">
        <NeedsDecision rows={data.oldestOpen} />
        <Workload rows={data.workload} />
        <AgeingChart ageing={data.ageing} />
        <PriorityChart byPriority={data.byPriority} />
        <SiteChart bySite={data.bySite} />
        <CategoryChart byCategory={data.byCategory} />
        <div className="min-w-0 lg:col-span-2">
          <TrendChart trend={data.trend} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <MedianTimes medians={data.medians} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { t, date } = useT();
  const dashboard = useDashboard();
  const setup = useSetupChecklist();
  const data = dashboard.data;
  const empty = data ? (setup.data ? !setup.data.hasIncident : looksEmpty(data)) : false;

  return (
    <Page>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        actions={
          data ? (
            <span className="text-xs text-ink-3 tabular-nums" aria-live="polite">
              {t('dashboard.updatedAt', { time: date(new Date(dashboard.dataUpdatedAt), 'time') })}
            </span>
          ) : undefined
        }
      />
      <div className="grid gap-6">
        {setup.data && <SetupPanel checklist={setup.data} />}
        {data ? (
          empty ? (
            <EmptyState
              icon={<Inbox />}
              title={t('dashboard.empty.title')}
              description={t('dashboard.empty.body')}
              action={
                <Link to="/app/incidents" className={buttonClass({ variant: 'secondary' })}>
                  {t('dashboard.empty.action')}
                </Link>
              }
            />
          ) : (
            <DashboardContent data={data} />
          )
        ) : dashboard.isError ? (
          <EmptyState
            title={t('common.errorTitle')}
            description={t('dashboard.loadError')}
            action={
              <Button onClick={() => void dashboard.refetch()} loading={dashboard.isFetching}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : (
          <DashboardSkeleton />
        )}
      </div>
    </Page>
  );
}
