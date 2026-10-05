import { Link, Outlet } from '@tanstack/react-router';
import {
  ArrowLeftRight,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Map as MapIcon,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { organizationName } from '../../data/seed';
import { applyTheme, cn, readTheme, useMediaQuery, type Theme } from '../../lib/util';
import { Glyph } from '../ui/Glyph';

export type Section = { slug: string; label: string; icon: LucideIcon; milestone: string; blurb: string };

/** Console sections. Only the Triage desk exists today, the rest point at their planned milestone. */
export const sections: Section[] = [
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, milestone: 'R4', blurb: 'Open incidents, ageing, workload and time to resolution.' },
  { slug: 'map', label: 'Map', icon: MapIcon, milestone: 'R4', blurb: 'Open incidents on a map, using real report coordinates only.' },
  { slug: 'reassignments', label: 'Reassignments', icon: ArrowLeftRight, milestone: 'R4', blurb: 'Requests from technicians who cannot take an assignment.' },
  { slug: 'team', label: 'Team', icon: Users, milestone: 'R3', blurb: 'Employees, intervenants and invitations, with CSV import.' },
  { slug: 'sites', label: 'Sites', icon: MapPin, milestone: 'R3', blurb: 'Locations with a map pin and a perimeter.' },
  { slug: 'audit', label: 'Audit', icon: ScrollText, milestone: 'R4', blurb: 'Every state change, filterable and exportable.' },
  { slug: 'settings', label: 'Settings', icon: Settings, milestone: 'R3', blurb: 'Organization profile, language, timezone and workflow options.' },
];

const navItem =
  'group relative flex h-9 items-center gap-2.5 rounded-control px-3 text-base font-medium text-ink-2 transition-colors duration-(--dur-small) hover:bg-sunken hover:text-ink';
const navActive = 'bg-brand-tint !text-brand';

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const label = (text: string) => (collapsed ? <span className="sr-only">{text}</span> : <span className="truncate">{text}</span>);
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      <Link to="/app/triage" className={navItem} activeProps={{ className: navActive }} onClick={onNavigate} title={collapsed ? 'Triage desk' : undefined}>
        <Inbox size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
        {label('Triage desk')}
      </Link>
      {sections.map((s) => (
        <Link
          key={s.slug}
          to="/app/$section"
          params={{ section: s.slug }}
          className={navItem}
          activeProps={{ className: navActive }}
          onClick={onNavigate}
          title={collapsed ? s.label : undefined}
        >
          <s.icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {label(s.label)}
        </Link>
      ))}
    </nav>
  );
}

export function Shell() {
  const wide = useMediaQuery('(min-width: 1280px)');
  const compact = useMediaQuery('(max-width: 639px)');
  const [railPref, setRailPref] = useState<boolean | null>(() => {
    const v = localStorage.getItem('sentinel.rail');
    return v === null ? null : v === 'collapsed';
  });
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = railPref ?? !wide;

  useEffect(() => applyTheme(theme), [theme]);

  const toggleRail = () => {
    const next = !collapsed;
    setRailPref(next);
    localStorage.setItem('sentinel.rail', next ? 'collapsed' : 'expanded');
  };

  return (
    <div
      className={cn(
        'grid h-dvh bg-canvas sm:grid-cols-[var(--rail)_minmax(0,1fr)]',
        compact && menuOpen ? 'grid-rows-[52px_auto_minmax(0,1fr)]' : 'grid-rows-[52px_minmax(0,1fr)]',
      )}
      style={{ '--rail': collapsed ? '64px' : '232px' } as React.CSSProperties}
    >
      <header className="col-span-full flex items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {compact ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-control text-ink-2 hover:bg-sunken"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Menu size={20} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
          <div className="flex items-center gap-2 pr-2 font-display text-lg font-semibold text-ink">
            <Glyph name="assigned" size={20} className="text-brand" />
            Sentinel
          </div>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <span className="hidden truncate text-base font-medium text-ink sm:block">{organizationName}</span>
          <span className="hidden rounded-pill bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2 md:block">Demo data</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-control text-ink-2 transition-colors duration-(--dur-small) hover:bg-sunken hover:text-ink"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <Moon size={18} strokeWidth={1.75} aria-hidden /> : <Sun size={18} strokeWidth={1.75} aria-hidden />}
          </button>
          <span
            className="grid size-8 place-items-center rounded-pill bg-brand-tint text-xs font-semibold text-brand"
            title="Sara K., Supervisor"
            role="img"
            aria-label="Signed in as Sara K., Supervisor"
          >
            SK
          </span>
        </div>
      </header>

      {compact ? (
        menuOpen ? (
          <div id="mobile-nav" className="anim-rise col-span-full border-b border-border bg-surface p-2">
            <NavLinks collapsed={false} onNavigate={() => setMenuOpen(false)} />
          </div>
        ) : null
      ) : (
        <aside className="hidden flex-col justify-between overflow-y-auto border-r border-border bg-surface p-3 sm:flex">
          <NavLinks collapsed={collapsed} />
          <button
            type="button"
            onClick={toggleRail}
            className={cn(navItem, 'w-full')}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden /> : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden />}
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </aside>
      )}

      <main className="min-h-0 min-w-0 sm:col-start-2">
        <Outlet />
      </main>
    </div>
  );
}
