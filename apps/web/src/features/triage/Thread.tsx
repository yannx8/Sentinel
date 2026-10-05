import { Lock, Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Incident, ProgressType, ThreadEvent } from '../../data/types';
import { cn, dayLabel, formatAbsolute, formatRelative } from '../../lib/util';
import { priorityLabel } from '../../components/ui/Chip';
import { stateSentence } from './state';

type NodeKind = 'ring' | 'dot' | 'bad' | 'now' | 'now-live';

const progressLabel: Record<ProgressType, string> = {
  STARTED: 'Started',
  ON_SITE: 'On site',
  BLOCKED: 'Blocked',
  UPDATE: 'Update',
};

const dismissLabel = { DUPLICATE: 'Duplicate', NOT_AN_INCIDENT: 'Not an incident', NO_ACTION_NEEDED: 'No action needed' } as const;

type Described = { summary: ReactNode; body?: string; node: NodeKind; bubble?: 'public' | 'internal'; footer?: ReactNode };

const who = (name: string) => <span className="font-medium text-ink">{name}</span>;

function describe(e: ThreadEvent, incident: Incident): Described {
  switch (e.kind) {
    case 'reported':
      return {
        summary: <>Reported by {who(e.actor)}</>,
        body: e.body,
        node: 'ring',
        bubble: 'public',
        footer:
          incident.attachments.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {incident.attachments.map((a) => (
                <li key={a.name} className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2 py-1 text-xs text-ink-2">
                  <Paperclip size={12} strokeWidth={1.75} aria-hidden />
                  {a.name}
                </li>
              ))}
            </ul>
          ) : null,
      };
    case 'comment':
      return {
        summary:
          e.visibility === 'INTERNAL' ? (
            <>
              {who(e.actor)} <span className="inline-flex items-center gap-1 text-ink-3"><Lock size={12} strokeWidth={1.75} aria-hidden />Internal note</span>
            </>
          ) : (
            <>{who(e.actor)} commented</>
          ),
        body: e.body,
        node: 'dot',
        bubble: e.visibility === 'INTERNAL' ? 'internal' : 'public',
      };
    case 'triaged':
      return { summary: <>{who(e.actor)} set priority to {priorityLabel[e.priority]}{e.category ? `, ${e.category}` : ''}</>, node: 'ring' };
    case 'assigned':
      return {
        summary: <>{who(e.actor)} assigned it to {who(e.assignee)}</>,
        body: e.note,
        node: 'ring',
        bubble: e.note ? 'internal' : undefined,
      };
    case 'unassigned':
      return { summary: <>{who(e.actor)} took it off {who(e.assignee)}</>, node: 'ring' };
    case 'accepted':
      return { summary: <>{who(e.actor)} accepted the assignment</>, node: 'ring' };
    case 'declined':
      return { summary: <>{who(e.actor)} declined</>, body: e.reason, node: 'bad', bubble: 'internal' };
    case 'reassignment-requested':
      return { summary: <>{who(e.actor)} asked to be reassigned</>, body: e.reason, node: 'bad', bubble: 'internal' };
    case 'progress':
      return { summary: <>{who(e.actor)} posted an update: {progressLabel[e.type]}</>, body: e.note, node: 'dot', bubble: 'public' };
    case 'resolved':
      return { summary: <>{who(e.actor)} resolved it</>, body: e.note, node: 'ring', bubble: 'public' };
    case 'sent-back':
      return { summary: <>{who(e.actor)} sent it back</>, body: e.reason, node: 'bad', bubble: 'internal' };
    case 'closed':
      return { summary: <>{who(e.actor)} closed the incident</>, node: 'ring' };
    case 'dismissed':
      return { summary: <>{who(e.actor)} dismissed it: {dismissLabel[e.code]}</>, body: e.note, node: 'ring', bubble: 'internal' };
  }
}

const nodeClass: Record<NodeKind, string> = {
  ring: 'left-[-28px] top-[3px] size-3 border-2 border-ink-3 bg-surface',
  bad: 'left-[-28px] top-[3px] size-3 border-2 border-critical bg-surface',
  dot: 'left-[-26px] top-[6px] size-2 bg-ink-3',
  now: 'left-[-28px] top-[3px] size-3 bg-brand-solid',
  'now-live': 'live-pulse left-[-28px] top-[3px] size-3 bg-brand-solid',
};

function Node({ kind }: { kind: NodeKind }) {
  return <span aria-hidden className={cn('absolute rounded-full', nodeClass[kind])} />;
}

function Bubble({ children, tone }: { children: ReactNode; tone: 'public' | 'internal' }) {
  return (
    <p
      className={cn(
        'mt-1.5 max-w-[56ch] rounded-panel border bg-surface-2 px-3 py-2 text-base text-ink-2',
        tone === 'internal' ? 'border-dashed border-border-strong' : 'border-border',
      )}
    >
      {children}
    </p>
  );
}

/**
 * The Thread: one line through every event of an incident, newest first, with a
 * single "now" node that pulses (three times) when someone is waiting on a decision.
 */
export function Thread({ incident, now, showInternal }: { incident: Incident; now: number; showInternal: boolean }) {
  const state = stateSentence(incident);
  const events = [...incident.thread]
    .filter((e) => showInternal || !(e.kind === 'comment' && e.visibility === 'INTERNAL'))
    .sort((a, b) => b.at - a.at);

  // Group by day while keeping newest first.
  const groups: { label: string; items: ThreadEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <ol aria-label={`Thread for ${incident.reference}`} className="relative grid gap-5 pl-7 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-0.5 before:rounded-full before:bg-border-strong/40">
      <li className="relative">
        <Node kind={state.live ? 'now-live' : 'now'} />
        <span className="text-base font-semibold text-ink">{state.text}</span>
      </li>
      {groups.map((g) => (
        <li key={g.label} className="grid gap-5">
          <h3 className="sticky top-0 z-10 -ml-7 bg-surface py-1 pl-7 text-xs font-semibold text-ink-3">{g.label}</h3>
          <ol className="grid gap-5">
            {g.items.map((e) => {
              const d = describe(e, incident);
              return (
                <li key={e.id} className="relative">
                  <Node kind={d.node} />
                  <p className="text-base text-ink-2">
                    {d.summary}
                    <time dateTime={new Date(e.at).toISOString()} title={formatAbsolute(e.at)} className="ml-2 text-xs text-ink-3">
                      {formatRelative(e.at, now)}
                    </time>
                  </p>
                  {d.body ? <Bubble tone={d.bubble ?? 'public'}>{d.body}</Bubble> : null}
                  {d.footer}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
