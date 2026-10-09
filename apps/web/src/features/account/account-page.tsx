import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordSchema,
  passwordSchema,
  updateProfileSchema,
  type Locale,
  type Me,
  type SessionDTO,
} from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { meQueryKey, useSession, useSignOut } from '../../app/session';
import { useTheme, type ThemePreference } from '../../app/theme';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Field, FieldGroup } from '../../components/ui/field';
import { InstallApp } from './install-app';
import { Input } from '../../components/ui/input';
import { Page, PageHeader } from '../../components/ui/layout';
import { Segmented } from '../../components/ui/segmented';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { applyServerErrors, toastError } from '../../lib/forms';
import { PasswordInput } from '../auth/parts';
import { AvailabilityControl } from '../field/availability-control';
import { OrgMark } from '../../app/shells/shared';

function ProfileSection() {
  const { t } = useT();
  const { me } = useSession();
  const queryClient = useQueryClient();
  const user = me?.user;
  const form = useForm<z.input<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    values: user
      ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', locale: user.locale }
      : undefined,
  });
  if (!user) return null;
  const save = form.handleSubmit(async (values) => {
    try {
      const next = await api.patch<Me>('/me/profile', values);
      queryClient.setQueryData(meQueryKey, next);
      toast.success(t('account.profile.saved'));
    } catch (error) {
      if (!applyServerErrors(form, error)) toastError(error, t);
    }
  });
  const errors = form.formState.errors;
  return (
    <FieldGroup title={t('account.profile.title')} description={t('account.profile.description')}>
      <form onSubmit={save} noValidate className="grid gap-4">
        <Field label={t('account.profile.email')} hint={t('account.profile.emailHint')}>
          <Input value={user.email} readOnly disabled />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('account.profile.firstName')} error={errors.firstName?.message}>
            <Input autoComplete="given-name" {...form.register('firstName')} />
          </Field>
          <Field label={t('account.profile.lastName')} error={errors.lastName?.message}>
            <Input autoComplete="family-name" {...form.register('lastName')} />
          </Field>
        </div>
        <Field label={t('account.profile.phone')} optional error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...form.register('phone')} />
        </Field>
        <Field label={t('account.profile.language')}>
          <Controller
            control={form.control}
            name="locale"
            render={({ field }) => (
              <Segmented<Locale>
                label={t('account.profile.language')}
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
        <div>
          <Button
            type="submit"
            variant="primary"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isDirty}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </FieldGroup>
  );
}

function PasswordSection() {
  const { t } = useT();
  const schema = changePasswordSchema
    .extend({ newPassword: passwordSchema, confirm: z.string() })
    .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: t('auth.passwordsDiffer') });
  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const errors = form.formState.errors;
  return (
    <FieldGroup title={t('account.password.title')} description={t('account.password.description')}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await api.post('/auth/password/change', {
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
            });
            form.reset();
            toast.success(t('account.password.changed'));
          } catch (error) {
            if (!applyServerErrors(form, error)) toastError(error, t);
          }
        })}
      >
        <Field label={t('account.password.current')} error={errors.currentPassword?.message}>
          <PasswordInput inputSize="md" autoComplete="current-password" {...form.register('currentPassword')} />
        </Field>
        <Field label={t('account.password.next')} hint={t('auth.passwordHint')} error={errors.newPassword?.message}>
          <PasswordInput inputSize="md" autoComplete="new-password" {...form.register('newPassword')} />
        </Field>
        <Field label={t('account.password.confirm')} error={errors.confirm?.message}>
          <PasswordInput inputSize="md" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <div>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {t('account.password.submit')}
          </Button>
        </div>
      </form>
    </FieldGroup>
  );
}

function deviceName(userAgent: string | null, fallback: string) {
  if (!userAgent) return fallback;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null;
  const os = /iPhone|iPad/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, os].filter(Boolean).join(' on ') || fallback;
}

function SessionsSection() {
  const { t, relative } = useT();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['me', 'sessions'], queryFn: () => api.get<SessionDTO[]>('/me/sessions') });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/me/sessions/${id}`),
    onSuccess: () => {
      toast.success(t('account.sessions.signedOut'));
      void queryClient.invalidateQueries({ queryKey: ['me', 'sessions'] });
    },
    onError: (error) => toastError(error, t),
  });
  return (
    <FieldGroup title={t('account.sessions.title')} description={t('account.sessions.description')}>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {(sessions.data ?? []).map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {deviceName(session.userAgent, t('account.sessions.unknown'))}
                {session.current && <Badge tone="accent">{t('account.sessions.thisDevice')}</Badge>}
              </p>
              <p className="text-xs text-ink-3">
                {t('account.sessions.lastActive', { time: relative(session.lastSeenAt) })}
              </p>
            </div>
            {!session.current && (
              <Button
                size="sm"
                onClick={() => revoke.mutate(session.id)}
                loading={revoke.isPending && revoke.variables === session.id}
              >
                {t('account.sessions.signOut')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </FieldGroup>
  );
}

function OrganizationsSection() {
  const { t } = useT();
  const { me, membership, switchOrganization } = useSession();
  const navigate = useNavigate();
  if (!me || me.memberships.length < 2) return null;
  return (
    <FieldGroup title={t('account.organizations.title')} description={t('account.organizations.description')}>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {me.memberships.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <OrgMark name={m.organization.displayName} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{m.organization.displayName}</span>
                <span className="block text-xs text-ink-3">
                  {t(m.isOwner ? 'common.role.OWNER' : `common.role.${m.role}`)}
                </span>
              </span>
            </span>
            {m.organization.id === membership?.organization.id ? (
              <Badge>{t('account.organizations.current')}</Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  switchOrganization(m.organization.id);
                  void navigate({ to: '/' });
                }}
              >
                {t('account.organizations.switch')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </FieldGroup>
  );
}

export function AccountPage() {
  const { t } = useT();
  const { me, membership } = useSession();
  const signOutHere = useSignOut();
  const [theme, setTheme] = useTheme();
  const intervenant = membership?.role === 'INTERVENANT' && !me?.platformAdmin;
  const inConsole = membership?.role === 'SUPERVISOR' || !!me?.platformAdmin;

  const body = (
    <>
      <ProfileSection />
      <FieldGroup title={t('account.appearance.title')} description={t('account.appearance.description')}>
        <Segmented<ThemePreference>
          label={t('common.theme.label')}
          value={theme}
          onChange={setTheme}
          options={(['light', 'dark', 'system'] as const).map((value) => ({
            value,
            label: t(`common.theme.${value}`),
          }))}
        />
      </FieldGroup>
      {intervenant && (
        <FieldGroup title={t('account.availability.title')} description={t('account.availability.description')}>
          <AvailabilityControl />
        </FieldGroup>
      )}
      <InstallApp />
      <OrganizationsSection />
      <PasswordSection />
      <SessionsSection />
      {!inConsole && (
        <Button size="lg" block className="mt-4" onClick={() => void signOutHere()}>
          {t('account.signOut')}
        </Button>
      )}
    </>
  );

  if (!inConsole) {
    return (
      <div>
        <h1 className="mb-5 text-xl font-semibold text-ink">{t('shell.nav.profile')}</h1>
        {body}
      </div>
    );
  }
  return (
    <Page width="narrow">
      <PageHeader title={t('account.title')} description={t('account.description')} />
      {body}
    </Page>
  );
}
