import { priorities, type CandidateDTO, type CategoryDTO, type IncidentDetail, type Priority } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { useCandidates, useIncidentAction } from '../../lib/incidents';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryDTO[]>('/categories'),
    staleTime: 60_000,
  });
}

export function Candidate({
  candidate,
  selected,
  onSelect,
  best,
}: {
  candidate: CandidateDTO;
  selected: boolean;
  onSelect: () => void;
  best: boolean;
}) {
  const { t } = useT();
  const disabled = !candidate.eligible;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={selected ? 0 : -1}
      data-candidate
      onClick={() => !disabled && onSelect()}
      className={cn(
        'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
        selected ? 'border-accent bg-accent-subtle' : 'border-line hover:bg-subtle',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-accent bg-accent text-white' : 'border-line-strong',
        )}
        aria-hidden
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <Avatar name={candidate.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          {candidate.name}
          {best && <Badge tone="accent">{t('incidents.assign.recommended')}</Badge>}
        </span>
        {candidate.companyName && <span className="block text-xs text-ink-3">{candidate.companyName}</span>}
        {disabled ? (
          <span className="mt-1 block text-xs text-critical-ink">
            {candidate.reason ? t(`incidents.assign.reasons.${candidate.reason}`) : ''}
          </span>
        ) : (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {candidate.specialtyMatch && <Badge tone="success">{t('incidents.assign.fit.specialty')}</Badge>}
            <Badge tone={candidate.availability === 'AVAILABLE' ? 'neutral' : 'warning'}>
              {t(`common.availability.${candidate.availability}`)}
            </Badge>
            <Badge>
              {candidate.openAssignments
                ? t('incidents.assign.fit.open', { count: candidate.openAssignments })
                : t('incidents.assign.fit.openNone')}
            </Badge>
            {candidate.warning && (
              <span className="inline-flex items-center gap-1 text-xs text-medium-ink">
                <TriangleAlert className="size-3" aria-hidden />
                {t(`incidents.assign.warnings.${candidate.warning}`)}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

export function AssignDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: IncidentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const candidates = useCandidates(incident.reference, open);
  const categories = useCategories();
  const action = useIncidentAction();
  const [priority, setPriority] = useState<Priority>(incident.priority);
  const [categoryId, setCategoryId] = useState(incident.category.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const list = candidates.data ?? [];
  const firstEligible = list.find((c) => c.eligible);

  useEffect(() => {
    if (open) {
      setPriority(incident.priority);
      setCategoryId(incident.category.id);
      setNote('');
      setSelected(null);
    }
  }, [open, incident.priority, incident.category.id]);
  useEffect(() => {
    if (open && selected === null && firstEligible) setSelected(firstEligible.membershipId);
  }, [open, selected, firstEligible]);

  const choice = list.find((c) => c.membershipId === selected);
  const reassign = incident.status !== 'NEW';
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const eligible = list.filter((c) => c.eligible);
    const index = eligible.findIndex((c) => c.membershipId === selected);
    const next = eligible[(index + (event.key === 'ArrowDown' ? 1 : -1) + eligible.length) % eligible.length];
    if (next) {
      setSelected(next.membershipId);
      requestAnimationFrame(() =>
        event.currentTarget.querySelectorAll<HTMLElement>('[data-candidate]')[list.indexOf(next)]?.focus(),
      );
    }
  };

  const submit = () => {
    if (!choice) return;
    action.mutate(
      {
        path: `/incidents/${incident.reference}/assign`,
        body: {
          expectedVersion: incident.version,
          intervenantMembershipId: choice.membershipId,
          priority,
          categoryId,
          note: note.trim() || undefined,
        },
        success: t('incidents.assign.assigned', { name: choice.name }),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={t(reassign ? 'incidents.assign.reassignTitle' : 'incidents.assign.title', {
          reference: incident.reference,
        })}
        description={t('incidents.assign.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={!choice} loading={action.isPending} onClick={submit}>
              {t('incidents.assign.submit')}
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('incidents.assign.priority')}>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
                options={[...priorities].reverse().map((value) => ({ value, label: t(`common.priority.${value}`) }))}
              />
            </Field>
            <Field label={t('incidents.assign.category')}>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                options={(categories.data ?? [incident.category as unknown as CategoryDTO])
                  .filter((c) => c.isActive !== false || c.id === incident.category.id)
                  .map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink" id="candidates-label">
              {t('incidents.assign.candidates')}
            </p>
            {candidates.isPending ? (
              <div className="grid gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-[66px] w-full rounded-md" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState title={t('incidents.assign.noCandidates')} className="py-8" />
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="candidates-label"
                onKeyDown={onKey}
                className="grid max-h-[320px] gap-2 overflow-y-auto pr-1"
              >
                {list.map((candidate) => (
                  <Candidate
                    key={candidate.membershipId}
                    candidate={candidate}
                    selected={candidate.membershipId === selected}
                    best={candidate.membershipId === firstEligible?.membershipId && candidate.eligible}
                    onSelect={() => setSelected(candidate.membershipId)}
                  />
                ))}
              </div>
            )}
          </div>
          <Field label={t('incidents.assign.note')} optional hint={t('incidents.assign.noteHint')}>
            <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
