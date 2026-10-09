import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app/router';
import { SessionProvider } from './app/session';
import { ApiError } from './lib/api';
import { OfflineSync, SignOutGuard } from './lib/offline-sync';
import { PwaUpdates } from './lib/pwa';
import './styles/app.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => {
        if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
        <PwaUpdates />
        <OfflineSync />
        <SignOutGuard />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
