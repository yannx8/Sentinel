import type { IncidentDetail, ThreadEvent } from '@sentinel/shared';
import { ArrowRight, Camera, CircleSlash, Lock, MapPin, OctagonPause, Undo2 } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useT, type Formatter } from '../../i18n';
import { resourceUrl } from '../../lib/api';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/avatar';
import { Tooltip } from '../ui/tooltip';

/*
 * The Thread: one continuous line through everything that happened on an
 * incident, with a single live node when someone needs to act. It is the
 * product's signature, so everything else around it stays quiet.
 */

type NodeKind = 'milestone' | 'current' | 'dot' | 'warning' | 'muted';

function Node({ kind, live }: { kind: NodeKind; live?: boolean }) {
  if (kind === 'dot') return <span className="mt-[7px] size-2 rounded-full bg-line-strong ring-4 ring-surface" />;
  if (kind === 'muted') return <span className="mt-[7px] size-1.5 rounded-full bg-ink-4 ring-4 ring-surface" />;
  if (kind === 'warning') {
    return <span className="mt-[5px] size-3 rounded-full border-2 border-critical bg-surface ring-4 ring-surface" />;
  }
  return (
    <span
      className={cn(
        'mt-[5px] size-3 rounded-full ring-4 ring-surface',
        kind === 'current' ? 'bg-accent' : 'border-2 border-ink-3 bg-surface',
        live && 'animate-live',
      )}
    />
  );
}

function dayLabel(iso: string, f: Formatter) {
  const date = new Date(iso);
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: f.timeZone }).format(d);
  const today = key(new Date());
  const yesterday = key(new Date(Date.now() - 86_400_000));
  const day = key(date);
  if (day === today) return f.t('thread.today');
  if (day === yesterday) return f.t('thread.yesterday');
  return f.date(date, 'weekday');
}

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}

