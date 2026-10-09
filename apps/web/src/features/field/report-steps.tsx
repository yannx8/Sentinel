import type { createIncidentSchema } from '@sentinel/shared';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Banner, Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input, Textarea } from '../../components/ui/input';
import { useT } from '../../i18n';
import { ChoiceList, type Choice } from './choice-list';
import { LocationControl, type GeoFix } from './location-control';
import { PhotoPicker } from './photo-picker';
import type { PreparedPhoto } from './photos';
import { useActiveCategories, useActiveSites, useLastReportedSite, useMembershipSelf } from './queries';

export type ReportInput = z.input<typeof createIncidentSchema>;
export type ReportOutput = z.output<typeof createIncidentSchema>;
type ReportForm = UseFormReturn<ReportInput, unknown, ReportOutput>;

export const DESCRIPTION_MAX = 4000;

/** Placeholder rows while a choice list loads. */
function ChoiceSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex min-h-14 items-center justify-between px-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="size-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListProblem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <Banner
      tone={onRetry ? 'critical' : 'warning'}
      action={
        onRetry && (
          <Button size="lg" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    >
      {message}
    </Banner>
  );
}

/** Photo first, then category, then optional words. */
export function WhatSection({
  form,
  photos,
  onPhotosChange,
}: {
  form: ReportForm;
  photos: PreparedPhoto[];
  onPhotosChange: Dispatch<SetStateAction<PreparedPhoto[]>>;
}) {
  const { t, number } = useT();
  const categories = useActiveCategories();
  const description = useWatch({ control: form.control, name: 'description' }) ?? '';
  const { errors } = form.formState;
  const label = t('field.report.categoryLabel');

  return (
    <div className="grid gap-6">
      <PhotoPicker
        label={t('field.report.photosLabel')}
        hint={t('field.report.photosHint')}
        photos={photos}
        onPhotosChange={onPhotosChange}
        max={3}
      />
      <Controller
        control={form.control}
        name="categoryId"
        render={({ field, fieldState }) =>
          categories.isPending ? (
            <ChoiceSkeleton label={label} />
          ) : categories.isError ? (
            <ListProblem message={t('field.report.loadError')} onRetry={() => void categories.refetch()} />
          ) : categories.data.length === 0 ? (
            <ListProblem message={t('field.report.noCategories')} />
          ) : (
            <ChoiceList
              name={field.name}
              label={label}
              options={categories.data.map((category) => ({ value: category.id, label: category.name }))}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              searchLabel={t('field.report.searchCategories')}
              error={
                fieldState.error
                  ? fieldState.error.type === 'server'
                    ? fieldState.error.message
                    : t('field.report.chooseCategory')
                  : undefined
              }
            />
          )
        }
      />
      <Field label={t('field.report.titleLabel')} optional error={errors.title?.message}>
        <Input
          inputSize="lg"
          maxLength={120}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={t('field.report.titlePlaceholder')}
          {...form.register('title')}
        />
      </Field>
      <Field
        label={t('field.report.descriptionLabel')}
        optional
        error={errors.description?.message}
        aside={t('common.characters', { count: number(description.length), max: number(DESCRIPTION_MAX) })}
      >
        <Textarea
          rows={5}
          maxLength={DESCRIPTION_MAX}
          className="text-md"
          placeholder={t('field.report.descriptionPlaceholder')}
          {...form.register('description')}
        />
      </Field>
    </div>
  );
}

/** Site, written location and optional position. */
export function WhereSection({
  form,
  fix,
  onFixChange,
}: {
  form: ReportForm;
  fix: GeoFix | null;
  onFixChange: (fix: GeoFix | null) => void;
}) {
  const { t } = useT();
  const sites = useActiveSites();
  const self = useMembershipSelf();
  const homeSite = self.data?.homeSite ?? null;
  const last = useLastReportedSite(!self.isPending && !homeSite);
  const { errors } = form.formState;
  const label = t('field.report.siteLabel');

  const preferred = homeSite
    ? { id: homeSite.id, tag: t('field.report.homeSite') }
    : last.data
      ? { id: last.data.id, tag: t('field.report.lastUsed') }
      : null;

  const list: Choice[] = (sites.data ?? []).map((site) => ({
    value: site.id,
    label: site.name,
    description: [site.address, site.city].filter(Boolean).join(', ') || undefined,
    tag: site.id === preferred?.id ? preferred.tag : undefined,
  }));
  // The employee's own or last used site comes first.
  const options = preferred
    ? [
        ...list.filter((option) => option.value === preferred.id),
        ...list.filter((option) => option.value !== preferred.id),
      ]
    : list;

  // One site: nothing to choose.
  const only = sites.data?.length === 1 ? sites.data[0] : undefined;
  useEffect(() => {
    if (only && !form.getValues('siteId')) form.setValue('siteId', only.id);
  }, [only, form]);

  return (
    <div className="grid gap-6">
      <Controller
        control={form.control}
        name="siteId"
        render={({ field, fieldState }) =>
          sites.isPending ? (
            <ChoiceSkeleton label={label} />
          ) : sites.isError ? (
            <ListProblem message={t('field.report.loadError')} onRetry={() => void sites.refetch()} />
          ) : options.length === 0 ? (
            <ListProblem message={t('field.report.noSites')} />
          ) : (
            <ChoiceList
              name={field.name}
              label={label}
              options={options}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              inputRef={field.ref}
              searchLabel={t('field.report.searchSites')}
              error={
                fieldState.error
                  ? fieldState.error.type === 'server'
                    ? fieldState.error.message
                    : t('field.report.chooseSite')
                  : undefined
              }
            />
          )
        }
      />
      <Field
        label={t('field.report.locationDetailLabel')}
        optional
        hint={t('field.report.locationDetailHint')}
        error={errors.locationDetail?.message}
      >
        <Input
          inputSize="lg"
          maxLength={200}
          autoComplete="off"
          placeholder={t('field.report.locationDetailPlaceholder')}
          {...form.register('locationDetail')}
        />
      </Field>
      <LocationControl fix={fix} onChange={onFixChange} />
    </div>
  );
}
