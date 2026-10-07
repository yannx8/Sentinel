import { zodResolver } from '@hookform/resolvers/zod';
import { commentSchema, type CommentVisibility, type IncidentDetail } from '@sentinel/shared';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { useMembership } from '../../app/session';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Segmented } from '../../components/ui/segmented';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { applyServerErrors } from '../../lib/forms';
import { useAddComment } from '../../lib/incidents';
import { largeSegments } from './parts';

type CommentInput = z.input<typeof commentSchema>;
type CommentOutput = z.output<typeof commentSchema>;

/**
 * Comment box under the Thread. Employees always post publicly. Intervenants
 * choose between a public reply and an internal note, public by default.
 */
export function CommentBox({ incident }: { incident: IncidentDetail }) {
  const { t } = useT();
  const id = useId();
  const membership = useMembership();
  const canInternal = incident.actions.includes('comment-internal');
  const add = useAddComment(incident.reference);
  const form = useForm<CommentInput, unknown, CommentOutput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '', visibility: 'PUBLIC' },
  });
  const internal = useWatch({ control: form.control, name: 'visibility' }) === 'INTERNAL';

  const submit = form.handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values);
    } catch (error) {
      applyServerErrors(form, error);
      return;
    }
    toast.success(values.visibility === 'INTERNAL' ? t('field.comment.noteAdded') : t('field.comment.sent'));
    form.reset({ body: '', visibility: values.visibility });
  });

  const placeholder =
    membership.role === 'REPORTER'
      ? t('field.comment.placeholderEmployee')
      : internal
        ? t('field.comment.placeholderInternal')
        : t('field.comment.placeholderPublic');

  return (
    <section aria-labelledby={id} className="border-t border-line pt-6">
      <h2 id={id} className="text-sm font-semibold text-ink">
        {t('field.comment.label')}
      </h2>
      <form onSubmit={submit} noValidate className="mt-3 grid gap-3">
        {canInternal && (
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <Segmented<CommentVisibility>
                label={t('field.comment.visibility')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'PUBLIC', label: t('field.comment.public') },
                  { value: 'INTERNAL', label: t('field.comment.internal') },
                ]}
                className={largeSegments}
              />
            )}
          />
        )}
        <Field
          label={t('field.comment.label')}
          hideLabel
          hint={canInternal ? (internal ? t('field.comment.hintInternal') : t('field.comment.hintPublic')) : undefined}
          error={form.formState.errors.body?.message}
        >
          <Textarea
            rows={3}
            maxLength={4000}
            placeholder={placeholder}
            className={cn('text-md', internal && 'border-dashed')}
            {...form.register('body')}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" size="xl" loading={form.formState.isSubmitting}>
            {internal ? t('field.comment.addNote') : t('field.comment.send')}
          </Button>
        </div>
      </form>
    </section>
  );
}
