import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Sheet } from '../../components/ui/sheet';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { isTyping, type IncidentCounts } from '../../app/shells/console-shell';
import { incidentCountsKey } from '../../app/shells/console-shell';
import type { IncidentsSearch } from '../../app/router';
import { useDensity } from '../../lib/density';
import { ActedContext } from './acted';
import { BulkBar } from './bulk';
import { CaseFile } from './case-file';
import { CreateIncidentDialog } from './create-dialog';
import { FilterBar } from './filter-bar';
import { hasFilters, useIncidentList, useMediaQuery } from './hooks';
import { IncidentList, ListSkeleton } from './incident-list';
import { useIncident } from '../../lib/incidents';

export function IncidentsPage() {
  const { t } = useT();
  const search = useSearch({ from: '/app/incidents' });
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1280px)');
  const list = useIncidentList(search);
  const [creating, setCreating] = useState(false);
  const [density, setDensity] = useDensity();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const togglePicked = useCallback(
    (reference: string, on: boolean) =>
      setPicked((prev) => {
        const next = new Set(prev);
        if (on) next.add(reference);
        else next.delete(reference);
        return next;
      }),
    [],
  );
  const pickedItems = list.items.filter((item) => picked.has(item.reference));
  const containerRef = useRef<HTMLDivElement>(null);
  const counts = useQuery({
    queryKey: incidentCountsKey,
    queryFn: () => api.get<IncidentCounts>('/incidents/counts'),
    refetchInterval: 30_000,
  });
  const selected = search.incident;
  const selectedIncident = useIncident(selected);
  const missing = selectedIncident.error instanceof ApiError && selectedIncident.error.code === 'NOT_FOUND';

  const select = useCallback(
    (reference: string | undefined) =>
      void navigate({
        to: '/app/incidents',
        search: (prev: IncidentsSearch) => ({ ...prev, incident: reference }),
        replace: !!reference && !!selected,
      }),
    [navigate, selected],
  );

  // After assign, close, send back or dismiss, move on to the next incident (or close the sheet on small screens).
  const advance = useCallback(
    (action: string) => {
      if (!['assign', 'close', 'send-back', 'dismiss'].includes(action)) return;
      const index = list.items.findIndex((item) => item.reference === selected);
      if (index < 0) return;
      if (!wide) return select(undefined);
      select((list.items[index + 1] ?? list.items[index - 1])?.reference);
    },
    [list.items, selected, select, wide],
  );

  useEffect(() => {
    if (missing) select(undefined);
  }, [missing, select]);

  // J and K move the selection, Enter focuses it, Escape closes the case file, A is handled by the case file.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[role=dialog]')) return;
      const index = list.items.findIndex((item) => item.reference === selected);
      if (event.key === 'j') {
        const next = list.items[Math.min(index + 1, list.items.length - 1)];
        if (next && next.reference !== selected) {
          event.preventDefault();
          select(next.reference);
          containerRef.current
            ?.querySelector(`[data-reference="${next.reference}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      } else if (event.key === 'k') {
        const prev = list.items[Math.max(index - 1, 0)];
        if (prev && prev.reference !== selected) {
          event.preventDefault();
          select(prev.reference);
          containerRef.current
            ?.querySelector(`[data-reference="${prev.reference}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      } else if (event.key === 'Escape' && selected) select(undefined);
      else if (event.key === 'a' && selectedIncident.data?.actions.some((a) => a === 'assign' || a === 'reassign')) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-case-primary]')?.click();
      } else if (event.key === 'c' && selectedIncident.data?.actions.includes('close')) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-case-close]')?.click();
      } else if (event.key === 's' && selectedIncident.data?.actions.includes('send-back')) {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-case-sendback]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list.items, selected, select, selectedIncident.data]);

  const view = search.view ?? 'attention';
  const filtered = hasFilters(search);
  const viewCounts = counts.data
    ? {
        attention: counts.data.attention,
        unassigned: counts.data.unassigned,
        'in-progress': counts.data.inProgress,
        review: counts.data.review,
      }
    : undefined;

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <FilterBar
        search={search}
        counts={viewCounts}
        density={density}
        onDensity={setDensity}
        onCreate={() => setCreating(true)}
      />
      {pickedItems.length > 0 && <BulkBar items={pickedItems} onClear={() => setPicked(new Set())} />}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={
              filtered
                ? t('incidents.empty.default')
                : view === 'attention'
                  ? t('incidents.empty.attention')
                  : view === 'all'
                    ? t('incidents.empty.none')
                    : t('incidents.empty.default')
            }
            action={
              filtered ? (
                <Button
                  onClick={() =>
                    void navigate({ to: '/app/incidents', search: { view: search.view, incident: selected } })
                  }
                >
                  {t('incidents.empty.clearFilters')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <IncidentList
              items={list.items}
              selected={selected}
              picked={picked}
              density={density}
              onSelect={select}
              onToggle={togglePicked}
            />
            {list.hasNextPage && (
              <div className="p-3 text-center">
                <Button variant="ghost" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                  {t('common.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <ActedContext.Provider value={advance}>
      <div className="flex h-full min-h-0">
        <section
          aria-label={t('incidents.title')}
          className="min-w-0 flex-1 xl:max-w-[560px] xl:border-r xl:border-line xl:flex-none xl:w-[44%]"
        >
          {listPane}
        </section>
        {wide ? (
          <section aria-label={t('incidents.caseFile.activity')} className="min-w-0 flex-1 bg-surface">
            {selected ? (
              <CaseFile key={selected} reference={selected} onClose={() => select(undefined)} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-3">
                {t('incidents.select')}
              </div>
            )}
          </section>
        ) : (
          <Sheet
            open={!!selected}
            onOpenChange={(open) => !open && select(undefined)}
            title={t('incidents.caseFile.activity')}
          >
            {selected && <CaseFile key={selected} reference={selected} onClose={() => select(undefined)} />}
          </Sheet>
        )}
        <CreateIncidentDialog open={creating} onOpenChange={setCreating} onCreated={(reference) => select(reference)} />
      </div>
    </ActedContext.Provider>
  );
}
