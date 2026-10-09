import type { Locale, Me, MembershipSummary } from '@sentinel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Globe, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '../../components/ui/menu';
import { Logo } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { homePath, meQueryKey, useSession, useSignOut } from '../session';
import { useTheme, type ThemePreference } from '../theme';
import { RouteLoading } from './root';

/** Square mark with the organization's initial. */
export function OrgMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-on-primary',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function roleLabelKey(membership: Pick<MembershipSummary, 'role' | 'isOwner'>) {
  if (membership.isOwner) return 'common.role.OWNER' as const;
  return `common.role.${membership.role}` as const;
}

export function OrgSwitcher({ compact }: { compact?: boolean }) {
  const { t } = useT();
  const { me, membership, switchOrganization } = useSession();
  const navigate = useNavigate();
  if (!me || !membership) return null;
  const many = me.memberships.length > 1;

  const trigger = (
    <button
      type="button"
      disabled={!many}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-sm text-left transition-colors',
        compact ? 'h-9 px-1.5' : 'h-10 w-full px-2',
        many && 'hover:bg-muted',
      )}
      aria-label={many ? t('shell.switchOrganization') : undefined}
    >
      <OrgMark name={membership.organization.displayName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{membership.organization.displayName}</span>
        {!compact && <span className="block truncate text-xs text-ink-3">{t(roleLabelKey(membership))}</span>}
      </span>
      {many && <ChevronsUpDown className="size-3.5 shrink-0 text-ink-3" aria-hidden />}
    </button>
  );

  if (!many) return trigger;
  return (
    <Menu>
      <MenuTrigger asChild>{trigger}</MenuTrigger>
      <MenuContent className="w-72">
        <MenuLabel>{t('shell.organizations')}</MenuLabel>
        {me.memberships.map((m) => (
          <MenuItem
            key={m.id}
            icon={<OrgMark name={m.organization.displayName} className="size-5 text-2xs" />}
            onSelect={() => {
              if (m.organization.id === membership.organization.id) return;
              switchOrganization(m.organization.id);
              void navigate({ to: homePath(me, m) });
            }}
            shortcut={
              m.organization.id === membership.organization.id ? (
                <Check className="size-3.5 text-ink" />
              ) : (
                t(roleLabelKey(m))
              )
            }
          >
            {m.organization.displayName}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

const themeIcons: Record<ThemePreference, ReactNode> = {
  light: <Sun />,
  dark: <Moon />,
  system: <Monitor />,
};

/** Changes the signed-in person's language, saved to their profile. */
export function useChangeLocale() {
  const { me, setGuestLocale } = useSession();
  const queryClient = useQueryClient();
  return async (locale: Locale) => {
    if (!me) return setGuestLocale(locale);
    const next = await api.patch<Me>('/me/profile', {
      firstName: me.user.firstName,
      lastName: me.user.lastName,
      phone: me.user.phone ?? '',
      locale,
    });
    queryClient.setQueryData(meQueryKey, next);
  };
}

export function UserMenu({
  accountPath,
  side = 'top',
  compact,
}: {
  accountPath: string;
  side?: 'top' | 'bottom';
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const { me } = useSession();
  const signOutHere = useSignOut();
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();
  const changeLocale = useChangeLocale();
  if (!me) return null;
  const name = `${me.user.firstName} ${me.user.lastName}`;

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-w-0 items-center gap-2.5 rounded-sm text-left transition-colors hover:bg-muted',
            compact ? 'size-9 justify-center' : 'h-10 w-full px-2',
          )}
          aria-label={compact ? name : undefined}
        >
          <Avatar name={name} size="sm" />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{name}</span>
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent side={side} align={compact ? 'end' : 'start'} className="w-64">
        <MenuLabel>{t('shell.signedInAs', { email: me.user.email })}</MenuLabel>
        <MenuItem icon={<UserRound />} onSelect={() => void navigate({ to: accountPath })}>
          {t('shell.nav.account')}
        </MenuItem>
        <MenuSub>
          <MenuSubTrigger icon={themeIcons[theme]}>{t('common.theme.label')}</MenuSubTrigger>
          <MenuSubContent>
            <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
              {(['light', 'dark', 'system'] as const).map((value) => (
                <MenuRadioItem key={value} value={value}>
                  {t(`common.theme.${value}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger icon={<Globe />}>{t('shell.language')}</MenuSubTrigger>
          <MenuSubContent>
            <MenuRadioGroup value={locale} onValueChange={(value) => void changeLocale(value as Locale)}>
              {(['en', 'fr'] as const).map((value) => (
                <MenuRadioItem key={value} value={value}>
                  {t(`common.language.${value}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={() => void signOutHere()}>
          {t('shell.signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function LanguageSwitch() {
  const { locale, t } = useT();
  const changeLocale = useChangeLocale();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" icon={<Globe className="size-3.5" />} aria-label={t('shell.language')}>
          {t(`common.language.${locale}`)}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-36">
        <MenuRadioGroup value={locale} onValueChange={(value) => void changeLocale(value as Locale)}>
          {(['en', 'fr'] as const).map((value) => (
            <MenuRadioItem key={value} value={value}>
              {t(`common.language.${value}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** Blocking screen when the active organization is suspended (ORG_SUSPENDED). */
export function SuspendedScreen({ membership }: { membership: MembershipSummary }) {
  const { t } = useT();
  const { me, switchOrganization } = useSession();
  const navigate = useNavigate();
  const other = me?.memberships.find((m) => m.organization.status === 'ACTIVE');
  const { organization } = membership;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <Logo className="mb-10" />
      <div className="max-w-md rounded-xl border border-line bg-surface p-8 shadow-pop">
        <h1 className="text-xl font-semibold text-ink">
          {t('shell.suspended.title', { organization: organization.displayName })}
        </h1>
        <p className="mt-2 text-sm text-ink-2">{t('shell.suspended.body')}</p>
        <p className="mt-4 text-sm text-ink">
          {organization.ownerName
            ? t('shell.suspended.contact', { name: organization.ownerName })
            : organization.ownerEmail
              ? t('shell.suspended.contactEmail', { email: organization.ownerEmail })
              : null}
          {organization.ownerName && organization.ownerEmail && (
            <a className="mt-1 block text-accent hover:underline" href={`mailto:${organization.ownerEmail}`}>
              {organization.ownerEmail}
            </a>
          )}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {other && (
            <Button
              variant="primary"
              onClick={() => {
                switchOrganization(other.organization.id);
                void navigate({ to: homePath(me, other) });
              }}
            >
              {t('shell.suspended.other')}
            </Button>
          )}
          <UserMenuSignOut />
        </div>
      </div>
    </div>
  );
}

function UserMenuSignOut() {
  const { t } = useT();
  const signOutHere = useSignOut();
  return (
    <Button variant="ghost" onClick={() => void signOutHere()}>
      {t('shell.signOut')}
    </Button>
  );
}

type Requirement = 'supervisor' | 'field' | 'platform';

/**
 * Route guard used by each shell. Returns an element to render instead of the
 * shell (a redirect, a loading state or the suspension screen), or null to proceed.
 */
/**
 * Redirects once. The router's own Navigate navigates again on every re-render of its parent, which loops
 * forever while a redirect is still loading.
 */
function GoTo({ to, redirect }: { to: string; redirect?: string }) {
  const navigate = useNavigate();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void navigate({ to, search: redirect ? { redirect } : undefined, replace: true });
  }, [navigate, to, redirect]);
  return <RouteLoading />;
}

export function useShellGate(requirement: Requirement): ReactNode | null {
  const { me, membership, loading } = useSession();
  // The resolved location stays put while a redirect is loading; useLocation() would already point at /login and loop.
  const from = useRouterState({ select: (state) => state.resolvedLocation?.href ?? state.location.href });
  if (loading) return <RouteLoading />;
  if (!me) return <GoTo to="/login" redirect={from} />;

  if (requirement === 'platform') {
    if (!me.platformAdmin) return <GoTo to={homePath(me, membership)} />;
    if (!me.platformAdmin.mfaVerified) return <GoTo to="/mfa" />;
    return null;
  }
  if (me.platformAdmin || !membership) return <GoTo to={homePath(me, membership)} />;
  if (membership.organization.status === 'SUSPENDED') return <SuspendedScreen membership={membership} />;
  const allowed = requirement === 'supervisor' ? membership.role === 'SUPERVISOR' : membership.role !== 'SUPERVISOR';
  if (!allowed) return <GoTo to={homePath(me, membership)} />;
  return null;
}

export const navLinkClass =
  'group flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-muted hover:text-ink [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3';
export const navLinkActiveClass = '!bg-surface !text-ink shadow-control ring-1 ring-line [&>svg]:!text-ink';

export function NavCount({ value, tone = 'neutral' }: { value: number | undefined; tone?: 'neutral' | 'accent' }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'ml-auto min-w-5 rounded-full px-1.5 text-center text-2xs leading-5 font-semibold tabular-nums',
        tone === 'accent' ? 'bg-accent text-white' : 'bg-muted text-ink-2',
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}
