import { zodResolver } from '@hookform/resolvers/zod';
import { declineSchema, reassignmentReasons, requestReassignmentSchema } from '@sentinel/shared';
import { useNavigate } from '@tanstack/react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { useT } from '../../i18n';
import { applyServerErrors } from '../../lib/forms';
import { useIncidentAction } from '../../lib/incidents';
import { ChoiceList } from './choice-list';
import { FormSheet } from './parts';

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void; assignmentId: string };

/** Declining needs a reason. Afterwards the incident leaves the intervenant's scope, so we go back to My work. */
export function DeclineSheet({ open, onOpenChange, assignmentId }: SheetProps) {
  const { t, number } = useT();
  const navigate = useNavigate();
  const action = useIncidentAction();
  const form = useForm<z.input<typeof declineSchema>, unknown, z.output<typeof declineSchema>>({
    resolver: zodResolver(declineSchema),
    defaultValues: { reason: '' },
  });
  const reason = useWatch({ control: form.control, name: 'reason' }) ?? '';
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    try {
      await action.mutateAsync({
        path: `/assignments/${assignmentId}/decline`,
        body: values,
        success: t('field.actions.declined'),
      });
    } catch (error) {
      applyServerErrors(form, error);
      return;
    }
    onOpenChange(false);
    void navigate({ to: '/field/work', replace: true });
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      title={t('field.actions.declineTitle')}
      description={t('field.actions.declineDescription')}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t('field.actions.decline')}
        </Button>
      }
    >
      <Field
        label={t('field.actions.declineReason')}
        error={form.formState.errors.reason?.message}
        aside={t('common.characters', { count: number(reason.length), max: number(500) })}
      >
        <Textarea
          rows={4}
          maxLength={500}
          className="text-md"
          placeholder={t('field.actions.declinePlaceholder')}
          {...form.register('reason')}
        />
      </Field>
    </FormSheet>
  );
}

/** Asking to hand the incident over. The intervenant keeps it until a supervisor decides. */
export function ReassignSheet({ open, onOpenChange, assignmentId }: SheetProps) {
  const { t, number } = useT();
  const action = useIncidentAction();
  const form = useForm<z.input<typeof requestReassignmentSchema>, unknown, z.output<typeof requestReassignmentSchema>>({
    resolver: zodResolver(requestReassignmentSchema),
    defaultValues: { note: '' },
  });
  const note = useWatch({ control: form.control, name: 'note' }) ?? '';
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    try {
      await action.mutateAsync({
        path: `/assignments/${assignmentId}/request-reassignment`,
        body: values,
        success: t('field.actions.reassignmentRequested'),
      });
    } catch (error) {
      applyServerErrors(form, error);
      return;
    }
    onOpenChange(false);
    form.reset({ note: '' });
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      title={t('field.actions.requestReassignment')}
      description={t('field.actions.reassignDescription')}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t('field.actions.requestReassignment')}
        </Button>
      }
    >
      <Controller
        control={form.control}
        name="reasonCode"
        render={({ field, fieldState }) => (
          <ChoiceList
            name={field.name}
            label={t('field.actions.reassignReason')}
            options={reassignmentReasons.map((reason) => ({ value: reason, label: t(`common.reassignmentReason.${reason}`) }))}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            error={
              fieldState.error
                ? fieldState.error.type === 'server'
                  ? fieldState.error.message
                  : t('common.validation.choose')
                : undefined
            }
          />
        )}
      />
      <Field
        label={t('field.actions.reassignNote')}
        optional
        error={form.formState.errors.note?.message}
        aside={t('common.characters', { count: number(note.length), max: number(500) })}
      >
        <Textarea
          rows={3}
          maxLength={500}
          className="text-md"
          placeholder={t('field.actions.reassignNotePlaceholder')}
          {...form.register('note')}
        />
      </Field>
    </FormSheet>
  );
}
