import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@sentinel/shared';
import { Link, useSearch } from '@tanstack/react-router';
import { CircleCheck, Link2Off } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, buttonClass } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { AuthCard, AuthStatus, PasswordInput } from './parts';

export function ResetPasswordPage() {
  const { t } = useT();
  const { token } = useSearch({ from: '/public/reset-password' });
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid');
  const schema = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: t('auth.passwordsDiffer') });
  const form = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  if (state === 'done') {
    return (
      <AuthStatus icon={<CircleCheck />} title={t('auth.reset.doneTitle')}>
        <p>{t('auth.reset.doneBody')}</p>
        <Link to="/login" className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
          {t('auth.login.submit')}
        </Link>
      </AuthStatus>
    );
  }
  if (state === 'invalid') {
    return (
      <AuthStatus icon={<Link2Off />} title={t('auth.reset.invalidTitle')}>
        <p>{t('auth.reset.invalidBody')}</p>
        <Link to="/forgot-password" className="font-medium text-ink hover:underline">
          {t('auth.reset.requestNew')}
        </Link>
      </AuthStatus>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')} description={t('auth.reset.subtitle')}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await api.post('/auth/password/reset', { token, password: values.password });
            setState('done');
          } catch (error) {
            if (error instanceof ApiError && (error.code === 'TOKEN_INVALID' || error.code === 'TOKEN_EXPIRED'))
              setState('invalid');
            else toastError(error, t);
          }
        })}
      >
        <Field
          label={t('auth.newPassword')}
          hint={t('auth.passwordHint')}
          error={form.formState.errors.password?.message}
        >
          <PasswordInput autoComplete="new-password" autoFocus {...form.register('password')} />
        </Field>
        <Field label={t('auth.confirmPassword')} error={form.formState.errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.formState.isSubmitting}>
          {t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
