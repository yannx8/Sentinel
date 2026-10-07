import { Link } from '@tanstack/react-router';
import { useMembership } from '../../app/session';
import { Button, buttonClass } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { PageHeader } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { IncidentRow } from './incident-row';
import { ListGroup, ListSkeleton, LoadError } from './parts';
import { useFieldIncidents } from './queries';

/** Employees: what they reported. Intervenants: their history in this organization. */
export function MyIncidentsPage() {
  const { t } = useT();
  const membership = useMembership();
  const intervenant = membership.role === 'INTERVENANT';
  const query = useFieldIncidents();
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const open = items.filter((incident) => incident.status !== 'CLOSED');
  const closed = items.filter((incident) => incident.status === 'CLOSED');

  return (
    <div>
      <PageHeader
        title={intervenant ? t('field.history.title') : t('field.myIncidents.title')}
        description={
          intervenant
            ? t('field.history.description', { organization: membership.organization.displayName })
            : t('field.myIncidents.description')
        }
      />
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
                <IncidentRow key={incident.id} incident={incident} lead="status" showAssignee={!intervenant} />
              ))}
            </ListGroup>
          )}
          {closed.length > 0 && (
            <ListGroup title={t('field.list.closed')} count={closed.length}>
              {closed.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} lead="status" />
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
