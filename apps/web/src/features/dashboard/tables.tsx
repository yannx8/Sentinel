import type { Availability, DashboardDTO } from '@sentinel/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { Avatar } from '../../components/ui/avatar';
import { buttonClass } from '../../components/ui/button';
import { Panel } from '../../components/ui/layout';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { StatusLabel } from '../../components/domain/glyphs';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

function minutesSince(iso: string) {
  return (Date.now() - Date.parse(iso)) / 60_000;
}

function PanelLink({
  children,
  to,
  search,
}: {
  children: string;
  to: '/app/incidents' | '/app/team';
  search: Record<string, string>;
}) {
  return (
    <Link to={to} search={search} className={buttonClass({ variant: 'link', size: 'sm' })}>
      <span className="text-sm">{children}</span>
    </Link>
  );
}

/** Oldest open incidents: the ones most likely waiting on a supervisor. */
export function NeedsDecision({ rows }: { rows: DashboardDTO['oldestOpen'] }) {
  const { t, duration } = useT();
  const navigate = useNavigate();
  return (
    <Panel
      title={t('dashboard.decision.title')}
      actions={
        rows.length > 0 ? (
          <PanelLink to="/app/incidents" search={{ view: 'open', sort: 'oldest' }}>
            {t('dashboard.decision.viewAll')}
          </PanelLink>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-3">{t('dashboard.decision.empty')}</p>
      ) : (
        <Table>
          <caption className="sr-only">{t('dashboard.decision.description')}</caption>
          <THead>
            <tr>
              <Th>{t('dashboard.decision.incident')}</Th>
              <Th className="hidden sm:table-cell">{t('dashboard.decision.status')}</Th>
              <Th className="text-right">{t('dashboard.decision.age')}</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map((row) => (
              <Tr
                key={row.id}
                interactive
                onClick={() => void navigate({ to: '/app/incidents', search: { incident: row.reference } })}
              >
                <Td className="max-w-0 w-full">
                  <Link
                    to="/app/incidents"
                    search={{ incident: row.reference }}
                    onClick={(event) => event.stopPropagation()}
                    className="block min-w-0 py-1 hover:underline hover:underline-offset-2 hover:decoration-line-strong"
                  >
                    <span className="block text-xs text-ink-3 tabular-nums">{row.reference}</span>
                    <span className="block truncate font-medium text-ink">{row.title}</span>
                  </Link>
                </Td>
                <Td className="hidden whitespace-nowrap sm:table-cell">
                  <StatusLabel status={row.status} />
                </Td>
                <Td className="text-right whitespace-nowrap text-ink-2 tabular-nums">
                  {duration(minutesSince(row.createdAt))}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

const availabilityDot: Record<Availability, string> = {
  AVAILABLE: 'bg-success',
  BUSY: 'bg-medium',
  OFF: 'border border-ink-3',
};

export function AvailabilityLabel({ value }: { value: Availability }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', availabilityDot[value])} />
      {t(`common.availability.${value}`)}
    </span>
  );
}

/** Live and pending assignments per intervenant, busiest first. */
export function Workload({ rows }: { rows: DashboardDTO['workload'] }) {
  const { t, duration, number } = useT();
  const sorted = [...rows].sort((a, b) => b.live + b.pending - (a.live + a.pending) || a.name.localeCompare(b.name));
  return (
    <Panel
      title={t('dashboard.workload.title')}
      actions={
        rows.length > 0 ? (
          <PanelLink to="/app/team" search={{ tab: 'intervenants' }}>
            {t('dashboard.workload.viewTeam')}
          </PanelLink>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-4 px-4 py-8 text-center">
          <p className="max-w-sm text-sm text-ink-3">{t('dashboard.workload.empty')}</p>
          <Link to="/app/team" search={{ tab: 'intervenants' }} className={buttonClass({ size: 'sm' })}>
            {t('dashboard.workload.invite')}
          </Link>
        </div>
      ) : (
        <Table>
          <caption className="sr-only">{t('dashboard.workload.title')}</caption>
          <THead>
            <tr>
              <Th>{t('dashboard.workload.intervenant')}</Th>
              <Th className="hidden md:table-cell">{t('dashboard.workload.availability')}</Th>
              <Th className="text-right">
                <abbr title={t('dashboard.workload.liveHint')} className="no-underline">
                  {t('dashboard.workload.live')}
                </abbr>
              </Th>
              <Th className="text-right">
                <abbr title={t('dashboard.workload.pendingHint')} className="no-underline">
                  {t('dashboard.workload.pending')}
                </abbr>
              </Th>
              <Th className="hidden text-right sm:table-cell">{t('dashboard.workload.oldest')}</Th>
            </tr>
          </THead>
          <tbody>
            {sorted.map((row) => (
              <Tr key={row.membershipId}>
                <Td className="max-w-0 w-full">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={row.name} size="xs" />
                    <span className="truncate font-medium">{row.name}</span>
                  </span>
                </Td>
                <Td className="hidden whitespace-nowrap md:table-cell">
                  <AvailabilityLabel value={row.availability} />
                </Td>
                <Td className={cn('text-right tabular-nums', row.live === 0 && 'text-ink-3')}>{number(row.live)}</Td>
                <Td className={cn('text-right tabular-nums', row.pending === 0 && 'text-ink-3')}>
                  {number(row.pending)}
                </Td>
                <Td className="hidden text-right whitespace-nowrap text-ink-2 tabular-nums sm:table-cell">
                  {row.oldestLiveAt ? duration(minutesSince(row.oldestLiveAt)) : <span className="text-ink-3">-</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}
