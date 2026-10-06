import { Outlet, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Logo } from '../../components/ui/layout';
import { Toaster } from '../../components/ui/toast';
import { TooltipProvider } from '../../components/ui/tooltip';
import { useT } from '../../i18n';
import { ApiError } from '../../lib/api';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function RootLayout() {
  const { t } = useT();
  const online = useOnline();
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-[95] flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-xs font-medium text-on-primary">
          <WifiOff className="size-3.5" aria-hidden />
          {t('common.offline')}
        </div>
      )}
      <Outlet />
      <Toaster />
    </TooltipProvider>
  );
}

/** Matches the shape of a typical page so nothing jumps when content arrives. */
export function RouteLoading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

export function NotFound() {
  const { t } = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6">
      <Logo className="mb-6" />
      <EmptyState
        title={t('common.notFoundTitle')}
        description={t('common.notFoundBody')}
        action={
          <Button variant="primary" onClick={() => window.location.assign('/')}>
            {t('common.goHome')}
          </Button>
        }
      />
    </div>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useT();
  const router = useRouter();
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return <EmptyState className="py-24" title={t('common.notFoundTitle')} description={t('common.notFoundBody')} />;
  }
  return (
    <EmptyState
      className="py-24"
      title={t('common.errorTitle')}
      description={
        <>
          {t('common.errorBody')}
          {requestId && <span className="mt-2 block text-xs text-ink-3">{t('common.requestId', { id: requestId })}</span>}
        </>
      }
      action={
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          {t('common.retry')}
        </Button>
      }
    />
  );
}
