import type { ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Page, PageHeader } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { errorMessage } from '../../lib/forms';
import { useOrganizationSettings } from './queries';
import { SettingsForm } from './settings-form';
import { SettingsSkeleton } from './settings-parts';

export function SettingsPage() {
  const { t } = useT();
  const membership = useMembership();
  const settings = useOrganizationSettings();
  const { organization } = membership;
  // Right after switching organization the cache may still hold the previous one for a render.
  const current = settings.data?.id === organization.id ? settings.data : undefined;

  let body: ReactNode;
  if (current) {
    body = (
      <SettingsForm
        key={current.id}
        settings={current}
        canEdit={membership.isOwner}
        ownerName={organization.ownerName}
      />
    );
  } else if (settings.isError) {
    body = (
      <EmptyState
        title={t('common.errorTitle')}
        description={errorMessage(settings.error, t)}
        action={
          <Button onClick={() => void settings.refetch()} loading={settings.isFetching}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else {
    body = <SettingsSkeleton />;
  }

  return (
    <Page width="narrow">
      <PageHeader
        title={t('setup.settings.title')}
        description={t('setup.settings.description', { organization: organization.displayName })}
      />
      <div className="border-t border-line pt-6">{body}</div>
    </Page>
  );
}
