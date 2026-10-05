import * as Tabs from '@radix-ui/react-tabs';
import { supervisorActions, type SupervisorAction } from '@sentinel/shared';
import { FileText, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { PriorityChip, StatusChip, priorityLabel } from '../../components/ui/Chip';
import { Switch } from '../../components/ui/Switch';
import type { IncidentAction } from '../../data/actions';
import type { DismissCode, Incident } from '../../data/types';
import { cn, formatAbsolute, formatRelative } from '../../lib/util';
import { AssignDialog } from './AssignDialog';
import { ReasonDialog } from './ReasonDialog';
import { Thread } from './Thread';
import { categoryName, effectivePriority, siteName, stateSentence } from './state';
import type { RunOptions } from './useActionRunner';

type Run = (reference: string, action: IncidentAction, opts: RunOptions) => void;

const dismissCodes = [
  { value: 'DUPLICATE', label: 'Duplicate of another incident' },
  { value: 'NOT_AN_INCIDENT', label: 'Not an incident' },
  { value: 'NO_ACTION_NEEDED', label: 'No action needed' },
];

const tab =
  'relative -mb-px border-b-2 border-transparent py-2.5 text-base font-medium text-ink-2 transition-colors duration-(--dur-small) hover:text-ink data-[state=active]:border-brand data-[state=active]:text-brand';

const actionLabel = (a: SupervisorAction, triaged: boolean): string =>
  ({
    'triage-assign': triaged ? 'Assign' : 'Triage and assign',
    dismiss: 'Dismiss',
    reassign: 'Reassign',
    unassign: 'Unassign',
    close: 'Close',
    'send-back': 'Send back',
  })[a];

function Composer({ incident, onSend }: { incident: Incident; onSend: (visibility: 'PUBLIC' | 'INTERNAL', body: string) => void }) {
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'INTERNAL'>('INTERNAL');

  if (incident.status === 'CLOSED') {
    return <p className="rounded-panel bg-surface-2 px-3 py-2 text-sm text-ink-2">Closed incidents are read-only.</p>;
  }

  return (
    <form
      className="grid gap-2 rounded-panel border border-border bg-surface p-3 focus-within:border-brand"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        onSend(visibility, body.trim());
        setBody('');
      }}
    >
      <label htmlFor="comment" className="sr-only">Add a comment</label>
      <textarea
        id="comment"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={visibility === 'INTERNAL' ? 'Write a note for supervisors and the technician' : 'Write a reply the reporter will see'}
        className="w-full resize-none bg-transparent text-base text-ink focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex gap-0.5 rounded-control bg-sunken p-0.5">
          <legend className="sr-only">Who can see it</legend>
          {(
            [
              ['INTERNAL', 'Internal note'],
              ['PUBLIC', 'Reply to reporter'],
            ] as const
          ).map(([value, text]) => (
            <label
              key={value}
              className={cn(
                'cursor-pointer rounded-[6px] px-2.5 py-1 text-sm font-medium transition-colors duration-(--dur-small) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand',
                visibility === value ? 'bg-surface text-ink' : 'text-ink-2 hover:text-ink',
              )}
            >
              <input type="radio" name="visibility" className="sr-only" checked={visibility === value} onChange={() => setVisibility(value)} />
              {text}
            </label>
          ))}
        </fieldset>
        <Button variant="secondary" type="submit" disabled={!body.trim()}>Add comment</Button>
      </div>
    </form>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2.5">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </div>
  );
}

