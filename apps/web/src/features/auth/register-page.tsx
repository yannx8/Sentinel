import { zodResolver } from '@hookform/resolvers/zod';
import { industries, registerOrganizationSchema, sizeBands, type Locale } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { CheckboxField } from '../../components/ui/checkbox';
import { Banner } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input, NativeSelect } from '../../components/ui/input';
import { Segmented } from '../../components/ui/segmented';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { applyServerErrors, errorMessage } from '../../lib/forms';
import { browserCountry, browserTimeZone, countryOptions, timeZoneOptions } from '../../lib/regions';
import { AuthCard, AuthStatus, PasswordInput, Stepper } from './parts';

type FormInput = z.input<typeof registerOrganizationSchema>;
type Sent = { email: string; company: string; previewUrl?: string };

const stepFields: FieldPath<FormInput>[][] = [
  [
    'company.legalName',
    'company.displayName',
    'company.registrationNumber',
    'company.industry',
    'company.sizeBand',
    'company.country',
    'company.city',
    'company.timezone',
    'company.defaultLocale',
    'company.website',
  ],
  ['contact.firstName', 'contact.lastName', 'contact.email', 'contact.phone', 'contact.password'],
  ['acceptTerms'],
];

function Summary({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-3">{label}</dt>
          <dd className="truncate text-ink">{value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RegisterPage() {
  const { t, locale } = useT();
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(registerOrganizationSchema),
    mode: 'onTouched',
    defaultValues: {
      company: {
        legalName: '',
        displayName: '',
        registrationNumber: '',
        industry: 'FACILITIES',
        sizeBand: 'S',
        country: browserCountry(),
        city: '',
        timezone: browserTimeZone(),
        defaultLocale: locale,
        website: '',
      },
      contact: { firstName: '', lastName: '', email: '', phone: '', password: '' },
      acceptTerms: false as unknown as true,
    },
  });
  const errors = form.formState.errors;
  const values = form.watch();

  const steps = [t('auth.register.steps.company'), t('auth.register.steps.contact'), t('auth.register.steps.review')];

  const next = async () => {
    const fields = stepFields[step] ?? [];
    if (await form.trigger(fields, { shouldFocus: true })) setStep((s) => s + 1);
  };

  const submit = form.handleSubmit(async (input) => {
    setError(null);
    try {
      const result = await api.post<{ email: string; previewUrl?: string }>('/public/organizations', input);
      setSent({ email: result.email, company: input.company.displayName, previewUrl: result.previewUrl });
    } catch (cause) {
      if (applyServerErrors(form, cause)) {
        const failing = Object.keys(form.formState.errors);
        setStep(failing.some((key) => key.startsWith('company')) ? 0 : failing.some((key) => key.startsWith('contact')) ? 1 : 2);
      }
      setError(errorMessage(cause, t));
    }
  });

  if (sent) {
    return (
      <AuthStatus icon={<MailCheck />} title={t('auth.register.sentTitle')}>
        <p>{t('auth.register.sentBody', { email: sent.email, company: sent.company })}</p>
        <div className="grid gap-2">
          <Button
            onClick={async () => {
              try {
                const result = await api.post<{ previewUrl?: string }>('/public/organizations/resend', { email: sent.email });
                setSent({ ...sent, previewUrl: result.previewUrl ?? sent.previewUrl });
                toast.success(t('auth.register.resent'));
              } catch (cause) {
                toast.error(errorMessage(cause, t));
              }
            }}
          >
            {t('auth.register.resend')}
          </Button>
          <button type="button" className="text-sm text-ink-3 hover:text-ink" onClick={() => setSent(null)}>
            {t('auth.register.wrongEmail')}
          </button>
        </div>
        {sent.previewUrl && (
          <a href={sent.previewUrl} className="rounded-md border border-dashed border-line-strong px-3 py-2 text-xs text-ink-2 hover:text-ink">
            {t('auth.register.previewLink')}
          </a>
        )}
      </AuthStatus>
    );
  }

  const industryOptions = industries.map((value) => ({ value, label: t(`common.industry.${value}`) }));
  const sizeOptions = sizeBands.map((value) => ({ value, label: t(`common.sizeBand.${value}`) }));
  const countries = countryOptions(locale);

  return (
    <AuthCard
      width="md"
      title={t('auth.register.title')}
      description={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="font-medium text-ink hover:underline">
            {t('auth.register.signIn')}
          </Link>
        </>
      }
    >
      <Stepper steps={steps} current={step} />
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
        {error && <Banner tone="critical">{error}</Banner>}

        {step === 0 && (
          <>
            <Field label={t('auth.register.legalName')} error={errors.company?.legalName?.message}>
              <Input autoComplete="organization" autoFocus {...form.register('company.legalName')} />
            </Field>
            <Field label={t('auth.register.displayName')} hint={t('auth.register.displayNameHint')} error={errors.company?.displayName?.message}>
              <Input {...form.register('company.displayName')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('auth.register.industry')} error={errors.company?.industry?.message}>
                <NativeSelect options={industryOptions} {...form.register('company.industry')} />
              </Field>
              <Field label={t('auth.register.sizeBand')} error={errors.company?.sizeBand?.message}>
                <NativeSelect options={sizeOptions} {...form.register('company.sizeBand')} />
              </Field>
              <Field label={t('auth.register.country')} error={errors.company?.country?.message}>
                <NativeSelect options={countries} autoComplete="country" {...form.register('company.country')} />
              </Field>
              <Field label={t('auth.register.city')} optional error={errors.company?.city?.message}>
                <Input autoComplete="address-level2" {...form.register('company.city')} />
              </Field>
            </div>
            <Field label={t('auth.register.timezone')} hint={t('auth.register.timezoneHint')} error={errors.company?.timezone?.message}>
              <NativeSelect options={timeZoneOptions()} {...form.register('company.timezone')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('auth.register.registrationNumber')}
                optional
                hint={t('auth.register.registrationHint')}
                error={errors.company?.registrationNumber?.message}
              >
                <Input {...form.register('company.registrationNumber')} />
              </Field>
              <Field label={t('auth.register.website')} optional error={errors.company?.website?.message}>
                <Input type="url" placeholder="https://" {...form.register('company.website')} />
              </Field>
            </div>
            <Field label={t('auth.register.defaultLocale')}>
              <Controller
                control={form.control}
                name="company.defaultLocale"
                render={({ field }) => (
                  <Segmented<Locale>
                    label={t('auth.register.defaultLocale')}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'en', label: t('common.language.en') },
                      { value: 'fr', label: t('common.language.fr') },
                    ]}
                  />
                )}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Banner tone="info">{t('auth.register.contactHint')}</Banner>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('auth.register.firstName')} error={errors.contact?.firstName?.message}>
                <Input autoComplete="given-name" autoFocus {...form.register('contact.firstName')} />
              </Field>
              <Field label={t('auth.register.lastName')} error={errors.contact?.lastName?.message}>
                <Input autoComplete="family-name" {...form.register('contact.lastName')} />
              </Field>
            </div>
            <Field label={t('auth.email')} error={errors.contact?.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('contact.email')} />
            </Field>
            <Field label={t('auth.register.phone')} optional error={errors.contact?.phone?.message}>
              <Input type="tel" autoComplete="tel" {...form.register('contact.phone')} />
            </Field>
            <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={errors.contact?.password?.message}>
              <PasswordInput autoComplete="new-password" inputSize="md" {...form.register('contact.password')} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <section className="rounded-md border border-line p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">{t('auth.register.reviewCompany')}</h2>
              <Summary
                rows={[
                  [t('auth.register.legalName'), values.company.legalName],
                  [t('auth.register.displayName'), values.company.displayName],
                  [t('auth.register.industry'), t(`common.industry.${values.company.industry}`)],
                  [t('auth.register.sizeBand'), t(`common.sizeBand.${values.company.sizeBand}`)],
                  [t('auth.register.country'), countries.find((c) => c.value === values.company.country)?.label],
                  [t('auth.register.timezone'), values.company.timezone],
                ]}
              />
            </section>
            <section className="rounded-md border border-line p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">{t('auth.register.reviewContact')}</h2>
              <Summary
                rows={[
                  [t('auth.register.firstName'), `${values.contact.firstName} ${values.contact.lastName}`],
                  [t('auth.email'), values.contact.email],
                  [t('auth.register.phone'), values.contact.phone],
                ]}
              />
            </section>
            <Controller
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <div className="grid gap-1.5">
                  <CheckboxField
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked)}
                    label={t('auth.register.terms', { company: values.company.legalName || values.company.displayName })}
                  />
                  {errors.acceptTerms && <p className="text-xs text-critical-ink">{t('auth.register.termsRequired')}</p>}
                </div>
              )}
            />
            <p className="text-xs text-ink-3">{t('auth.register.trial')}</p>
          </>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              {t('common.back')}
            </Button>
          ) : (
            <span className="text-xs text-ink-3">{t('auth.register.stepOf', { current: step + 1, total: steps.length })}</span>
          )}
          {step < 2 ? (
            <Button variant="primary" onClick={next}>
              {t('common.continue')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {t('auth.register.submit')}
            </Button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}
