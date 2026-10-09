import { Button } from '../../components/ui/button';
import { FieldGroup } from '../../components/ui/field';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { toastError } from '../../lib/forms';
import { useInstall } from '../../lib/pwa';
import { usePush } from '../../lib/web-push';

/** Notifications on this device. Hidden where the server has no push keys. */
export function PushToggle() {
  const { t } = useT();
  const { available, status, busy, enable, disable } = usePush();
  const { showIosHelp } = useInstall();
  if (!available) return null;

  const run = (action: () => Promise<void>, done: string) =>
    action().then(
      () => toast.success(done),
      (error: unknown) => toastError(error, t),
    );

  return (
    <FieldGroup title={t('pwa.push.title')} description={t('pwa.push.description')}>
      {status === 'unsupported' ? (
        <p className="text-sm text-ink-2">{showIosHelp ? t('pwa.push.iosHint') : t('pwa.push.unsupported')}</p>
      ) : status === 'denied' ? (
        <p className="text-sm text-ink-2">{t('pwa.push.denied')}</p>
      ) : status === 'on' ? (
        <Button size="lg" loading={busy} onClick={() => void run(disable, t('pwa.push.disabled'))}>
          {t('pwa.push.disable')}
        </Button>
      ) : (
        <Button size="lg" variant="primary" loading={busy} onClick={() => void run(enable, t('pwa.push.enabled'))}>
          {t('pwa.push.enable')}
        </Button>
      )}
    </FieldGroup>
  );
}
