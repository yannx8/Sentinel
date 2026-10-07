import { Link, useParams } from '@tanstack/react-router';
import { useId } from 'react';
import { useMembership } from '../../app/session';
import { Thread } from '../../components/domain/thread';
import { Button, buttonClass } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { ApiError } from '../../lib/api';
import { useIncident, useThread } from '../../lib/incidents';
import { IncidentActionBar } from './action-bar';
import { CommentBox } from './comment-box';
import { IncidentOverview, IncidentSkeleton } from './incident-overview';
import { BackLink, LoadError } from './parts';

function ThreadSkeleton() {
  return (
    <div className="grid gap-4 pl-1" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="mt-1 size-3 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

/** One incident on a phone: the case file, its Thread, a comment box and one action at the bottom. */
export function FieldIncidentPage() {
  const { t } = useT();
  const threadId = useId();
  const { reference } = useParams({ from: '/field/incidents/$reference' });
  const membership = useMembership();
  const incident = useIncident(reference);
  const thread = useThread(reference);
  const intervenant = membership.role === 'INTERVENANT';

  if (incident.isPending) return <IncidentSkeleton />;

  if (incident.isError) {
    const home = intervenant ? '/field/work' : '/field/incidents';
    if (incident.error instanceof ApiError && incident.error.code === 'NOT_FOUND') {
      return (
        <EmptyState
          title={t('field.incident.notFoundTitle')}
          description={t('field.incident.notFoundBody')}
          action={
            <Link to={home} className={buttonClass({ size: 'xl' })}>
              {intervenant ? t('shell.nav.myWork') : t('shell.nav.myIncidents')}
            </Link>
          }
        />
      );
    }
    return (
      <LoadError title={t('field.incident.loadError')} error={incident.error} onRetry={() => void incident.refetch()} />
    );
  }

  const data = incident.data;
  const working = data.liveAssignment?.intervenant.membershipId === membership.id;
  const back = !intervenant
    ? ({ to: '/field/incidents', label: t('shell.nav.myIncidents') } as const)
    : working
      ? ({ to: '/field/work', label: t('shell.nav.myWork') } as const)
      : ({ to: '/field/incidents', label: t('shell.nav.history') } as const);
  const canComment = data.actions.includes('comment-public') || data.actions.includes('comment-internal');

  return (
    <div className="grid gap-6">
      <div>
        <BackLink to={back.to} label={back.label} />
      </div>
      <IncidentOverview incident={data} />
      <section aria-labelledby={threadId}>
        <h2 id={threadId} className="mb-3 text-sm font-semibold text-ink">
          {t('thread.title')}
        </h2>
        {thread.isPending ? (
          <ThreadSkeleton />
        ) : thread.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-3">{t('field.incident.threadError')}</p>
            <Button size="lg" onClick={() => void thread.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : (
          <Thread events={thread.data} incident={data} />
        )}
      </section>
      {canComment && <CommentBox incident={data} />}
      <IncidentActionBar incident={data} />
    </div>
  );
}
