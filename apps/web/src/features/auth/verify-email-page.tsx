import type { Me } from '@sentinel/shared';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { CircleCheck, Clock, Link2Off } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '../../app/session';
import { Button, buttonClass } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/forms';
import { AuthStatus } from './parts';

type State =
  { kind: 'working' } | { kind: 'expired'; email: string | null } | { kind: 'invalid' } | { kind: 'already' };

export function VerifyEmailPage() {
  const { t } = useT();
  const { token } = useSearch({ from: '/public/verify-email' });
  const { signedIn } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<State>(token ? { kind: 'working' } : { kind: 'invalid' });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post<Me>('/public/organizations/verify', { token })
      .then(async (me) => {
        await signedIn(me);
        await navigate({ to: '/app/dashboard', replace: true });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'TOKEN_EXPIRED') {
          setState({ kind: 'expired', email: (error.details as { email?: string } | undefined)?.email ?? null });
        } else if (
          error instanceof ApiError &&
          (error.details as { alreadyVerified?: boolean } | undefined)?.alreadyVerified
        ) {
          setState({ kind: 'already' });
        } else setState({ kind: 'invalid' });
      });
  }, [navigate, signedIn, token]);

  if (state.kind === 'working') {
    return (
      <AuthStatus icon={<Spinner />} title={t('auth.verify.working')}>
        <span className="sr-only" role="status">
          {t('auth.verify.working')}
        </span>
      </AuthStatus>
    );
  }
  if (state.kind === 'already') {
    return (
      <AuthStatus icon={<CircleCheck />} title={t('auth.verify.alreadyTitle')}>
        <p>{t('auth.verify.alreadyBody')}</p>
        <Link to="/login" className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
          {t('auth.login.submit')}
        </Link>
      </AuthStatus>
    );
  }
  if (state.kind === 'expired') {
    return (
      <AuthStatus icon={<Clock />} title={t('auth.verify.expiredTitle')}>
        <p>{t('auth.verify.expiredBody')}</p>
        {state.email && (
          <Button
            variant="primary"
            size="lg"
            block
            onClick={async () => {
              try {
                await api.post('/public/organizations/resend', { email: state.email });
                toast.success(t('auth.verify.resent', { email: state.email ?? '' }));
              } catch (error) {
                toast.error(errorMessage(error, t));
              }
            }}
          >
            {t('auth.verify.resend')}
          </Button>
        )}
      </AuthStatus>
    );
  }
  return (
    <AuthStatus icon={<Link2Off />} title={t('auth.verify.invalidTitle')}>
      <p>{token ? t('auth.verify.invalidBody') : t('auth.verify.missing')}</p>
      <Link to="/register" className="font-medium text-ink hover:underline">
        {t('auth.login.register')}
      </Link>
    </AuthStatus>
  );
}
