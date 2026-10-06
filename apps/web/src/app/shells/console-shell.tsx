import type { ReassignmentRequestDTO } from '@sentinel/shared';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  Bell,
  Inbox,
  LayoutDashboard,
  MapPin,
  Menu as MenuIcon,
  ScrollText,
  Search,
  Settings,
  Shapes,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Kbd } from '../../components/ui/badge';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { IconButton } from '../../components/ui/button';
import { Logo } from '../../components/ui/layout';
import { NotificationBell } from '../../features/notifications/notification-bell';
import { useT, type TKey } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { CommandPalette, type PaletteLink } from './command-palette';
import { NavCount, navLinkActiveClass, navLinkClass, OrgSwitcher, useShellGate, UserMenu } from './shared';

type NavItem = { to: string; label: TKey; icon: ReactNode; count?: number; countTone?: 'neutral' | 'accent' };

export type IncidentCounts = {
  attention: number;
  unassigned: number;
  inProgress: number;
  review: number;
  open: number;
  closed: number;
};

export const incidentCountsKey = ['incidents', 'counts'] as const;

function useConsoleCounts() {
  const counts = useQuery({
    queryKey: incidentCountsKey,
    queryFn: () => api.get<IncidentCounts>('/incidents/counts'),
    refetchInterval: 30_000,
  });
  const reassignments = useQuery({
    queryKey: ['reassignments'],
    queryFn: () => api.get<ReassignmentRequestDTO[]>('/reassignments'),
    refetchInterval: 30_000,
  });
  return { attention: counts.data?.attention, reassignments: reassignments.data?.length };
}

function isMac() {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform);
}

function SearchButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 w-full items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink-3 shadow-control transition-colors hover:border-line-strong hover:text-ink-2"
    >
      <Search className="size-4" aria-hidden />
      <span className="flex-1 text-left">{t('shell.search')}</span>
      <Kbd>{isMac() ? '⌘K' : 'Ctrl K'}</Kbd>
    </button>
  );
}

function SidebarNav({ items, onNavigate }: { items: { title?: TKey; links: NavItem[] }[]; onNavigate?: () => void }) {
  const { t } = useT();
  return (
    <nav aria-label={t('shell.mainNavigation')} className="grid gap-5">
      {items.map((group, index) => (
        <div key={index} className="grid gap-0.5">
          {group.title && <p className="px-2 pb-1 text-xs font-medium text-ink-3">{t(group.title)}</p>}
          {group.links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={navLinkClass}
              activeProps={{ className: navLinkActiveClass, 'aria-current': 'page' }}
            >
              {item.icon}
              <span className="truncate">{t(item.label)}</span>
              <NavCount value={item.count} tone={item.countTone} />
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useT();
  const rows: [string[], TKey][] = [
    [[isMac() ? '⌘' : 'Ctrl', 'K'], 'shell.shortcuts.palette'],
    [['J'], 'shell.shortcuts.next'],
    [['K'], 'shell.shortcuts.previous'],
    [['Enter'], 'shell.shortcuts.open'],
    [['Esc'], 'shell.shortcuts.close'],
    [['A'], 'shell.shortcuts.assign'],
    [['?'], 'shell.shortcuts.help'],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('shell.shortcuts.title')} size="sm">
        <dl className="grid gap-2.5">
          {rows.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-ink-2">{t(label)}</dt>
              <dd className="flex gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/** True while focus is in a field, so single-key shortcuts never collide with typing. */
export function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
}

export function ConsoleShell() {
  const gate = useShellGate('supervisor');
  if (gate) return gate;
  return <ConsoleLayout />;
}

function ConsoleLayout() {
  const { t } = useT();
  const counts = useConsoleCounts();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === '?' && !isTyping(event.target) && !event.metaKey && !event.ctrlKey) {
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups: { title?: TKey; links: NavItem[] }[] = [
    {
      links: [
        { to: '/app/incidents', label: 'shell.nav.incidents', icon: <Inbox />, count: counts.attention, countTone: 'accent' },
        { to: '/app/dashboard', label: 'shell.nav.dashboard', icon: <LayoutDashboard /> },
        { to: '/app/reassignments', label: 'shell.nav.reassignments', icon: <ArrowLeftRight />, count: counts.reassignments },
      ],
    },
    {
      title: 'shell.nav.organization',
      links: [
        { to: '/app/team', label: 'shell.nav.team', icon: <Users /> },
        { to: '/app/sites', label: 'shell.nav.sites', icon: <MapPin /> },
        { to: '/app/categories', label: 'shell.nav.categories', icon: <Shapes /> },
        { to: '/app/audit', label: 'shell.nav.audit', icon: <ScrollText /> },
        { to: '/app/settings', label: 'shell.nav.settings', icon: <Settings /> },
      ],
    },
  ];

  const paletteLinks: PaletteLink[] = [
    ...groups.flatMap((group) => group.links),
    { to: '/app/notifications', label: 'shell.nav.notifications' as TKey, icon: <Bell /> },
  ].map((item) => ({ to: item.to, label: t(item.label), icon: item.icon }));

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 px-3 py-3">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <OrgSwitcher />
        </div>
        <NotificationBell to="/app/notifications" />
      </div>
      <SearchButton
        onOpen={() => {
          onNavigate?.();
          setPaletteOpen(true);
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav items={groups} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-line pt-3">
        <UserMenu accountPath="/app/account" />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh bg-bg">
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar()}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-bg px-3 lg:hidden">
          <IconButton label={t('shell.openMenu')} onClick={() => setDrawerOpen(true)}>
            <MenuIcon className="size-4" />
          </IconButton>
          <Logo className="flex-1" />
          <IconButton label={t('shell.search')} onClick={() => setPaletteOpen(true)}>
            <Search className="size-4" />
          </IconButton>
          <NotificationBell to="/app/notifications" />
        </header>
        <main
          id="main"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto bg-surface',
            'lg:my-2 lg:mr-2 lg:rounded-lg lg:border lg:border-line lg:shadow-control',
          )}
        >
          <Outlet />
        </main>
      </div>

      <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[50] bg-scrim animate-fade-in lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-[51] w-[280px] max-w-[85vw] border-r border-line bg-bg shadow-dialog animate-fade-in focus:outline-none lg:hidden">
            <RadixDialog.Title className="sr-only">{t('shell.mainNavigation')}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">{t('shell.mainNavigation')}</RadixDialog.Description>
            <RadixDialog.Close asChild>
              <IconButton label={t('shell.closeMenu')} size="sm" className="absolute top-3.5 -right-10 bg-surface" tooltip={false}>
                <X className="size-4" />
              </IconButton>
            </RadixDialog.Close>
            {sidebar(() => setDrawerOpen(false))}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} links={paletteLinks} searchPeople />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
