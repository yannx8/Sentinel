import type { IncidentListItem } from '@sentinel/shared';
import { Navigate, useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import { useMembership, useSession } from '../../app/session';
import { EmptyState } from '../../components/ui/feedback';
import { PageHeader } from '../../components/ui/layout';
import { useT, type TKey } from '../../i18n';
import { AvailabilityControl } from './availability-control';
import { IncidentRow } from './incident-row';
import { ListGroup, ListSkeleton, LoadError } from './parts';
import { useMyWork } from './queries';

type Group = { key: string; title: TKey; items: IncidentListItem[] };

/** Splits live assignments by what the intervenant has to do next, in that order. */
function groupWork(items: IncidentListItem[]): Group[] {
  const needs = items.filter((incident) => incident.assignee?.status === 'PENDING_ACCEPTANCE');
  const working = items.filter((incident) => incident.status === 'IN_PROGRESS' && incident.assignee?.status !== 'PENDING_ACCEPTANCE');
  const review = items.filter((incident) => incident.status === 'RESOLVED');
  return [
    { key: 'needs', title: 'field.work.needsAnswer', items: needs },
    { key: 'working', title: 'field.work.inProgress', items: working },
    { key: 'review', title: 'field.work.awaitingReview', items: review },
  ];
}

/** Intervenants: live assignments across every organization they work for. */
export function MyWorkPage() {
  const { t } = useT();
  const { me, switchOrganization } = useSession();
  const membership = useMembership();
  const navigate = useNavigate();
  const query = useMyWork();

  if (membership.role !== 'INTERVENANT') return <Navigate to="/field/incidents" replace />;

  const many = (me?.memberships.length ?? 0) > 1;
  const groups = groupWork(query.data ?? []).filter((group) => group.items.length > 0);

  /** Work from another organization opens after switching to it, so every request carries the right tenant. */
  const open = (incident: IncidentListItem) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (incident.organization.id === membership.organization.id) return;
    event.preventDefault();
    switchOrganization(incident.organization.id);
    void navigate({ to: '/field/incidents/$reference', params: { reference: incident.reference } });
  };

  return (
    <div>
      <PageHeader title={t('field.work.title')} />
      <AvailabilityControl />
      <div className="mt-6">
        {query.isPending ? (
          <ListSkeleton groups={2} />
        ) : query.isError ? (
          <LoadError title={t('field.list.loadError')} error={query.error} onRetry={() => void query.refetch()} />
        ) : groups.length === 0 ? (
          <EmptyState title={t('field.work.emptyTitle')} description={t('field.work.emptyBody')} />
        ) : (
          <div className="grid gap-6">
            {groups.map((group) => (
              <ListGroup key={group.key} title={t(group.title)} count={group.items.length}>
                {group.items.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    lead="priority"
                    organization={many ? incident.organization.displayName : undefined}
                    onOpen={open(incident)}
                  />
                ))}
              </ListGroup>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