/** Builds the one-line summary, with names and values emphasized. */
function summary(event: ThreadEvent, f: Formatter): { text: ReactNode; kind: NodeKind; body?: ReactNode; internal?: boolean } {
  const { t } = f;
  const actor = <Strong>{event.actor?.name ?? t('thread.system')}</Strong>;
  const fill = (template: string, values: Record<string, ReactNode>) => {
    const parts = template.split(/(\{\w+\})/g);
    return parts.map((part, index) => {
      const match = /^\{(\w+)\}$/.exec(part);
      return <Fragment key={index}>{match ? (values[match[1] ?? ''] ?? part) : part}</Fragment>;
    });
  };

  switch (event.type) {
    case 'INCIDENT_CREATED':
      return event.payload.onBehalfOf
        ? { text: fill(t('thread.events.INCIDENT_CREATED_ON_BEHALF'), { actor, person: <Strong>{event.payload.onBehalfOf.name}</Strong> }), kind: 'milestone' }
        : { text: fill(t('thread.events.INCIDENT_CREATED'), { actor }), kind: 'milestone' };
    case 'TRIAGED': {
      const { from, to } = event.payload;
      const priority = (value: string) => t(`common.priority.${value as 'LOW'}`);
      if (from.priority && from.priority !== to.priority && from.category === to.category) {
        return {
          text: fill(t('thread.events.TRIAGED_PRIORITY'), { actor, from: priority(from.priority), to: <Strong>{priority(to.priority)}</Strong> }),
          kind: 'dot',
        };
      }
      if (from.priority === to.priority && from.category !== to.category) {
        return { text: fill(t('thread.events.TRIAGED_CATEGORY'), { actor, from: from.category, to: <Strong>{to.category}</Strong> }), kind: 'dot' };
      }
      return {
        text: fill(t('thread.events.TRIAGED'), { actor, priority: <Strong>{priority(to.priority)}</Strong>, category: <Strong>{to.category}</Strong> }),
        kind: 'dot',
      };
    }
    case 'ASSIGNED':
      return {
        text: event.payload.previous
          ? fill(t('thread.events.REASSIGNED'), { actor, previous: event.payload.previous.name, assignee: <Strong>{event.payload.assignee.name}</Strong> })
          : fill(t('thread.events.ASSIGNED'), { actor, assignee: <Strong>{event.payload.assignee.name}</Strong> }),
        kind: 'milestone',
        body: event.payload.note ? <Quote internal>{event.payload.note}</Quote> : undefined,
      };
    case 'UNASSIGNED':
      return {
        text: fill(t('thread.events.UNASSIGNED'), { actor, previous: <Strong>{event.payload.previous.name}</Strong> }),
        kind: 'warning',
        body: event.payload.reason ? <Quote>{event.payload.reason}</Quote> : undefined,
      };
    case 'ASSIGNMENT_ACCEPTED':
      return { text: fill(t('thread.events.ASSIGNMENT_ACCEPTED'), { actor }), kind: 'milestone' };
    case 'ASSIGNMENT_DECLINED':
      return { text: fill(t('thread.events.ASSIGNMENT_DECLINED'), { actor }), kind: 'warning', body: <Quote>{event.payload.reason}</Quote> };
    case 'REASSIGNMENT_REQUESTED':
      return {
        text: fill(t('thread.events.REASSIGNMENT_REQUESTED'), { actor, reason: t(`common.reassignmentReason.${event.payload.reasonCode}`).toLowerCase() }),
        kind: 'warning',
        body: event.payload.note ? <Quote>{event.payload.note}</Quote> : undefined,
      };
    case 'REASSIGNMENT_REJECTED':
      return {
        text: fill(t('thread.events.REASSIGNMENT_REJECTED'), { actor, assignee: <Strong>{event.payload.assignee.name}</Strong> }),
        kind: 'dot',
        body: event.payload.note ? <Quote>{event.payload.note}</Quote> : undefined,
      };
    case 'PROGRESS_POSTED': {
      const key =
        event.payload.progressType === 'ON_SITE'
          ? 'thread.events.PROGRESS_ON_SITE'
          : event.payload.progressType === 'BLOCKED'
            ? 'thread.events.PROGRESS_BLOCKED'
            : 'thread.events.PROGRESS_POSTED';
      const icon = event.payload.progressType === 'ON_SITE' ? <MapPin /> : event.payload.progressType === 'BLOCKED' ? <OctagonPause /> : null;
      return {
        text: (
          <>
            {icon && <span className="mr-1 inline-flex align-[-2px] text-ink-3 [&_svg]:size-3.5">{icon}</span>}
            {fill(t(key), { actor })}
          </>
        ),
        kind: event.payload.progressType === 'BLOCKED' ? 'warning' : 'dot',
        body: <Quote>{event.payload.note}</Quote>,
      };
    }
    case 'RESOLVED':
      return { text: fill(t('thread.events.RESOLVED'), { actor }), kind: 'milestone', body: <Quote tone="success">{event.payload.note}</Quote> };
    case 'SENT_BACK':
      return {
        text: (
          <>
            <Undo2 className="mr-1 inline size-3.5 align-[-2px] text-critical" aria-hidden />
            {fill(t('thread.events.SENT_BACK'), { actor })}
          </>
        ),
        kind: 'warning',
        body: <Quote>{event.payload.reason}</Quote>,
      };
    case 'CLOSED':
      return { text: fill(t('thread.events.CLOSED'), { actor }), kind: 'milestone' };
    case 'DISMISSED':
      return {
        text: (
          <>
            <CircleSlash className="mr-1 inline size-3.5 align-[-2px] text-ink-3" aria-hidden />
            {fill(t('thread.events.DISMISSED'), { actor, reason: t(`common.dismissReason.${event.payload.reason}`).toLowerCase() })}
          </>
        ),
        kind: 'muted',
        body: event.payload.note ? <Quote>{event.payload.note}</Quote> : undefined,
      };
    case 'COMMENT_ADDED':
      return {
        text: fill(t('thread.events.COMMENT_ADDED'), { actor }),
        kind: 'dot',
        internal: event.payload.visibility === 'INTERNAL',
        body: <Comment internal={event.payload.visibility === 'INTERNAL'}>{event.payload.body}</Comment>,
      };
    case 'ATTACHMENT_ADDED':
      return {
        text: (
          <>
            <Camera className="mr-1 inline size-3.5 align-[-2px] text-ink-3" aria-hidden />
            {fill(t('thread.events.ATTACHMENT_ADDED'), { actor })}
          </>
        ),
        kind: 'dot',
        body: (
          <a
            href={resourceUrl(`/v1/attachments/${event.payload.attachmentId}/file`)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block w-fit overflow-hidden rounded-md border border-line"
          >
            <img
              src={resourceUrl(`/v1/attachments/${event.payload.attachmentId}/file`)}
              alt={event.payload.fileName}
              loading="lazy"
              className="h-28 w-auto max-w-56 object-cover"
            />
          </a>
        ),
      };
  }
}

function Quote({ children, internal, tone }: { children: ReactNode; internal?: boolean; tone?: 'success' }) {
  return (
    <p
      className={cn(
        'mt-1.5 border-l-2 pl-3 text-sm whitespace-pre-line text-ink-2',
        tone === 'success' ? 'border-success' : internal ? 'border-dashed border-line-strong' : 'border-line-strong',
      )}
    >
      {children}
    </p>
  );
}

function Comment({ children, internal }: { children: ReactNode; internal?: boolean }) {
  return (
    <div
      className={cn(
        'mt-1.5 rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-line text-ink',
        internal ? 'border border-dashed border-line-strong bg-surface' : 'bg-subtle',
      )}
    >
      {children}
    </div>
  );
}

/** What the incident is waiting for, shown as the last node of the Thread. */
function liveNode(incident: IncidentDetail, t: Formatter['t']): string | null {
  const assignee = incident.liveAssignment?.intervenant.name ?? '';
  if (incident.status === 'NEW') return t('thread.live.triage');
  if (incident.status === 'ASSIGNED') return t('thread.live.acceptance', { name: assignee });
  if (incident.liveAssignment?.status === 'REASSIGNMENT_REQUESTED') return t('thread.live.reassignment');
  if (incident.status === 'IN_PROGRESS') return t('thread.live.work', { name: assignee });
  if (incident.status === 'RESOLVED') return t('thread.live.review');
  return null;
}

export function Thread({ events, incident, className }: { events: ThreadEvent[]; incident?: IncidentDetail; className?: string }) {
  const f = useT();
  const live = incident ? liveNode(incident, f.t) : null;
  let lastDay = '';

  if (events.length === 0) return <p className="py-6 text-sm text-ink-3">{f.t('thread.empty')}</p>;

  return (
    <ol className={cn('relative', className)} aria-label={f.t('thread.title')}>
      <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-px bg-line-strong/70" />
      {events.map((event) => {
        const { text, kind, body, internal } = summary(event, f);
        const day = dayLabel(event.createdAt, f);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <Fragment key={event.id}>
            {showDay && (
              <li aria-hidden className="relative py-2 pl-8 text-xs font-medium text-ink-3 first:pt-0">
                {day}
              </li>
            )}
            <li className="relative flex gap-3 pb-4 animate-fade-in">
              <div className="flex w-6 shrink-0 justify-center">
                <Node kind={kind} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-ink-2">
                  {event.actor && kind === 'dot' && event.type === 'COMMENT_ADDED' && (
                    <Avatar name={event.actor.name} size="xs" className="self-center" />
                  )}
                  <span className="min-w-0">{text}</span>
                  {internal && (
                    <Tooltip content={f.t('thread.internalHint')}>
                      <span className="inline-flex items-center gap-1 rounded-xs bg-muted px-1.5 text-2xs font-medium text-ink-2">
                        <Lock className="size-2.5" aria-hidden />
                        {f.t('thread.internal')}
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip content={f.date(event.createdAt, 'datetime')}>
                    <time dateTime={event.createdAt} className="text-xs text-ink-3">
                      {f.date(event.createdAt, 'time')}
                    </time>
                  </Tooltip>
                </div>
                {body}
              </div>
            </li>
          </Fragment>
        );
      })}
      {live && (
        <li className="relative flex gap-3" aria-live="polite">
          <div className="flex w-6 shrink-0 justify-center">
            <Node kind="current" live />
          </div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <ArrowRight className="size-3.5" aria-hidden />
            {live}
          </p>
        </li>
      )}
    </ol>
  );
}
