import { Link, Outlet } from '@tanstack/react-router';
import { Bell, ClipboardList, History, ListChecks, Plus, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT, type TKey } from '../../i18n';
import { NotificationBell } from '../../features/notifications/notification-bell';
import { useSession } from '../session';
import { OrgSwitcher, useShellGate } from './shared';

type Tab = { to: string; label: TKey; icon: ReactNode; exact?: boolean };

/**
 * Phone-first shell for employees and intervenants: organization and
 * notifications at the top, four tabs fixed at the bottom, one column.
 */
export function FieldShell() {
  const gate = useShellGate('field');
  if (gate) return gate;
  return <FieldLayout />;
}

function FieldLayout() {
  const { t } = useT();
  const { membership } = useSession();
  const intervenant = membership?.role === 'INTERVENANT';

  const tabs: Tab[] = intervenant
    ? [
        { to: '/field/work', label: 'shell.nav.myWork', icon: <ListChecks /> },
        { to: '/field/incidents', label: 'shell.nav.history', icon: <History />, exact: true },
        { to: '/field/notifications', label: 'shell.nav.notifications', icon: <Bell /> },
        { to: '/field/profile', label: 'shell.nav.profile', icon: <UserRound /> },
      ]
    : [
        { to: '/field/report', label: 'shell.nav.report', icon: <Plus /> },
        { to: '/field/incidents', label: 'shell.nav.myIncidents', icon: <ClipboardList />, exact: true },
        { to: '/field/notifications', label: 'shell.nav.notifications', icon: <Bell /> },
        { to: '/field/profile', label: 'shell.nav.profile', icon: <UserRound /> },
      ];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
        <div className="mx-auto flex h-14 w-full max-w-[680px] items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
          <div className="min-w-0 flex-1">
            <OrgSwitcher compact />
          </div>
          <NotificationBell to="/field/notifications" />
        </div>
      </header>
      <main
        id="main"
        className="mx-auto w-full max-w-[680px] flex-1 px-4 pt-5 pb-[calc(88px+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
      <nav
        aria-label={t('shell.mainNavigation')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid h-16 max-w-[680px] grid-cols-4">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              activeOptions={{ exact: tab.exact ?? false }}
              className="flex flex-col items-center justify-center gap-1 text-2xs font-medium text-ink-3 transition-colors hover:text-ink [&_svg]:size-5"
              activeProps={{ className: '!text-ink', 'aria-current': 'page' }}
            >
              {tab.icon}
              {t(tab.label)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
