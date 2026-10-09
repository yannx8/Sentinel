import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useMembership, useSession } from '../../app/session';
import { Button, buttonClass } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { PageHeader } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { IncidentRow } from './incident-row';
import { ListGroup, ListSkeleton, LoadError } from './parts';
import { useFieldIncidents, useMyHistory } from './queries';

/** Employees: what they reported. Intervenants: everything they worked on, for every client, with a client filter. */
export function MyIncidentsPage() {
  const membership = useMembership();
  return membership.role === 'INTERVENANT' ? <IntervenantHistory /> : <EmployeeIncidents />;
}

function IntervenantHistory() {
  return <History intervenant query={useMyHistory()} />;
}

function EmployeeIncidents() {
  return <History intervenant={false} query={useFieldIncidents()} />;
}

function History({ intervenant, query }: { intervenant: boolean; query: ReturnType<typeof useMyHistory> }) {
  const { t } = useT();
  const { me } = useSession();
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const all = query.data?.pages.flatMap((page) => page.data) ?? [];
  const clients = intervenant ? (me?.memberships.filter((m) => m.role === 'INTERVENANT') ?? []) : [];
  const many = clients.length > 1;
  const items = orgFilter ? all.filter((incident) => incident.organization.id === orgFilter) : all;
  const open = items.filter((incident) => incident.status !== 'CLOSED');
  const closed = items.filter((incident) => incident.status === 'CLOSED');

  return (
    <div>
      <PageHeader
        title={intervenant ? t('field.history.title') : t('field.myIncidents.title')}
        description={intervenant ? t('field.history.descriptionAll') : t('field.myIncidents.description')}
      />
      {many && (
        <div role="group" aria-label={t('field.history.title')} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {[null, ...clients.map((m) => m.organization.id)].map((id) => {
            const name = id ? clients.find((m) => m.organization.id === id)?.organization.displayName : t('common.all');
            return (
              <button
                key={id ?? 'all'}
                type="button"
                aria-pressed={orgFilter === id}
                onClick={() => setOrgFilter(id)}
                className="h-11 shrink-0 rounded-full border border-line-strong px-4 text-sm font-medium text-ink-2 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary"
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
      {query.isPending ? (
        <ListSkeleton />
      ) : query.isError ? (
        <LoadError title={t('field.list.loadError')} error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        intervenant ? (
          <EmptyState title={t('field.history.emptyTitle')} description={t('field.history.emptyBody')} />
        ) : (
          <EmptyState
            title={t('field.myIncidents.emptyTitle')}
            description={t('field.myIncidents.emptyBody')}
            action={
              <Link to="/field/report" className={buttonClass({ variant: 'primary', size: 'xl' })}>
                {t('field.myIncidents.report')}
              </Link>
            }
          />
        )
      ) : (
        <div className="grid gap-6">
          {open.length > 0 && (
            <ListGroup title={t('field.list.open')} count={open.length}>
              {open.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  lead="status"
                  showAssignee={!intervenant}
                  orgId={incident.organization.id}
                  organization={many ? incident.organization.displayName : undefined}
                />
              ))}
            </ListGroup>
          )}
          {closed.length > 0 && (
            <ListGroup title={t('field.list.closed')} count={closed.length}>
              {closed.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  lead="status"
                  orgId={incident.organization.id}
                  organization={many ? incident.organization.displayName : undefined}
                />
              ))}
            </ListGroup>
          )}
          {query.hasNextPage && (
            <Button size="xl" block loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {t('common.loadMore')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
