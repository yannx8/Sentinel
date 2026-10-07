import { useNavigate } from '@tanstack/react-router';
import { UserX } from 'lucide-react';
import { useSession } from '../../app/session';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n';
import { AuthStatus } from './parts';

export function NoAccessPage() {
  const { t } = useT();
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  return (
    <AuthStatus icon={<UserX />} title={t('auth.noAccess.title')}>
      <p>{t('auth.noAccess.body')}</p>
      {me && <p className="text-xs">{t('shell.signedInAs', { email: me.user.email })}</p>}
      <Button
        block
        onClick={async () => {
          await signOut();
          void navigate({ to: '/login' });
        }}
      >
        {t('shell.signOut')}
      </Button>
    </AuthStatus>
  );
}
