import type { Locale, Me, MembershipSummary } from '@sentinel/shared';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nProvider, detectLocale, useT } from '../i18n';
import { installValidationMessages } from '../lib/forms';
import { api, ApiError, onGlobalApiError, setActiveOrgHeader } from '../lib/api';

const ORG_KEY = 'sentinel.org';
export const meQueryKey = ['me'] as const;

function storedOrg(): string | null {
  try {
    return localStorage.getItem(ORG_KEY);
  } catch {
    return null;
  }
}

export async function fetchMe(): Promise<Me | null> {
  try {
    return await api.get<Me>('/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

type SessionValue = {
  me: Me | null;
  loading: boolean;
  /** The organization the person is working in now. */
  membership: MembershipSummary | null;
  switchOrganization: (orgId: string) => void;
  /** Resolves once the new session has reached every component, so a redirect right after it sees the person. */
  signedIn: (me: Me) => Promise<void>;
  signOut: () => Promise<void>;
  /** Language before sign-in. Signed-in people change it in their profile. */
  setGuestLocale: (locale: Locale) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/** Tells the other tabs that the signed-in person changed. */
const sessionChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('sentinel.session');

function pickMembership(me: Me | null, saved: string | null): MembershipSummary | null {
  if (!me || me.memberships.length === 0) return null;
  return me.memberships.find((m) => m.organization.id === saved) ?? me.memberships[0] ?? null;
}

/** Clears everything cached for the previous organization or person. */
function resetTenantCache(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meQueryKey[0] });
}

/** Clears everything cached for the previous person, keeping only the session query itself (still observed). */
function resetPersonCache(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => !(query.queryKey[0] === meQueryKey[0] && query.queryKey.length === 1),
  });
  queryClient.getMutationCache().clear();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: meQueryKey, queryFn: fetchMe, staleTime: 5 * 60_000 });
  const me = meQuery.data ?? null;
  const [guestLocale, setGuestLocaleState] = useState<Locale>(detectLocale);
  // State, not just storage: changing it is what re-renders every consumer of the session.
  const [activeOrg, setActiveOrg] = useState<string | null>(storedOrg);
  const membership = pickMembership(me, activeOrg);

  // Set synchronously so the first tenant request already carries the header.
  setActiveOrgHeader(membership?.organization.id ?? null);

  useEffect(
    () =>
      onGlobalApiError((error) => {
        if (error.code === 'UNAUTHENTICATED') queryClient.setQueryData(meQueryKey, null);
        if (error.code === 'ORG_SUSPENDED' || error.code === 'MEMBERSHIP_INACTIVE') {
          void queryClient.invalidateQueries({ queryKey: meQueryKey });
        }
      }),
    [queryClient],
  );

  useEffect(() => {
    if (!sessionChannel) return;
    // Another tab signed in or out: this one must not keep acting as the previous person.
    const reload = () => window.location.reload();
    sessionChannel.addEventListener('message', reload);
    return () => sessionChannel.removeEventListener('message', reload);
  }, []);

  const switchOrganization = useCallback(
    (orgId: string) => {
      try {
        localStorage.setItem(ORG_KEY, orgId);
      } catch {
        // storage unavailable
      }
      setActiveOrgHeader(orgId);
      resetTenantCache(queryClient);
      // Setting a copy of the session data would not re-render: structural sharing keeps the old object.
      setActiveOrg(orgId);
    },
    [queryClient],
  );

  const signedIn = useCallback(
    async (next: Me) => {
      // The initial "who am I" check may still be in flight. Without cancelling it, its late
      // "signed out" answer would overwrite the session we just created.
      void queryClient.cancelQueries({ queryKey: meQueryKey }, { revert: false });
      resetPersonCache(queryClient);
      setActiveOrg(storedOrg());
      queryClient.setQueryData(meQueryKey, next);
      sessionChannel?.postMessage('changed');
      // Query observers are notified on the next macrotask.
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Not queryClient.clear(): it removes the ['me'] query this provider observes without telling it,
      // so the previous person stays on screen until a reload.
      resetPersonCache(queryClient);
      queryClient.setQueryData(meQueryKey, null);
      sessionChannel?.postMessage('changed');
    }
  }, [queryClient]);

  const setGuestLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem('sentinel.locale', next);
    } catch {
      // storage unavailable
    }
    setGuestLocaleState(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ me, loading: meQuery.isPending, membership, switchOrganization, signedIn, signOut, setGuestLocale }),
    [me, meQuery.isPending, membership, switchOrganization, signedIn, signOut, setGuestLocale],
  );

  const locale: Locale = me?.user.locale ?? guestLocale;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const timeZone = membership?.organization.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <SessionContext.Provider value={value}>
      <I18nProvider locale={locale} timeZone={timeZone}>
        <ValidationMessages />
        {children}
      </I18nProvider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** Sign-out from inside a shell: leave first, so the shell gate never adds ?redirect= to the previous person's page. */
export function useSignOut() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  return useCallback(async () => {
    await navigate({ to: '/login', replace: true });
    await signOut();
  }, [navigate, signOut]);
}

/** The active membership on a route that requires one. */
export function useMembership(): MembershipSummary {
  const { membership } = useSession();
  if (!membership) throw new Error('No active membership');
  return membership;
}

/** Where a person lands after sign-in, by role. */
export function homePath(me: Me | null, membership: MembershipSummary | null): string {
  if (!me) return '/login';
  if (me.platformAdmin) return me.platformAdmin.mfaVerified ? '/platform' : '/mfa';
  if (!membership) return '/no-access';
  if (membership.role === 'SUPERVISOR') return '/app/incidents';
  if (membership.role === 'INTERVENANT') return '/field/work';
  return '/field/report';
}

function ValidationMessages() {
  const { t } = useT();
  installValidationMessages(t);
  return null;
}
