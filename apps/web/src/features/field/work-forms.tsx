import { zodResolver } from '@hookform/resolvers/zod';
import { progressSchema, progressTypes, resolveSchema, type IncidentDetail, type ProgressType } from '@sentinel/shared';
import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { useMembership } from '../../app/session';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Segmented } from '../../components/ui/segmented';
import { useT } from '../../i18n';
import { applyServerErrors } from '../../lib/forms';
import { useIncidentAction, useUploadPhoto } from '../../lib/incidents';
import { FormSheet, largeSegments } from './parts';
import { PhotoPicker } from './photo-picker';
import type { PreparedPhoto } from './photos';

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentDetail;
  assignmentId: string;
};

/**
 * Uploads a photo before the action that needs it, once: a retry after a
 * failed action does not attach the same photo twice.
 */
function useAttachOnce(reference: string) {
  const { mutateAsync } = useUploadPhoto(reference);
  const attached = useRef<string | null>(null);
  return async (photo: PreparedPhoto | undefined, kind: 'EVIDENCE' | 'PROGRESS') => {
    if (!photo || attached.current === photo.id) return;
    await mutateAsync({ file: photo.file, kind });
    attached.current = photo.id;
  };
}

/** Resolve: a note, and a photo of the finished work when the organization asks for one. */
export function ResolveSheet({ open, onOpenChange, incident, assignmentId }: SheetProps) {
  const { t, number } = useT();
  const membership = useMembership();
  const action = useIncidentAction();
  const attach = useAttachOnce(incident.reference);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string>();
  const form = useForm<z.input<typeof resolveSchema>, unknown, z.output<typeof resolveSchema>>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { note: '' },
  });
  const note = useWatch({ control: form.control, name: 'note' }) ?? '';
  const busy = form.formState.isSubmitting;

  // A photo of the work added during this assignment already satisfies the rule.
  const assignedAt = incident.liveAssignment?.assignedAt ?? '';
  const onFile = incident.attachments.some(
    (attachment) =>
      attachment.kind === 'EVIDENCE' && attachment.uploadedBy.membershipId === membership.id && attachment.createdAt >= assignedAt,
  );
  const photoRequired = incident.requireResolutionPhoto && !onFile;
  const missingPhoto = () => photoRequired && photos.length === 0;

  const changePhotos: Dispatch<SetStateAction<PreparedPhoto[]>> = (value) => {
    setPhotoError(undefined);
    setPhotos(value);
  };

  const resolve = form.handleSubmit(async (values) => {
    if (missingPhoto()) return;
    try {
      await attach(photos[0], 'EVIDENCE');
      await action.mutateAsync({
        path: `/assignments/${assignmentId}/resolve`,
        body: values,
        success: t('field.actions.resolved'),
      });
    } catch (error) {
      applyServerErrors(form, error);
      return;
    }
    onOpenChange(false);
    form.reset({ note: '' });
    setPhotos([]);
  });

  // Show the photo rule together with any note error, not one after the other.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (missingPhoto()) setPhotoError(t('field.actions.resolvePhotoRequired'));
    void resolve(event);
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      title={t('field.actions.resolveTitle', { reference: incident.reference })}
      description={t('field.actions.resolveDescription')}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t('field.actions.resolve')}
        </Button>
      }
    >
      <Field
        label={t('field.actions.resolveNote')}
        error={form.formState.errors.note?.message}
        aside={t('common.characters', { count: number(note.length), max: number(4000) })}
      >
        <Textarea
          rows={5}
          maxLength={4000}
          className="text-md"
          placeholder={t('field.actions.resolveNotePlaceholder')}
          {...form.register('note')}
        />
      </Field>
      <PhotoPicker
        label={t('field.actions.resolvePhoto')}
        photos={photos}
        onPhotosChange={changePhotos}
        max={1}
        optional={!photoRequired}
        hint={incident.requireResolutionPhoto && onFile ? t('field.actions.resolvePhotoOnFile') : undefined}
        error={photoError}
      />
    </FormSheet>
  );
}

/** A structured progress update: on site, blocked or a plain update, with an optional photo. */
export function ProgressSheet({ open, onOpenChange, incident, assignmentId }: SheetProps) {
  const { t, number } = useT();
  const action = useIncidentAction();
  const attach = useAttachOnce(incident.reference);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const form = useForm<z.input<typeof progressSchema>, unknown, z.output<typeof progressSchema>>({
    resolver: zodResolver(progressSchema),
    defaultValues: { progressType: 'UPDATE', note: '' },
  });
  const type = useWatch({ control: form.control, name: 'progressType' }) ?? 'UPDATE';
  const note = useWatch({ control: form.control, name: 'note' }) ?? '';
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    try {
      await attach(photos[0], 'PROGRESS');
      await action.mutateAsync({
        path: `/assignments/${assignmentId}/progress`,
        body: values,
        success: t('field.actions.updatePosted'),
      });
    } catch (error) {
      applyServerErrors(form, error);
      return;
    }
    onOpenChange(false);
    form.reset({ progressType: 'UPDATE', note: '' });
    setPhotos([]);
  });

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      title={t('field.actions.progressTitle')}
      description={t('field.actions.progressDescription')}
      onSubmit={submit}
      footer={
        <Button type="submit" variant="primary" size="xl" block loading={busy}>
          {t('field.actions.postUpdate')}
        </Button>
      }
    >
      <div className="grid gap-2">
        <p className="text-sm font-medium text-ink">{t('field.actions.progressType')}</p>
        <Controller
          control={form.control}
          name="progressType"
          render={({ field }) => (
            <Segmented<ProgressType>
              label={t('field.actions.progressType')}
              value={field.value}
              onChange={field.onChange}
              options={progressTypes.map((value) => ({ value, label: t(`common.progressType.${value}`) }))}
              className={largeSegments}
            />
          )}
        />
      </div>
      <Field
        label={t('field.actions.progressNote')}
        error={form.formState.errors.note?.message}
        aside={t('common.characters', { count: number(note.length), max: number(2000) })}
      >
        <Textarea
          rows={4}
          maxLength={2000}
          className="text-md"
          placeholder={t(`field.actions.progressPlaceholder.${type}`)}
          {...form.register('note')}
        />
      </Field>
      <PhotoPicker label={t('field.actions.progressPhoto')} photos={photos} onPhotosChange={setPhotos} max={1} />
    </FormSheet>
  );
}
