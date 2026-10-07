import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput, type Me } from '@sentinel/shared';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { homePath, useSession } from '../../app/session';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/forms';
import { AuthCard, PasswordInput } from './parts';

/** Only same-app paths are accepted as a post-login destination. */
function safeRedirect(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

export function LoginPage() {
  const { t } = useT();
  const search = useSearch({ from: '/public/login' });
  const navigate = useNavigate();
  const { signedIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: search.email ?? '', password: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const me = await api.post<Me>('/auth/login', values);
      await signedIn(me);
      const target = me.platformAdmin ? homePath(me, null) : (safeRedirect(search.redirect) ?? '/');
      await navigate({ to: target, replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'INVALID_CREDENTIALS') setError(t('auth.login.invalid'));
      else if (cause instanceof ApiError && cause.code === 'ACCOUNT_LOCKED') setError(t('auth.login.locked'));
      else setError(errorMessage(cause, t));
    }
  });

  return (
    <AuthCard
      title={t('auth.login.title')}
      description={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-medium text-ink hover:underline">
            {t('auth.login.register')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Banner tone="critical">{error}</Banner>}
        <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="username" inputSize="lg" autoFocus {...form.register('email')} />
        </Field>
        <Field
          label={t('auth.password')}
          error={form.formState.errors.password?.message}
          aside={
            <Link to="/forgot-password" className="text-xs font-medium text-ink-2 hover:text-ink hover:underline">
              {t('auth.login.forgot')}
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.formState.isSubmitting} className="mt-2">
          {t('auth.login.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
