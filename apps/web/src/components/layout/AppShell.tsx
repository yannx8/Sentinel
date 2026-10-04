import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building2, ChevronRight, ClipboardList, Globe, LayoutDashboard, LogOut, Map as MapIcon, Menu, Settings, Users
} from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { useNotifications } from '../../store/notificationStore';
import { useI18n } from '../../i18n';
import { BrandMark } from '../shared/BrandMark';
import { NavItem } from './NavItem';
import { NotificationsPanel } from './NotificationsPanel';

function Avatar({ name, size, className }: { name: string; size: number; className?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div 
      className={`flex items-center justify-center font-bold text-white bg-[var(--brand)] rounded ${className || ''}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const u = useAuth((s) => s.user)!;
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { items, load } = useNotifications();
  const { locale, setLocale } = useI18n();
  const t = useI18n((s) => s.t);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const unread = items.filter((x) => !x.readAt).length;
  const roles = u.roles || ['USER'];
  const admin = roles.includes('ADMINISTRATOR');
  const responsable = roles.includes('RESPONSABLE');
  const canSeeMap = admin || responsable;
  const roleLabel: Record<string, string> = { ADMINISTRATOR: 'Admin', RESPONSABLE: 'Responsable', USER: 'User' };

  const viewTitle = useMemo(() => {
    const map: Record<string, string> = {
      '/': t('nav.overview'),
      '/incidents': t('nav.incidents'),
      '/map': t('nav.map'),
      '/team': t('nav.teams'),
      '/sites': t('nav.sites'),
      '/profile': t('profile.title'),
      '/settings': t('nav.settings')
    };
    return map[loc.pathname] || loc.pathname.slice(1);
  }, [loc.pathname, t]);

  const closeSidebar = () => setSidebarOpen(false);
  const handleLogout = () => { logout().then(() => nav('/login')); };

  return (
    <div className="flex min-h-screen text-[var(--ink)] bg-[var(--canvas)]">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40" onClick={closeSidebar} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="flex items-center gap-2 mb-6">
          <BrandMark />
          <div>
            <strong className="block text-sm font-bold tracking-widest text-[var(--ink)] leading-none">NEXUS</strong>
            <small className="block text-[8px] tracking-[0.3em] text-[var(--ink-disabled)] mt-1">INCIDENT CONTROL</small>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--canvas)] p-2 mb-6">
          <Avatar name={u.organizationName || 'Org'} size={32} />
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-xs font-semibold text-[var(--ink)]">{u.organizationName}</strong>
            <small className="block text-[10px] text-[var(--ink-disabled)] mt-0.5">{admin ? 'Operational workspace' : 'Incident workspace'}</small>
          </div>
          <ChevronRight size={16} className="text-[var(--ink-disabled)]" />
        </div>

        <nav className="flex flex-col gap-1">
          <div className="mb-2 text-[9px] font-bold tracking-widest text-[var(--ink-disabled)]">WORKSPACE</div>
          <NavItem to="/" icon={<LayoutDashboard size={18} />} text={t('nav.overview')} active={loc.pathname === '/'} />
          <NavItem to="/incidents" icon={<ClipboardList size={18} />} text={t('nav.incidents')} active={loc.pathname === '/incidents'} />
          {canSeeMap && (
            <NavItem to="/map" icon={<MapIcon size={18} />} text={t('nav.map')} active={loc.pathname === '/map'} />
          )}
          {admin && (
            <>
              <NavItem to="/team" icon={<Users size={18} />} text={t('nav.teams')} active={loc.pathname === '/team'} />
              <NavItem to="/sites" icon={<Building2 size={18} />} text={t('nav.sites')} active={loc.pathname === '/sites'} />
            </>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          <NavItem to="/settings" icon={<Settings size={18} />} text={t('nav.settings')} active={loc.pathname === '/settings'} />
          
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded p-2 text-left text-sm font-medium text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] mt-2">
            <LogOut size={16} />
            {t('nav.logout')}
          </button>
          
          <div className="my-4 h-px w-full bg-[var(--border)]" />
          
          <div className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors hover:bg-[var(--surface-sunken)]" onClick={() => { closeSidebar(); nav('/profile'); }}>
            <Avatar name={u.name || 'User'} size={32} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-xs font-semibold text-[var(--ink)]">{u.name}</div>
              <div className="text-[10px] text-[var(--ink-3)]">{roleLabel[roles[0]] || roles[0]}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border)] bg-white/90 px-4 md:px-8 backdrop-blur">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-[var(--ink-disabled)]" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-[var(--ink-3)] md:flex">
              <span>{t('nav.workspace')}</span>
              <ChevronRight size={14} />
              <strong className="text-[var(--ink)]">{viewTitle}</strong>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-[var(--ink-3)] transition-colors hover:text-[var(--brand)]" onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')} title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}>
              <Globe size={18} />
              <span className="text-xs font-semibold">{locale.toUpperCase()}</span>
            </button>
            <button className="relative text-[var(--ink-3)] transition-colors hover:text-[var(--brand)]" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell size={20} />
              {unread > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--critical)] text-[8px] font-bold text-white border-2 border-white">{unread}</span>}
            </button>
            <div className="h-6 w-px bg-[var(--border)]" />
            <button className="hidden md:block" onClick={() => nav('/profile')}>
              <Avatar name={u.name || 'User'} size={32} />
            </button>
          </div>
        </header>

        {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}

        <main className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
