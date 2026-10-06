import { zodResolver } from '@hookform/resolvers/zod';
import { totpSchema, type Me } from '@sentinel/shared';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useSession } from '../../app/session';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/forms';
import { AuthCard } from './parts';

export function MfaPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { me, signedIn, signOut } = useSession();
  const form = useForm<z.input<typeof totpSchema>>({ resolver: zodResolver(totpSchema), defaultValues: { code: '' } });

  if (!me) return <Navigate to="/login" replace />;
  if (!me.platformAdmin || me.platformAdmin.mfaVerified) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      const next = await api.post<Me>('/auth/totp', values);
      signedIn(next);
      await navigate({ to: '/platform', replace: true });
    } catch (cause) {
      form.setError('code', {
        message: cause instanceof ApiError && cause.code === 'VALIDATION_FAILED' ? t('auth.mfa.invalid') : errorMessage(cause, t),
      });
    }
  });

  return (
    <AuthCard
      title={t('auth.mfa.title')}
      description={t('auth.mfa.subtitle')}
      footer={
        <button
          type="button"
          className="font-medium text-ink hover:underline"
          onClick={async () => {
            await signOut();
            void navigate({ to: '/login' });
          }}
        >
          {t('auth.mfa.signOut')}
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <Field label={t('auth.mfa.code')} error={form.formState.errors.code?.message}>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            inputSize="lg"
            className="text-center text-xl tracking-[0.5em] tabular-nums"
            {...form.register('code')}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.formState.isSubmitting}>
          {t('auth.mfa.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
