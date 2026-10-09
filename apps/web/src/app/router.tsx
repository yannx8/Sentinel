import { inboxViews } from '@sentinel/shared';
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  redirect,
} from '@tanstack/react-router';
import { z } from 'zod';
import { ConsoleShell } from './shells/console-shell';
import { FieldShell } from './shells/field-shell';
import { PlatformShell } from './shells/platform-shell';
import { PublicShell } from './shells/public-shell';
import { RootLayout, NotFound, RouteError, RouteLoading } from './shells/root';
import { homePath, useSession } from './session';

/* Search params are typed and forgiving: an invalid value falls back to its default instead of breaking the page. */

const text = z.string().max(200).optional().catch(undefined);

export const incidentsSearch = z.object({
  view: z.enum(inboxViews).optional().catch(undefined),
  q: text,
  priority: text,
  site: text,
  category: text,
  assignee: text,
  sort: z.enum(['urgency', 'newest', 'oldest', 'updated']).optional().catch(undefined),
  incident: text,
});
export type IncidentsSearch = z.infer<typeof incidentsSearch>;

export const teamSearch = z.object({
  tab: z.enum(['employees', 'intervenants', 'supervisors', 'invitations']).optional().catch(undefined),
  q: text,
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).optional().catch(undefined),
});

export const auditSearch = z.object({
  type: text,
  incident: text,
  actor: text,
  from: text,
  to: text,
});

export const platformOrgSearch = z.object({
  q: text,
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional().catch(undefined),
});

/** The organization of a field case file, so work from any client opens without switching first. */
const fieldIncidentSearch = z.object({ org: z.string().uuid().optional().catch(undefined) });

/** A QR code opens the report form with the site and area it names. */
const reportSearch = z.object({
  site: z.string().uuid().optional().catch(undefined),
  area: z.string().uuid().optional().catch(undefined),
});

const tokenSearch = z.object({ token: z.string().max(300).optional().catch(undefined) });
const loginSearch = z.object({ redirect: z.string().max(300).optional().catch(undefined), email: text });

function HomeRedirect() {
  const { me, membership, loading } = useSession();
  if (loading) return <RouteLoading />;
  return <Navigate to={homePath(me, membership)} replace />;
}

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound, errorComponent: RouteError });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeRedirect });

/* Public */

const publicLayout = createRoute({ getParentRoute: () => rootRoute, id: 'public', component: PublicShell });
const loginRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/login',
  validateSearch: loginSearch,
  component: lazyRouteComponent(() => import('../features/auth/login-page'), 'LoginPage'),
});
const forgotRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/forgot-password',
  component: lazyRouteComponent(() => import('../features/auth/forgot-password-page'), 'ForgotPasswordPage'),
});
const resetRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/reset-password',
  validateSearch: tokenSearch,
  component: lazyRouteComponent(() => import('../features/auth/reset-password-page'), 'ResetPasswordPage'),
});
const registerRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/register',
  component: lazyRouteComponent(() => import('../features/auth/register-page'), 'RegisterPage'),
});
const verifyRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/verify-email',
  validateSearch: tokenSearch,
  component: lazyRouteComponent(() => import('../features/auth/verify-email-page'), 'VerifyEmailPage'),
});
const inviteRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/invite/$token',
  component: lazyRouteComponent(() => import('../features/auth/invite-page'), 'InvitePage'),
});
const mfaRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/mfa',
  component: lazyRouteComponent(() => import('../features/auth/mfa-page'), 'MfaPage'),
});
const qrRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/r/$token',
  component: lazyRouteComponent(() => import('../features/qr/qr-landing-page'), 'QrLandingPage'),
});
const trackRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/t/$token',
  component: lazyRouteComponent(() => import('../features/qr/track-page'), 'TrackPage'),
});
const noAccessRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: '/no-access',
  component: lazyRouteComponent(() => import('../features/auth/no-access-page'), 'NoAccessPage'),
});

/* Printable pages, outside any shell */

const printQrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/print/qr/$siteId',
  component: lazyRouteComponent(() => import('../features/setup/qr-sheet-page'), 'QrSheetPage'),
});

/* Supervisor console */

