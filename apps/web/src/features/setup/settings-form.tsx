import { zodResolver } from '@hookform/resolvers/zod';
import { updateOrganizationSchema, type Locale, type OrganizationSettings } from '@sentinel/shared';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { SwitchRow } from '../../components/ui/checkbox';
import { Banner } from '../../components/ui/feedback';
import { Field, FieldGroup } from '../../components/ui/field';
import { Input, NativeSelect } from '../../components/ui/input';
import { Segmented } from '../../components/ui/segmented';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { timeZoneOptions } from '../../lib/regions';
import { showSaveError } from './parts';
import { useSaveSettings } from './queries';
import { LeaveGuard, PlanSummary, SaveBar } from './settings-parts';

type SettingsInput = z.input<typeof updateOrganizationSchema>;
type SettingsOutput = z.output<typeof updateOrganizationSchema>;

function valuesOf(settings: OrganizationSettings): SettingsInput {
  return {
    displayName: settings.displayName,
    legalName: settings.legalName,
    registrationNumber: settings.registrationNumber ?? '',
    timezone: settings.timezone,
    defaultLocale: settings.defaultLocale,
    billingEmail: settings.billingEmail,
    website: settings.website ?? '',
    requireResolutionPhoto: settings.requireResolutionPhoto,
    showReporterPhone: settings.showReporterPhone,
  };
}

/** The browser list can miss the stored zone (some engines leave out UTC). Keep it selectable. */
function zonesWith(current: string) {
  const zones = timeZoneOptions();
  return zones.some((zone) => zone.value === current)
    ? zones
    : [{ value: current, label: current.replace(/_/g, ' ') }, ...zones];
}

/**
 * Organization settings. Only the owner can save (the API refuses others), so
 * for other supervisors every control is disabled and a banner names the owner.
 */
export function SettingsForm({
  settings,
  canEdit,
  ownerName,
}: {
  settings: OrganizationSettings;
  canEdit: boolean;
  ownerName: string | null;
}) {
  const { t } = useT();
  const save = useSaveSettings();
  const form = useForm<SettingsInput, unknown, SettingsOutput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: valuesOf(settings),
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const dirty = canEdit && isDirty;
  const zones = useMemo(() => zonesWith(settings.timezone), [settings.timezone]);
  const languages: { value: Locale; label: string }[] = [
    { value: 'en', label: t('common.language.en') },
    { value: 'fr', label: t('common.language.fr') },
  ];

  const submit = form.handleSubmit(async (values) => {
    // Enter in a field submits too; with nothing changed there is nothing to save.
    if (!form.formState.isDirty) return;
    try {
      const saved = await save.mutateAsync(values);
      form.reset(valuesOf(saved));
      toast.success(t('setup.settings.saved'));
    } catch (error) {
      showSaveError(form, error, t);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      {!canEdit && (
        <Banner className="mb-8">
          {ownerName ? t('setup.settings.ownerOnly', { name: ownerName }) : t('setup.settings.ownerOnlyAnonymous')}
        </Banner>
      )}

      <fieldset disabled={!canEdit} className="m-0 min-w-0 border-0 p-0">
        <FieldGroup title={t('setup.settings.profile.title')} description={t('setup.settings.profile.description')}>
          <Field
            label={t('setup.settings.profile.displayName')}
            hint={t('setup.settings.profile.displayNameHint')}
            error={errors.displayName?.message}
          >
            <Input autoComplete="off" maxLength={80} {...form.register('displayName')} />
          </Field>
          <Field label={t('setup.settings.profile.legalName')} error={errors.legalName?.message}>
            <Input autoComplete="off" maxLength={160} {...form.register('legalName')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('setup.settings.profile.registrationNumber')}
              optional
              hint={t('setup.settings.profile.registrationNumberHint')}
              error={errors.registrationNumber?.message}
            >
              <Input autoComplete="off" maxLength={40} {...form.register('registrationNumber')} />
            </Field>
            <Field label={t('setup.settings.profile.website')} optional error={errors.website?.message}>
              <Input
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                maxLength={200}
                {...form.register('website')}
              />
            </Field>
          </div>
          <Field
            label={t('setup.settings.profile.billingEmail')}
            hint={t('setup.settings.profile.billingEmailHint')}
            error={errors.billingEmail?.message}
          >
            <Input type="email" autoComplete="off" maxLength={254} {...form.register('billingEmail')} />
          </Field>
        </FieldGroup>

        <FieldGroup title={t('setup.settings.regional.title')} description={t('setup.settings.regional.description')}>
          <Controller
            control={form.control}
            name="defaultLocale"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium text-ink" aria-hidden>
                  {t('setup.settings.regional.language')}
                </span>
                <Segmented<Locale>
                  label={t('setup.settings.regional.language')}
                  value={field.value}
                  onChange={field.onChange}
                  options={languages}
                  className="justify-self-start"
                />
                <p className="text-xs text-ink-3">{t('setup.settings.regional.languageHint')}</p>
              </div>
            )}
          />
          <Field
            label={t('setup.settings.regional.timezone')}
            hint={t('setup.settings.regional.timezoneHint')}
            error={errors.timezone?.message}
          >
            <NativeSelect options={zones} {...form.register('timezone')} />
          </Field>
        </FieldGroup>

        <FieldGroup title={t('setup.settings.rules.title')} description={t('setup.settings.rules.description')}>
          <Controller
            control={form.control}
            name="requireResolutionPhoto"
            render={({ field }) => (
              <SwitchRow
                label={t('setup.settings.rules.requirePhoto')}
                description={t('setup.settings.rules.requirePhotoHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!canEdit}
              />
            )}
          />
          <Controller
            control={form.control}
            name="showReporterPhone"
            render={({ field }) => (
              <SwitchRow
                label={t('setup.settings.rules.showPhone')}
                description={t('setup.settings.rules.showPhoneHint')}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={!canEdit}
              />
            )}
          />
        </FieldGroup>

        <FieldGroup title={t('setup.settings.plan.title')} description={t('setup.settings.plan.description')}>
          <PlanSummary settings={settings} />
        </FieldGroup>
      </fieldset>

      {dirty && <SaveBar saving={isSubmitting} onDiscard={() => form.reset()} />}
      <p role="status" className="sr-only">
        {dirty ? t('setup.settings.saveBar.unsaved') : ''}
      </p>
      {canEdit && <LeaveGuard when={dirty} />}
    </form>
  );
}
