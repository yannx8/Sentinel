import { createRootRoute, createRoute, createRouter, Link, redirect } from '@tanstack/react-router';
import { Shell, sections } from '../components/layout/Shell';
import { isViewId, type ViewId } from '../features/triage/state';
import { TriageDesk } from '../features/triage/TriageDesk';
import { DesignPage } from './DesignPage';

const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: () => (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-[44ch] text-center">
        <h1 className="font-display text-title-md font-semibold text-ink">That page does not exist</h1>
        <p className="mt-1 text-base text-ink-2">The link may be old or mistyped.</p>
        <Link to="/app/triage" className="mt-4 inline-block text-base font-medium text-brand underline underline-offset-4">
          Go to the Triage desk
        </Link>
      </div>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/app/triage' });
  },
});

type TriageSearch = { incident?: string; view?: ViewId; q?: string };

const triageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/triage',
  validateSearch: (s: Record<string, unknown>): TriageSearch => ({
    incident: typeof s.incident === 'string' && s.incident ? s.incident : undefined,
    view: isViewId(s.view) && s.view !== 'attention' ? s.view : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
  }),
  component: TriageDesk,
});

function Planned() {
  const { section } = sectionRoute.useParams();
  const info = sections.find((s) => s.slug === section);
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-[52ch]">
        <h1 className="font-display text-title-lg font-semibold text-ink">{info?.label ?? 'Not found'}</h1>
        <p className="mt-2 text-md text-ink-2">{info ? info.blurb : 'This section does not exist.'}</p>
        {info ? (
          <p className="mt-4 rounded-panel border border-border bg-surface px-4 py-3 text-base text-ink-2">
            This page is planned for milestone {info.milestone} of the rebuild. The Triage desk is the part that works today.
          </p>
        ) : null}
        <Link to="/app/triage" className="mt-5 inline-block text-base font-medium text-brand underline underline-offset-4">
          Back to the Triage desk
        </Link>
      </div>
    </div>
  );
}

const sectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app/$section',
  component: Planned,
});

const designRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/design',
  component: DesignPage,
});

const routeTree = rootRoute.addChildren([indexRoute, triageRoute, sectionRoute, designRoute]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
