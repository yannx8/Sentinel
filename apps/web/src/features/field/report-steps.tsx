import type { createIncidentSchema } from '@sentinel/shared';
import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';
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

/** Step 1: title, description, category and optional photos. */
export function StepWhat({
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
      <Field label={t('field.report.titleLabel')} error={errors.title?.message}>
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
      <PhotoPicker
        label={t('field.report.photosLabel')}
        hint={t('field.report.photosHint')}
        photos={photos}
        onPhotosChange={onPhotosChange}
        max={3}
      />
    </div>
  );
}

/** Step 2: site, written location and optional position. */
export function StepWhere({
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
    ? [...list.filter((option) => option.value === preferred.id), ...list.filter((option) => option.value !== preferred.id)]
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

function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Button variant="ghost" size="lg" className="-mr-2 h-11" aria-label={editLabel} onClick={onEdit}>
          {t('field.report.edit')}
        </Button>
      </div>
      <dl className="mt-1 divide-y divide-line border-y border-line">{children}</dl>
    </section>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-md break-words text-ink">{children}</dd>
    </div>
  );
}

/** Step 3: everything on one screen, each part one tap away from editing. */
export function StepReview({
  values,
  photos,
  fix,
  onEdit,
}: {
  values: ReportInput;
  photos: PreparedPhoto[];
  fix: GeoFix | null;
  onEdit: (step: number) => void;
}) {
  const { t, number } = useT();
  const categories = useActiveCategories();
  const sites = useActiveSites();
  const category = categories.data?.find((item) => item.id === values.categoryId);
  const site = sites.data?.find((item) => item.id === values.siteId);
  const notGiven = <span className="text-ink-3">{t('field.report.notGiven')}</span>;

  return (
    <div className="grid gap-8">
      <ReviewSection title={t('field.report.reviewWhat')} editLabel={t('field.report.editWhat')} onEdit={() => onEdit(0)}>
        <ReviewRow label={t('field.report.titleLabel')}>{values.title}</ReviewRow>
        <ReviewRow label={t('field.report.descriptionLabel')}>
          <span className="line-clamp-6 whitespace-pre-line">{values.description}</span>
        </ReviewRow>
        <ReviewRow label={t('field.report.categoryLabel')}>{category?.name ?? notGiven}</ReviewRow>
        <ReviewRow label={t('field.report.photosLabel')}>
          {photos.length > 0 ? (
            <span className="mt-1 flex gap-2">
              {photos.map((photo, index) => (
                <img
                  key={photo.id}
                  src={photo.preview}
                  alt={t('field.photos.alt', { index: index + 1 })}
                  className="size-16 rounded-md border border-line object-cover"
                />
              ))}
            </span>
          ) : (
            <span className="text-ink-3">{t('field.report.noPhotos')}</span>
          )}
        </ReviewRow>
      </ReviewSection>
      <ReviewSection title={t('field.report.reviewWhere')} editLabel={t('field.report.editWhere')} onEdit={() => onEdit(1)}>
        <ReviewRow label={t('field.report.siteLabel')}>{site?.name ?? notGiven}</ReviewRow>
        <ReviewRow label={t('field.report.locationDetailLabel')}>{values.locationDetail?.trim() || notGiven}</ReviewRow>
        <ReviewRow label={t('field.report.positionLabel')}>
          {fix ? t('field.report.positionValue', { meters: number(fix.accuracy) }) : notGiven}
        </ReviewRow>
      </ReviewSection>
    </div>
  );
}
