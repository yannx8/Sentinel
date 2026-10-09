import { FieldGroup } from '../../components/ui/field';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n';
import { useInstall } from '../../lib/pwa';

/** Put Sentinel on the home screen. Shown only where the browser can do it or needs the iOS hint. */
export function InstallApp() {
  const { t } = useT();
  const { canPrompt, showIosHelp, install } = useInstall();
  if (!canPrompt && !showIosHelp) return null;
  return (
    <FieldGroup title={t('pwa.install.title')} description={t('pwa.install.description')}>
      {canPrompt ? (
        <Button size="lg" onClick={() => void install()}>
          {t('pwa.install.button')}
        </Button>
      ) : (
        <p className="text-sm text-ink-2">{t('pwa.install.ios')}</p>
      )}
    </FieldGroup>
  );
}