const consoleLayout = createRoute({ getParentRoute: () => rootRoute, path: '/app', component: ConsoleShell });
const consoleIndex = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/app/incidents', replace: true });
  },
});
const incidentsRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/incidents',
  validateSearch: incidentsSearch,
  component: lazyRouteComponent(() => import('../features/incidents/incidents-page'), 'IncidentsPage'),
});
const reassignmentsRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/reassignments',
  component: lazyRouteComponent(() => import('../features/incidents/reassignments-page'), 'ReassignmentsPage'),
});
const dashboardRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/dashboard',
  component: lazyRouteComponent(() => import('../features/dashboard/dashboard-page'), 'DashboardPage'),
});
const teamRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/team',
  validateSearch: teamSearch,
  component: lazyRouteComponent(() => import('../features/team/team-page'), 'TeamPage'),
});
const sitesRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/sites',
  component: lazyRouteComponent(() => import('../features/setup/sites-page'), 'SitesPage'),
});
const categoriesRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/categories',
  component: lazyRouteComponent(() => import('../features/setup/categories-page'), 'CategoriesPage'),
});
const settingsRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/settings',
  component: lazyRouteComponent(() => import('../features/setup/settings-page'), 'SettingsPage'),
});
const auditRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/audit',
  validateSearch: auditSearch,
  component: lazyRouteComponent(() => import('../features/audit/audit-page'), 'AuditPage'),
});
const consoleNotificationsRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/notifications',
  component: lazyRouteComponent(() => import('../features/notifications/notifications-page'), 'NotificationsPage'),
});
const consoleAccountRoute = createRoute({
  getParentRoute: () => consoleLayout,
  path: '/account',
  component: lazyRouteComponent(() => import('../features/account/account-page'), 'AccountPage'),
});

/* Field app for employees and intervenants */

const fieldLayout = createRoute({ getParentRoute: () => rootRoute, path: '/field', component: FieldShell });
const fieldIndex = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/',
  component: HomeRedirect,
});
const reportRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/report',
  validateSearch: reportSearch,
  component: lazyRouteComponent(() => import('../features/field/report-page'), 'ReportPage'),
});
const myIncidentsRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/incidents',
  component: lazyRouteComponent(() => import('../features/field/my-incidents-page'), 'MyIncidentsPage'),
});
const fieldIncidentRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/incidents/$reference',
  validateSearch: fieldIncidentSearch,
  component: lazyRouteComponent(() => import('../features/field/field-incident-page'), 'FieldIncidentPage'),
});
const myWorkRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/work',
  component: lazyRouteComponent(() => import('../features/field/my-work-page'), 'MyWorkPage'),
});
const fieldNotificationsRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/notifications',
  component: lazyRouteComponent(() => import('../features/notifications/notifications-page'), 'NotificationsPage'),
});
const fieldProfileRoute = createRoute({
  getParentRoute: () => fieldLayout,
  path: '/profile',
  component: lazyRouteComponent(() => import('../features/account/account-page'), 'AccountPage'),
});

/* Platform administration */

const platformLayout = createRoute({ getParentRoute: () => rootRoute, path: '/platform', component: PlatformShell });
const platformIndex = createRoute({
  getParentRoute: () => platformLayout,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/platform/organizations', replace: true });
  },
});
const platformOrganizationsRoute = createRoute({
  getParentRoute: () => platformLayout,
  path: '/organizations',
  validateSearch: platformOrgSearch,
  component: lazyRouteComponent(() => import('../features/platform/organizations-page'), 'PlatformOrganizationsPage'),
});
const platformOrganizationRoute = createRoute({
  getParentRoute: () => platformLayout,
  path: '/organizations/$organizationId',
  component: lazyRouteComponent(() => import('../features/platform/organization-page'), 'PlatformOrganizationPage'),
});
const platformRegistrationsRoute = createRoute({
  getParentRoute: () => platformLayout,
  path: '/registrations',
  component: lazyRouteComponent(() => import('../features/platform/registrations-page'), 'PlatformRegistrationsPage'),
});
const platformAuditRoute = createRoute({
  getParentRoute: () => platformLayout,
  path: '/audit',
  component: lazyRouteComponent(() => import('../features/platform/audit-page'), 'PlatformAuditPage'),
});
const platformAccountRoute = createRoute({
  getParentRoute: () => platformLayout,
  path: '/account',
  component: lazyRouteComponent(() => import('../features/account/account-page'), 'AccountPage'),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  printQrRoute,
  publicLayout.addChildren([
    loginRoute,
    forgotRoute,
    resetRoute,
    registerRoute,
    verifyRoute,
    inviteRoute,
    qrRoute,
    trackRoute,
    mfaRoute,
    noAccessRoute,
  ]),
  consoleLayout.addChildren([
    consoleIndex,
    incidentsRoute,
    reassignmentsRoute,
    dashboardRoute,
    teamRoute,
    sitesRoute,
    categoriesRoute,
    settingsRoute,
    auditRoute,
    consoleNotificationsRoute,
    consoleAccountRoute,
  ]),
  fieldLayout.addChildren([
    fieldIndex,
    reportRoute,
    myIncidentsRoute,
    fieldIncidentRoute,
    myWorkRoute,
    fieldNotificationsRoute,
    fieldProfileRoute,
  ]),
  platformLayout.addChildren([
    platformIndex,
    platformOrganizationsRoute,
    platformOrganizationRoute,
    platformRegistrationsRoute,
    platformAuditRoute,
    platformAccountRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: RouteLoading,
  defaultPendingMs: 150,
  defaultErrorComponent: RouteError,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
