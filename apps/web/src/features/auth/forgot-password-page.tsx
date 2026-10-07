import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { AuthCard, AuthStatus } from './parts';

export function ForgotPasswordPage() {
  const { t } = useT();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  if (sentTo) {
    return (
      <AuthStatus icon={<MailCheck />} title={t('auth.forgot.sentTitle')}>
        <p>{t('auth.forgot.sentBody', { email: sentTo })}</p>
        <Link to="/login" className="font-medium text-ink hover:underline">
          {t('auth.forgot.backToLogin')}
        </Link>
      </AuthStatus>
    );
  }

  return (
    <AuthCard
      title={t('auth.forgot.title')}
      description={t('auth.forgot.subtitle')}
      footer={
        <Link to="/login" className="font-medium text-ink hover:underline">
          {t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await api.post('/auth/password/forgot', values);
            setSentTo(values.email);
          } catch (error) {
            toastError(error, t);
          }
        })}
      >
        <Field label={t('auth.email')} error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputSize="lg" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.formState.isSubmitting}>
          {t('auth.forgot.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
