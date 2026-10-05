import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { SlideOver } from '../../components/ui/Overlay';
import { useIncidents } from '../../data/queries';
import { useMediaQuery, useNow } from '../../lib/util';
import { CaseFile } from './CaseFile';
import { IncidentList } from './IncidentList';
import { inView, matchesQuery, sortForView, views, type ViewId } from './state';
import { useActionRunner } from './useActionRunner';

export function TriageDesk() {
  const search = useSearch({ from: '/app/triage' });
  const navigate = useNavigate({ from: '/app/triage' });
  const docked = useMediaQuery('(min-width: 1280px)');
  const now = useNow();
  const run = useActionRunner();
  const { data, isPending, isError, refetch } = useIncidents();

  const all = data ?? [];
  const view: ViewId = search.view ?? 'attention';
  const query = search.q ?? '';

  const counts = useMemo(
    () => Object.fromEntries(views.map((v) => [v.id, all.filter((i) => inView(i, v.id)).length])) as Record<ViewId, number>,
    [all],
  );
  const visible = useMemo(
    () => sortForView(all.filter((i) => inView(i, view) && matchesQuery(i, query)), view),
    [all, view, query],
  );

  // Docked: the desk always shows something, defaulting to the top of the list.
  const selectedRef = search.incident ?? (docked ? visible[0]?.reference : undefined);
  const selected = all.find((i) => i.reference === selectedRef);

  const setSearch = (patch: Partial<{ incident: string | undefined; view: ViewId | undefined; q: string | undefined }>, replace = false) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace });

  if (isError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-[44ch] text-center">
          <h1 className="font-display text-title-md font-semibold text-ink">Incidents did not load</h1>
          <p className="mt-1 text-base text-ink-2">Check your connection, then try again. Nothing you did was lost.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 h-8 rounded-control bg-brand-solid px-3.5 text-base font-medium text-on-brand hover:bg-brand-solid-hover"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const list = (
    <IncidentList
      incidents={visible}
      counts={counts}
      loading={isPending}
      view={view}
      query={query}
      selected={selectedRef}
      now={now}
      onView={(v) => setSearch({ view: v === 'attention' ? undefined : v, incident: undefined })}
      onQuery={(q) => setSearch({ q: q || undefined }, true)}
      onSelect={(reference) => setSearch({ incident: reference })}
    />
  );

  if (docked) {
    return (
      <div className="grid h-full grid-cols-[minmax(360px,5fr)_minmax(520px,7fr)] divide-x divide-border">
        <h1 className="sr-only">Triage desk</h1>
        {list}
        {selected ? (
          <div key={selected.reference} className="anim-swap h-full min-h-0">
            <CaseFile incident={selected} now={now} run={run} />
          </div>
        ) : (
          <div className="grid h-full place-items-center bg-surface p-8">
            <p className="max-w-[40ch] text-center text-base text-ink-2">Select an incident to read its Thread and act on it.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full">
      <h1 className="sr-only">Triage desk</h1>
      {list}
      {selected ? (
        <SlideOver
          open
          onOpenChange={(open) => !open && setSearch({ incident: undefined })}
          title={selected.reference}
          description={selected.title}
        >
          <CaseFile incident={selected} now={now} run={run} onClose={() => setSearch({ incident: undefined })} />
        </SlideOver>
      ) : null}
    </div>
  );
}
