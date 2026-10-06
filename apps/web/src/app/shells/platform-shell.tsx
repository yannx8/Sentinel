import { Link, Outlet } from '@tanstack/react-router';
import { Building2, Inbox, ScrollText, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '../../components/ui/layout';
import { useT, type TKey } from '../../i18n';
import { navLinkActiveClass, navLinkClass, useShellGate, UserMenu } from './shared';

const links: { to: string; label: TKey; icon: ReactNode }[] = [
  { to: '/platform/organizations', label: 'shell.nav.organizations', icon: <Building2 /> },
  { to: '/platform/registrations', label: 'shell.nav.registrations', icon: <Inbox /> },
  { to: '/platform/audit', label: 'shell.nav.audit', icon: <ScrollText /> },
];

/** Sentinel staff only. Manages organizations, never shows their incidents. */
export function PlatformShell() {
  const gate = useShellGate('platform');
  if (gate) return gate;
  return <PlatformLayout />;
}

function PlatformLayout() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-line px-3 py-3 lg:w-60 lg:border-b-0">
        <div className="flex h-10 items-center justify-between gap-2 px-2">
          <Logo />
          <span className="inline-flex items-center gap-1 rounded-xs bg-accent-subtle px-1.5 py-0.5 text-2xs font-semibold text-accent">
            <ShieldCheck className="size-3" aria-hidden />
            {t('shell.platformMode')}
          </span>
        </div>
        <nav aria-label={t('shell.mainNavigation')} className="flex gap-0.5 overflow-x-auto lg:grid">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={navLinkClass} activeProps={{ className: navLinkActiveClass, 'aria-current': 'page' }}>
              {link.icon}
              <span className="whitespace-nowrap">{t(link.label)}</span>
            </Link>
          ))}
        </nav>
        <p className="hidden px-2 text-xs text-ink-3 lg:block">{t('shell.platformNotice')}</p>
        <div className="mt-auto hidden border-t border-line pt-3 lg:block">
          <UserMenu accountPath="/platform/account" />
        </div>
      </aside>
      <main id="main" className="min-h-0 flex-1 overflow-y-auto bg-surface lg:my-2 lg:mr-2 lg:rounded-lg lg:border lg:border-line lg:shadow-control">
        <Outlet />
      </main>
    </div>
  );
}
