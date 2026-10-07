import type { DashboardDTO, SetupChecklist } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

/** Query keys for the dashboard. Incident mutations may invalidate `dashboardKeys.all`. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  setup: ['organization', 'setup'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: () => api.get<DashboardDTO>('/dashboard'),
    refetchInterval: 60_000,
  });
}

export function useSetupChecklist() {
  return useQuery({
    queryKey: dashboardKeys.setup,
    queryFn: () => api.get<SetupChecklist>('/organization/setup'),
    staleTime: 60_000,
  });
}
