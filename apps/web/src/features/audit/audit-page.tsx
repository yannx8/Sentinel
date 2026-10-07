import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSession } from '../../app/session';
import { Button, buttonClass } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { toastError } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { AuditFilters, type AuditSearchPatch } from './audit-filters';
import { AuditTable } from './audit-table';
import { usePlural } from './plural';
import { downloadAuditCsv, filtersFromSearch, hasFilters, useAuditLog } from './queries';

function ExportButton({ onExport }: { onExport: () => Promise<void> }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      icon={<Download className="size-4" aria-hidden />}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onExport();
        } finally {
          setBusy(false);
        }
      }}
    >
      {t('audit.export')}
    </Button>
  );
}

export function AuditPage() {
  const { t } = useT();
  const tn = usePlural();
  const { membership } = useSession();
  const search = useSearch({ from: '/app/audit' });
  const navigate = useNavigate({ from: '/app/audit' });
  const filters = useMemo(() => filtersFromSearch(search), [search]);
  const log = useAuditLog(filters);

  const entries = useMemo(() => log.data?.pages.flatMap((page) => page.data) ?? [], [log.data]);
  const actorName = filters.actor
    ? (entries.find((entry) => entry.actor?.membershipId === filters.actor)?.actor?.name ?? null)
    : null;
  const filtered = hasFilters(filters);

  const update = (patch: AuditSearchPatch) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const clear = () => void navigate({ search: {}, replace: true });

  const exportCsv = async () => {
    if (!membership) return;
    try {
      await downloadAuditCsv(filters, membership.organization.id);
      toast.success(t('audit.exported'));
    } catch (error) {
      toastError(error, t);
    }
  };

  let body: ReactNode;
  if (log.isPending) {
    body = <AuditTable entries={[]} loading />;
  } else if (log.isError && entries.length === 0) {
    body = (
      <EmptyState
        title={t('common.errorTitle')}
        description={t('audit.loadError')}
        action={
          <Button onClick={() => void log.refetch()} loading={log.isFetching}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (entries.length === 0) {
    body = filtered ? (
      <EmptyState
        title={t('audit.noMatch.title')}
        description={t('audit.noMatch.body')}
        action={<Button onClick={clear}>{t('audit.filters.clear')}</Button>}
      />
    ) : (
      <EmptyState
        title={t('audit.empty.title')}
        description={t('audit.empty.body')}
        action={
          <Link to="/app/incidents" className={buttonClass()}>
            {t('audit.empty.action')}
          </Link>
        }
      />
    );
  } else {
    body = (
      <>
        <div
          className={cn('transition-opacity', log.isPlaceholderData && 'opacity-60')}
          aria-busy={log.isPlaceholderData || undefined}
        >
          <AuditTable entries={entries} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-3 tabular-nums" aria-live="polite">
            {tn('audit.showing', entries.length)}
          </p>
          {log.hasNextPage ? (
            <Button size="sm" onClick={() => void log.fetchNextPage()} loading={log.isFetchingNextPage}>
              {t('common.loadMore')}
            </Button>
          ) : (
            <p className="text-xs text-ink-3">{t('audit.end')}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t('audit.title')}
        description={t('audit.description')}
        actions={membership ? <ExportButton onExport={exportCsv} /> : undefined}
      />
      <div className="grid gap-4">
        <AuditFilters search={search} actorName={actorName} onChange={update} onClear={clear} />
        <Panel>{body}</Panel>
      </div>
    </Page>
  );
}
