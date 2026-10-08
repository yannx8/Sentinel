import type { Availability, CategoryDTO, IncidentListItem, MembershipRole, Page, SiteDTO } from '@sentinel/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { incidentKeys } from '../../lib/incidents';

/**
 * GET /membership. Not in the shared DTOs yet. `homeSite` is read when the API
 * starts sending it for employees, so the report form can list that site first.
 */
export type MembershipSelf = {
  id: string;
  role: MembershipRole;
  isOwner: boolean;
  availability: Availability | null;
  companyName: string | null;
  homeSite?: { id: string; name: string } | null;
};

export const fieldKeys = {
  categories: ['categories'] as const,
  sites: ['sites'] as const,
  membership: ['membership'] as const,
  /** Under the 'incidents' prefix so incident mutations refresh it. */
  mine: incidentKeys.list({ scope: 'field', view: 'all', sort: 'newest' }),
  lastReported: incidentKeys.list({ scope: 'field-last', view: 'all', sort: 'newest', limit: 1 }),
};

const activeOnly = <T extends { isActive: boolean }>(items: T[]) => items.filter((item) => item.isActive);
const firstSite = (page: Page<IncidentListItem>) => page.data[0]?.site ?? null;

/** Active categories an employee can report under. */
export function useActiveCategories() {
  return useQuery({
    queryKey: fieldKeys.categories,
    queryFn: ({ signal }) => api.get<CategoryDTO[]>('/categories', { signal }),
    select: activeOnly<CategoryDTO>,
    staleTime: 5 * 60_000,
  });
}

/** Active sites the person can report on or work at. */
export function useActiveSites() {
  return useQuery({
    queryKey: fieldKeys.sites,
    queryFn: ({ signal }) => api.get<SiteDTO[]>('/sites', { signal }),
    select: activeOnly<SiteDTO>,
    staleTime: 5 * 60_000,
  });
}

export function useMembershipSelf() {
  return useQuery({
    queryKey: fieldKeys.membership,
    queryFn: ({ signal }) => api.get<MembershipSelf>('/membership', { signal }),
  });
}

/** The site of the employee's latest report, used when no home site is known. */
export function useLastReportedSite(enabled: boolean) {
  return useQuery({
    queryKey: fieldKeys.lastReported,
    queryFn: ({ signal }) =>
      api.page<IncidentListItem>('/incidents', { query: { view: 'all', sort: 'newest', limit: 1 }, signal }),
    select: firstSite,
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Employees: incidents they reported. Intervenants: incidents they worked on. The API scopes both. */
export function useFieldIncidents() {
  return useInfiniteQuery({
    queryKey: fieldKeys.mine,
    queryFn: ({ pageParam, signal }) =>
      api.page<IncidentListItem>('/incidents', { query: { view: 'all', sort: 'newest', cursor: pageParam }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.page.hasMore ? (last.page.nextCursor ?? undefined) : undefined),
    refetchInterval: 60_000,
  });
}

/** Intervenants: every incident they worked on, in every organization they serve, latest activity first. */
export function useMyHistory() {
  return useInfiniteQuery({
    queryKey: incidentKeys.myHistory,
    queryFn: ({ pageParam, signal }) =>
      api.page<IncidentListItem>('/me/incidents', { query: { sort: 'updated', cursor: pageParam }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.page.hasMore ? (last.page.nextCursor ?? undefined) : undefined),
    refetchInterval: 60_000,
  });
}

/** Live assignments across every organization the intervenant serves. */
export function useMyWork() {
  return useQuery({
    queryKey: incidentKeys.myWork,
    queryFn: ({ signal }) => api.get<IncidentListItem[]>('/me/assignments', { signal }),
    refetchInterval: 30_000,
  });
}

/** Optimistic availability change for every organization at once, rolled back if the server refuses it. */
export function useSetAvailability() {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (availability: Availability) => {
      await api.patch('/me/availability', { availability });
      return api.get<MembershipSelf>('/membership');
    },
    onMutate: async (availability) => {
      await queryClient.cancelQueries({ queryKey: fieldKeys.membership });
      const previous = queryClient.getQueryData<MembershipSelf>(fieldKeys.membership);
      if (previous) queryClient.setQueryData<MembershipSelf>(fieldKeys.membership, { ...previous, availability });
      return { previous };
    },
    onSuccess: (membership, availability) => {
      queryClient.setQueryData(fieldKeys.membership, membership);
      toast.success(t('field.work.availabilitySet', { value: t(`common.availability.${availability}`) }));
    },
    onError: (error, _availability, context) => {
      if (context?.previous) queryClient.setQueryData(fieldKeys.membership, context.previous);
      toastError(error, t);
    },
  });
}
