import { Search } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { Glyph } from '../../components/ui/Glyph';
import { priorityGlyph, priorityLabel, priorityText } from '../../components/ui/Chip';
import type { Incident } from '../../data/types';
import { cn, formatAbsolute, formatRelative } from '../../lib/util';
import { effectivePriority, rowMarker, siteName, views, type ViewId } from './state';

function Skeleton() {
  return (
    <ul aria-hidden className="grid gap-px px-2 py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 px-3">
          <span className="size-3 rounded-full bg-sunken" />
          <span className="grid flex-1 gap-1.5">
            <span className="h-3.5 w-3/5 rounded-control bg-sunken" />
            <span className="h-3 w-2/5 rounded-control bg-sunken" />
          </span>
          <span className="h-3 w-8 rounded-control bg-sunken" />
        </li>
      ))}
    </ul>
  );
}

const emptyText: Record<ViewId, string> = {
  attention: 'No incidents need attention. Everything is assigned or closed.',
  open: 'No open incidents. Employees report from the app, or you can create one for them.',
  review: 'Nothing is waiting for your review.',
  closed: 'No closed incidents yet.',
};

export function IncidentList({
  incidents,
  counts,
  loading,
  view,
  query,
  selected,
  now,
  onView,
  onQuery,
  onSelect,
}: {
  incidents: Incident[];
  counts: Record<ViewId, number>;
  loading: boolean;
  view: ViewId;
  query: string;
  selected: string | undefined;
  now: number;
  onView: (v: ViewId) => void;
  onQuery: (q: string) => void;
  onSelect: (reference: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  // Arrow keys move focus between rows. Enter or a click opens the case file.
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-row]') ?? [])];
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, current + (e.key === 'ArrowDown' ? 1 : -1)));
    rows[next]?.focus();
    e.preventDefault();
  };

  return (
    <section aria-label="Incidents" className="flex h-full min-h-0 flex-col bg-surface">
      <div className="grid gap-3 border-b border-border px-4 py-3">
        <div role="group" aria-label="View" className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => onView(v.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium transition-colors duration-(--dur-small)',
                view === v.id ? 'border-brand bg-brand-tint text-brand' : 'border-border bg-surface-2 text-ink-2 hover:text-ink',
              )}
            >
              {v.label}
              <span className={cn('text-xs', view === v.id ? 'text-brand' : 'text-ink-3')}>{counts[v.id]}</span>
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Search incidents</span>
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search reference, title or site"
            className="h-9 w-full rounded-control border border-border-strong bg-surface pr-3 pl-9 text-base text-ink transition-[border-color,box-shadow] duration-(--dur-small) focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand-tint"
          />
        </label>
        <p className="text-xs text-ink-3" aria-live="polite">
          {loading ? 'Loading incidents' : `${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'}`}
        </p>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <Skeleton />
        ) : incidents.length === 0 ? (
          <p className="max-w-[44ch] px-5 py-8 text-base text-ink-2">
            {query ? `No incident matches "${query}". Check the spelling or clear the search.` : emptyText[view]}
          </p>
        ) : (
          <ul ref={listRef} onKeyDown={onKeyDown} className="grid gap-px px-2 py-2">
            {incidents.map((i) => {
              const priority = effectivePriority(i);
              const marker = rowMarker(i);
              const isSelected = selected === i.reference;
              return (
                <li key={i.reference}>
                  <button
                    type="button"
                    data-row
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => onSelect(i.reference)}
                    className={cn(
                      'grid min-h-14 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-control px-3 py-2 text-left transition-colors duration-(--dur-small)',
                      isSelected ? 'bg-brand-tint' : 'hover:bg-surface-2',
                    )}
                  >
                    <Glyph name={priorityGlyph[priority]} size={12} className={priorityText[priority]} aria-label={`${priorityLabel[priority]} priority`} />
                    <span className="min-w-0">
                      <span className={cn('block truncate text-base font-medium', isSelected ? 'text-ink' : 'text-ink')}>{i.title}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {i.reference}, {siteName(i.siteId)}
                        {marker ? <span className="text-ink-2">, {marker}</span> : null}
                      </span>
                    </span>
                    <time dateTime={new Date(i.createdAt).toISOString()} title={formatAbsolute(i.createdAt)} className="text-xs text-ink-3">
                      {formatRelative(i.createdAt, now)}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