export function CaseFile({ incident, now, run, onClose }: { incident: Incident; now: number; run: Run; onClose?: () => void }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [reason, setReason] = useState<'dismiss' | 'send-back' | null>(null);
  const [showInternal, setShowInternal] = useState(true);

  const state = stateSentence(incident);
  const actions = supervisorActions[incident.status];
  const triaged = incident.priority !== null;
  const reportedAt = incident.thread.find((e) => e.kind === 'reported')?.at ?? incident.createdAt;
  const lastResolved = [...incident.thread].reverse().find((e) => e.kind === 'resolved');
  const resolutionText = lastResolved?.kind === 'resolved' ? lastResolved.note : null;

  const doAction = (a: SupervisorAction) => {
    switch (a) {
      case 'triage-assign':
      case 'reassign':
        return setAssignOpen(true);
      case 'dismiss':
        return setReason('dismiss');
      case 'send-back':
        return setReason('send-back');
      case 'unassign':
        return run(incident.reference, { type: 'unassign' }, { success: `${incident.reference} is back in the inbox` });
      case 'close':
        return run(incident.reference, { type: 'close' }, { success: `Closed ${incident.reference}` });
    }
  };

  return (
    <article aria-label={incident.reference} className="h-full min-h-0">
      <Tabs.Root defaultValue="thread" className="flex h-full min-h-0 flex-col bg-surface">
        <header className="relative border-b border-border px-6 pt-5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-control text-ink-2 transition-colors duration-(--dur-small) hover:bg-sunken hover:text-ink"
            >
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          <p className="text-sm text-ink-3">{incident.reference}</p>
          <h2 className="mt-0.5 pr-8 font-display text-title-md font-semibold text-ink">{incident.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
            <PriorityChip priority={effectivePriority(incident)} />
            <StatusChip status={incident.status} live={state.live} />
            <span>{siteName(incident.siteId)}</span>
            <time className="text-ink-3" dateTime={new Date(reportedAt).toISOString()} title={formatAbsolute(reportedAt)}>
              {incident.reporter}, {formatRelative(reportedAt, now)} ago
            </time>
          </div>
          {!triaged ? <p className="mt-2 text-sm text-ink-3">Priority is the reporter's suggestion until you triage it.</p> : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {actions.length === 0 ? (
              <p className="py-1 text-sm text-ink-3">Closed incidents are read-only.</p>
            ) : (
              actions.map((a, i) => (
                <Button key={a} variant={i === 0 ? 'primary' : 'secondary'} onClick={() => doAction(a)}>
                  {actionLabel(a, triaged)}
                </Button>
              ))
            )}
          </div>

          <Tabs.List aria-label="Incident sections" className="mt-3 flex gap-6">
            <Tabs.Trigger value="overview" className={tab}>Overview</Tabs.Trigger>
            <Tabs.Trigger value="thread" className={tab}>Thread</Tabs.Trigger>
            <Tabs.Trigger value="evidence" className={tab}>
              Evidence{incident.attachments.length ? ` (${incident.attachments.length})` : ''}
            </Tabs.Trigger>
          </Tabs.List>
        </header>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <Tabs.Content value="overview" className="grid gap-5 outline-offset-8">
            <p className="max-w-[65ch] text-md text-ink">{incident.description}</p>
            {resolutionText ? (
              <section aria-labelledby="resolution-h" className="rounded-panel border border-success bg-success-tint px-4 py-3">
                <h3 id="resolution-h" className="text-sm font-semibold text-success-ink">Resolution from {incident.assignee?.name ?? 'the technician'}</h3>
                <p className="mt-1 text-base text-ink">{resolutionText}</p>
              </section>
            ) : null}
            <dl className="divide-y divide-border border-y border-border">
              <Detail label="Site">{siteName(incident.siteId)}</Detail>
              <Detail label="Category">{categoryName(incident.categoryId)}</Detail>
              <Detail label="Reporter">{incident.reporter}</Detail>
              <Detail label="Reported">{formatAbsolute(reportedAt)}</Detail>
              <Detail label="Priority">
                {priorityLabel[effectivePriority(incident)]}
                {incident.priority && incident.priority !== incident.reportedPriority ? (
                  <span className="text-ink-3">, reported as {priorityLabel[incident.reportedPriority]}</span>
                ) : null}
              </Detail>
              <Detail label="Assignee">{incident.assignee?.name ?? <span className="text-ink-3">Nobody yet</span>}</Detail>
            </dl>
          </Tabs.Content>

          <Tabs.Content value="thread" className="grid gap-5 outline-offset-8">
            <div className="grid gap-3">
              <Composer
                incident={incident}
                onSend={(visibility, body) =>
                  run(incident.reference, { type: 'comment', visibility, body }, { success: visibility === 'INTERNAL' ? 'Note added' : 'Reply sent' })
                }
              />
              <Switch checked={showInternal} onCheckedChange={setShowInternal} label="Show internal notes" />
            </div>
            <Thread incident={incident} now={now} showInternal={showInternal} />
          </Tabs.Content>

          <Tabs.Content value="evidence" className="outline-offset-8">
            {incident.attachments.length === 0 ? (
              <p className="text-base text-ink-2">No photos or files on this incident. Employees and technicians can add them from the app.</p>
            ) : (
              <ul className="grid gap-2">
                {incident.attachments.map((a) => (
                  <li key={a.name} className="flex items-center gap-2.5 rounded-control border border-border px-3 py-2.5 text-base text-ink">
                    <FileText size={16} strokeWidth={1.75} aria-hidden className="text-ink-3" />
                    {a.name}
                    <span className="ml-auto text-sm text-ink-3">{(a.sizeKb / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
              </ul>
            )}
          </Tabs.Content>
        </div>
      </Tabs.Root>

      <AssignDialog
        incident={incident}
        mode={incident.status === 'NEW' ? 'assign' : 'reassign'}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssign={(action) =>
          run(incident.reference, action, {
            success: `Assigned to ${action.assignee.name}`,
            undo: incident.status === 'NEW' ? { type: 'unassign' } : undefined,
          })
        }
      />
      <ReasonDialog
        open={reason === 'dismiss'}
        onOpenChange={(o) => !o && setReason(null)}
        title={`Dismiss ${incident.reference}`}
        description="It moves to Closed without any work, and the reporter is told."
        label="Note"
        placeholder="Add context for the audit log."
        confirmLabel="Dismiss"
        minLength={0}
        codes={dismissCodes}
        onConfirm={({ reason: note, code }) =>
          run(
            incident.reference,
            { type: 'dismiss', code: (code ?? 'NO_ACTION_NEEDED') as DismissCode, note: note || undefined },
            { success: `Dismissed ${incident.reference}` },
          )
        }
      />
      <ReasonDialog
        open={reason === 'send-back'}
        onOpenChange={(o) => !o && setReason(null)}
        title={`Send back ${incident.reference}`}
        description={`${incident.assignee?.name ?? 'The technician'} gets it back with your reason.`}
        label="What still needs fixing?"
        placeholder="Describe what you found when you checked."
        confirmLabel="Send back"
        minLength={10}
        onConfirm={({ reason: r }) => run(incident.reference, { type: 'send-back', reason: r }, { success: `Sent ${incident.reference} back` })}
      />
    </article>
  );
}
