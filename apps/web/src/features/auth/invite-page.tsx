import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, type InvitationPreview, type Me } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Clock, Link2Off } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { OrgMark } from '../../app/shells/shared';
import { useSession } from '../../app/session';
import { Button, buttonClass } from '../../components/ui/button';
import { Banner, Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { applyServerErrors, toastError } from '../../lib/forms';
import { AuthCard, AuthStatus, PasswordInput } from './parts';

const newAccountSchema = z.object({
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+\d][\d\s().-]{5,}$/)
    .optional()
    .or(z.literal('')),
});

export function InvitePage() {
  const { t } = useT();
  const { token } = useParams({ from: '/public/invite/$token' });
  const { me, signedIn, signOut } = useSession();
  const navigate = useNavigate();
  const preview = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<InvitationPreview>(`/public/invitations/${encodeURIComponent(token)}`),
    retry: false,
  });
  const form = useForm<z.input<typeof newAccountSchema>>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { password: '', phone: '' },
  });

  const accept = async (body: { password?: string; phone?: string }) => {
    const invitation = preview.data;
    if (!invitation) return;
    try {
      const next = await api.post<Me>(`/public/invitations/${encodeURIComponent(token)}/accept`, body);
      await signedIn(next);
      toast.success(t('auth.invite.joined', { organization: invitation.organization }));
      const joined = next.memberships.find((m) => m.organization.displayName === invitation.organization);
      if (joined) {
        try {
          localStorage.setItem('sentinel.org', joined.organization.id);
        } catch {
          // storage unavailable
        }
      }
      await navigate({ to: '/', replace: true });
    } catch (error) {
      if (!applyServerErrors(form, error)) toastError(error, t);
    }
  };

  if (preview.isPending) {
    return (
      <AuthCard title={<Skeleton className="h-7 w-56" />} description={t('auth.invite.loading')}>
        <Skeleton className="h-24 w-full" />
      </AuthCard>
    );
  }
  if (preview.error) {
    const expired = preview.error instanceof ApiError && preview.error.code === 'TOKEN_EXPIRED';
    return (
      <AuthStatus
        icon={expired ? <Clock /> : <Link2Off />}
        title={t(expired ? 'auth.invite.expiredTitle' : 'auth.invite.invalidTitle')}
      >
        <p>{t(expired ? 'auth.invite.expiredBody' : 'auth.invite.invalidBody')}</p>
      </AuthStatus>
    );
  }

  const invitation = preview.data;
  const role = t(`common.role.${invitation.role}`).toLowerCase();
  const name = `${invitation.firstName} ${invitation.lastName}`;
  const signedInAsInvitee = me?.user.email === invitation.email;

  return (
    <AuthCard
      title={
        <span className="flex items-center gap-3">
          <OrgMark name={invitation.organization} className="size-8 text-sm" />
          {t('auth.invite.title', { organization: invitation.organization })}
        </span>
      }
      description={t('auth.invite.subtitle', {
        name: invitation.firstName,
        organization: invitation.organization,
        role,
      })}
    >
      <p className="mb-5 rounded-md bg-subtle px-3.5 py-3 text-sm text-ink-2">
        {t(`auth.invite.roleIntro.${invitation.role}`)}
      </p>

      {invitation.existingAccount ? (
        signedInAsInvitee ? (
          <Button variant="primary" size="lg" block onClick={() => accept({})}>
            {t('auth.invite.accept', { organization: invitation.organization })}
          </Button>
        ) : me ? (
          <div className="grid gap-3">
            <Banner tone="warning">
              {t('auth.invite.wrongAccount', { current: me.user.email, email: invitation.email })}
            </Banner>
            <Button
              block
              onClick={async () => {
                await signOut();
              }}
            >
              {t('auth.invite.signOut')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-ink-2">{t('auth.invite.existingAccount', { email: invitation.email })}</p>
            <Link
              to="/login"
              search={{ redirect: `/invite/${token}`, email: invitation.email }}
              className={buttonClass({ variant: 'primary', size: 'lg', block: true })}
            >
              {t('auth.invite.signInToAccept')}
            </Link>
          </div>
        )
      ) : (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) =>
            accept({ password: values.password, phone: values.phone || undefined }),
          )}
        >
          <Field label={t('auth.email')}>
            <Input value={invitation.email} readOnly disabled inputSize="lg" aria-label={name} />
          </Field>
          <Field
            label={t('auth.password')}
            hint={t('auth.invite.choosePassword')}
            error={form.formState.errors.password?.message}
          >
            <PasswordInput autoComplete="new-password" autoFocus {...form.register('password')} />
          </Field>
          <Field
            label={t('auth.invite.phone')}
            optional
            hint={t('auth.invite.phoneHint')}
            error={form.formState.errors.phone?.message}
          >
            <Input type="tel" autoComplete="tel" inputSize="lg" {...form.register('phone')} />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={form.formState.isSubmitting}>
            {t('auth.invite.accept', { organization: invitation.organization })}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
