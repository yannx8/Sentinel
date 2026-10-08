import { dismissReasons, priorities, type DismissReason, type IncidentDetail, type Priority } from '@sentinel/shared';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { useT } from '../../i18n';
import { useIncidentAction } from '../../lib/incidents';
import { useActed } from './acted';
import { useCategories } from './assign-dialog';

type Props = { incident: IncidentDetail; open: boolean; onOpenChange: (open: boolean) => void };

function Shell({
  open,
  onOpenChange,
  title,
  description,
  submit,
  variant = 'primary',
  disabled,
  loading,
  focusSubmit,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submit: string;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
  loading: boolean;
  /** Puts focus on the submit button so Enter confirms (for dialogs with nothing to type). */
  focusSubmit?: boolean;
  onSubmit: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant={variant} disabled={disabled} loading={loading} onClick={onSubmit} autoFocus={focusSubmit}>
              {submit}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function useRun(incident: IncidentDetail, onOpenChange: (open: boolean) => void) {
  const action = useIncidentAction();
  const acted = useActed();
  return {
    pending: action.isPending,
    run: (suffix: string, body: Record<string, unknown>, success: string) =>
      action.mutate(
        {
          path: `/incidents/${incident.reference}/${suffix}`,
          body: { expectedVersion: incident.version, ...body },
          success,
        },
        {
          onSuccess: () => {
            onOpenChange(false);
            acted(suffix);
          },
        },
      ),
  };
}

function useReset(open: boolean, reset: () => void) {
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

export function TriageDialog({ incident, open, onOpenChange }: Props) {
  const { t } = useT();
  const categories = useCategories();
  const [priority, setPriority] = useState<Priority>(incident.priority);
  const [categoryId, setCategoryId] = useState(incident.category.id);
  const { run, pending } = useRun(incident, onOpenChange);
  useReset(open, () => {
    setPriority(incident.priority);
    setCategoryId(incident.category.id);
  });
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={t('incidents.triage.title', { reference: incident.reference })}
      description={t('incidents.triage.description')}
      submit={t('incidents.triage.submit')}
      loading={pending}
      onSubmit={() => run('triage', { priority, categoryId }, t('incidents.triage.done'))}
    >
      <div className="grid gap-4">
        <Field label={t('incidents.assign.priority')}>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as Priority)}
            options={[...priorities].reverse().map((v) => ({ value: v, label: t(`common.priority.${v}`) }))}
          />
        </Field>
        <Field label={t('incidents.assign.category')}>
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            options={(categories.data ?? [])
              .filter((c) => c.isActive || c.id === incident.category.id)
              .map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
      </div>
    </Shell>
  );
}

export function UnassignDialog({ incident, open, onOpenChange }: Props) {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const { run, pending } = useRun(incident, onOpenChange);
  useReset(open, () => setReason(''));
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={t('incidents.unassignDialog.title', { reference: incident.reference })}
      description={t('incidents.unassignDialog.body', { name: incident.assignee?.name ?? '' })}
      submit={t('incidents.unassignDialog.submit')}
      variant="danger"
      loading={pending}
      onSubmit={() =>
        run(
          'unassign',
          { reason: reason.trim() || undefined },
          t('incidents.unassignDialog.done', { reference: incident.reference }),
        )
      }
    >
      <Field label={t('incidents.unassignDialog.reason')} optional>
        <Textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Shell>
  );
}

export function SendBackDialog({ incident, open, onOpenChange }: Props) {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const { run, pending } = useRun(incident, onOpenChange);
  useReset(open, () => setReason(''));
  const length = reason.trim().length;
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={t('incidents.sendBack.title', { reference: incident.reference })}
      description={t('incidents.sendBack.description')}
      submit={t('incidents.sendBack.submit')}
      disabled={length < 10}
      loading={pending}
      onSubmit={() =>
        run('send-back', { reason: reason.trim() }, t('incidents.sendBack.done', { reference: incident.reference }))
      }
    >
      <Field label={t('incidents.sendBack.reason')} aside={t('common.characters', { count: length, max: 500 })}>
        <Textarea
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && length >= 10 && !pending) {
              e.preventDefault();
              run(
                'send-back',
                { reason: reason.trim() },
                t('incidents.sendBack.done', { reference: incident.reference }),
              );
            }
          }}
          autoFocus
        />
      </Field>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t('incidents.sendBack.quickLabel')}>
        {(['missingPhoto', 'notFixed', 'moreDetail'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              const text = t(`incidents.sendBack.quick.${key}`);
              setReason((current) => (current.trim() ? `${current.trim()} ${text}` : text).slice(0, 500));
            }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-subtle hover:text-ink"
          >
            {t(`incidents.sendBack.quick.${key}`)}
          </button>
        ))}
      </div>
    </Shell>
  );
}

export function DismissDialog({ incident, open, onOpenChange }: Props) {
  const { t } = useT();
  const [reason, setReason] = useState<DismissReason>('DUPLICATE');
  const [note, setNote] = useState('');
  const { run, pending } = useRun(incident, onOpenChange);
  useReset(open, () => {
    setReason('DUPLICATE');
    setNote('');
  });
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={t('incidents.dismissDialog.title', { reference: incident.reference })}
      description={t('incidents.dismissDialog.description')}
      submit={t('incidents.dismissDialog.submit')}
      variant="danger"
      loading={pending}
      onSubmit={() =>
        run(
          'dismiss',
          { reason, note: note.trim() || undefined },
          t('incidents.dismissDialog.done', { reference: incident.reference }),
        )
      }
    >
      <div className="grid gap-4">
        <Field label={t('incidents.dismissDialog.reason')}>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v as DismissReason)}
            options={dismissReasons.map((v) => ({ value: v, label: t(`common.dismissReason.${v}`) }))}
          />
        </Field>
        <Field label={t('incidents.dismissDialog.note')} optional>
          <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Shell>
  );
}

export function CloseDialog({ incident, open, onOpenChange }: Props) {
  const { t } = useT();
  const { run, pending } = useRun(incident, onOpenChange);
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      title={t('incidents.closeDialog.title', { reference: incident.reference })}
      description={t('incidents.closeDialog.body')}
      submit={t('incidents.closeDialog.submit')}
      loading={pending}
      focusSubmit
      onSubmit={() => run('close', {}, t('incidents.closeDialog.done', { reference: incident.reference }))}
    />
  );
}
