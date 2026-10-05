import { priorities, rankCandidates, type Priority, type RankedCandidate } from '@sentinel/shared';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Overlay';
import { priorityLabel } from '../../components/ui/Chip';
import { categories, directory } from '../../data/seed';
import type { IncidentAction } from '../../data/actions';
import type { Incident } from '../../data/types';
import { cn } from '../../lib/util';
import { effectivePriority } from './state';

const availabilityLabel = { AVAILABLE: 'Available', BUSY: 'Busy', OFF: 'Off duty' } as const;

const fieldLabel = 'text-sm font-medium text-ink';
const select =
  'h-9 w-full rounded-control border border-border-strong bg-surface px-3 text-base text-ink transition-[border-color,box-shadow] duration-(--dur-small) focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand-tint';

function Fit({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-pill border px-2 py-0.5 text-xs',
        tone === 'neutral' && 'border-border bg-surface-2 text-ink-2',
        tone === 'good' && 'border-transparent bg-success-tint text-success-ink',
        tone === 'warn' && 'border-transparent bg-medium-tint text-medium-ink',
        tone === 'bad' && 'border-transparent bg-critical-tint text-critical-ink',
      )}
    >
      {children}
    </span>
  );
}

function CandidateRow({
  ranked,
  requiredSpecialty,
  checked,
  onSelect,
  best,
}: {
  ranked: RankedCandidate;
  requiredSpecialty: string | null;
  checked: boolean;
  onSelect: () => void;
  best: boolean;
}) {
  const { candidate: c, fit, eligible } = ranked;
  return (
    <label
      className={cn(
        'grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 border-b border-border px-5 py-3 transition-colors duration-(--dur-small)',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand',
        checked ? 'bg-brand-tint' : 'hover:bg-surface-2',
        !eligible && 'cursor-not-allowed hover:bg-transparent',
      )}
    >
      <input type="radio" name="assignee" className="peer sr-only" checked={checked} disabled={!eligible} onChange={onSelect} />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 size-[18px] rounded-full border-2 bg-surface transition-[border-color,box-shadow] duration-(--dur-small)',
          checked ? 'border-brand shadow-[inset_0_0_0_3px_var(--surface),inset_0_0_0_9px_var(--brand)]' : 'border-border-strong',
          !eligible && 'border-border bg-sunken',
        )}
      />
      <span className={cn('min-w-0', !eligible && 'text-ink-3')}>
        <span className="flex items-baseline gap-2">
          <span className="font-medium text-ink">{c.name}</span>
          {best && eligible ? <span className="text-xs text-brand">Best fit</span> : null}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {eligible ? (
            <>
              {requiredSpecialty ? (
                fit.specialtyMatch ? <Fit tone="good">{requiredSpecialty} match</Fit> : <Fit>{c.specialties.join(', ')}</Fit>
              ) : null}
              <Fit tone={fit.availability === 'OFF' ? 'warn' : 'neutral'}>{availabilityLabel[fit.availability]}</Fit>
              <Fit>{fit.openAssignments === 0 ? 'No open work' : `${fit.openAssignments} open`}</Fit>
              <Fit tone="good">Site access</Fit>
            </>
          ) : (
            <Fit tone="bad">{ranked.reason}</Fit>
          )}
        </span>
        {ranked.warning ? <span className="mt-1 block text-xs text-medium-ink">{ranked.warning}. You can still assign them.</span> : null}
      </span>
    </label>
  );
}

function AssignForm({
  incident,
  mode,
  onCancel,
  onAssign,
}: {
  incident: Incident;
  mode: 'assign' | 'reassign';
  onCancel: () => void;
  onAssign: (action: Extract<IncidentAction, { type: 'assign' }>) => void;
}) {
  const [priority, setPriority] = useState<Priority>(effectivePriority(incident));
  const [categoryId, setCategoryId] = useState(incident.categoryId);
  const [note, setNote] = useState('');

  const requiredSpecialty = categories.find((c) => c.id === categoryId)?.requiredSpecialty ?? null;
  const ranked = useMemo(
    () => rankCandidates(directory.candidates, { siteId: incident.siteId, requiredSpecialty }),
    [incident.siteId, requiredSpecialty],
  );
  const best = ranked.find((r) => r.eligible)?.candidate.id ?? null;
  // Reassigning must pick someone new, so the current assignee starts unselected.
  const [picked, setPicked] = useState<string | null>(mode === 'assign' ? best : null);
  const pickedRanked = ranked.find((r) => r.candidate.id === picked && r.eligible);

  const submit = () => {
    if (!pickedRanked) return;
    onAssign({
      type: 'assign',
      assignee: { id: pickedRanked.candidate.id, name: pickedRanked.candidate.name },
      priority,
      categoryId,
      note: note.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-2 gap-4 px-5 py-4">
        <div className="grid gap-1">
          <label htmlFor="assign-priority" className={fieldLabel}>Priority</label>
          <select id="assign-priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {[...priorities].reverse().map((p) => (
              <option key={p} value={p}>{priorityLabel[p]}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="assign-category" className={fieldLabel}>Category</label>
          <select id="assign-category" className={select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="border-t border-border">
        <legend className="sr-only">Choose who to assign</legend>
        {ranked.map((r) => (
          <CandidateRow
            key={r.candidate.id}
            ranked={r}
            requiredSpecialty={requiredSpecialty}
            checked={picked === r.candidate.id}
            onSelect={() => setPicked(r.candidate.id)}
            best={r.candidate.id === best}
          />
        ))}
      </fieldset>

      <div className="grid gap-1 px-5 py-4">
        <label htmlFor="assign-note" className={fieldLabel}>
          Note for the technician <span className="font-normal text-ink-3">(internal, optional)</span>
        </label>
        <textarea
          id="assign-note"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink transition-[border-color,box-shadow] duration-(--dur-small) focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand-tint"
          placeholder="Access code, who to ask for, anything that saves a phone call."
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <p className="text-sm text-ink-3" aria-live="polite">
          {pickedRanked ? `${pickedRanked.candidate.name} will be asked to accept.` : 'Choose someone to continue.'}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!pickedRanked}>
            {mode === 'assign' ? 'Assign' : 'Reassign'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function AssignDialog({
  incident,
  mode,
  open,
  onOpenChange,
  onAssign,
}: {
  incident: Incident;
  mode: 'assign' | 'reassign';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (action: Extract<IncidentAction, { type: 'assign' }>) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${mode === 'assign' ? 'Assign' : 'Reassign'} ${incident.reference}`}
      description={incident.title}
    >
      <AssignForm
        key={incident.reference + String(open)}
        incident={incident}
        mode={mode}
        onCancel={() => onOpenChange(false)}
        onAssign={(a) => {
          onAssign(a);
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}
