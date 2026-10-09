import type {
  AreaDTO,
  CategoryDTO,
  OrganizationSettings,
  Priority,
  SiteAreasDTO,
  SiteDTO,
  SpecialtyDTO,
  UpdateOrganizationInput,
} from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { meQueryKey } from '../../app/session';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { incidentKeys } from '../../lib/incidents';

/**
 * Query keys for the catalog and the organization settings. `sites` and
 * `categories` are shared with the field app, `specialties` with Team.
 */
export const setupKeys = {
  sites: ['sites'] as const,
  categories: ['categories'] as const,
  specialties: ['specialties'] as const,
  settings: ['organization', 'settings'] as const,
};

/** Owned by the dashboard: the first-run checklist and the figures by site and category. */
const dashboardKeys = {
  checklist: ['organization', 'setup'] as const,
  all: ['dashboard'] as const,
};

/** Optional text travels as '' to clear it: the API keeps the stored value when a key is left out. */
export type SiteBody = {
  code: string;
  name: string;
  address: string;
  city: string;
  contactName: string;
  contactPhone: string;
  latitude: number | null;
  longitude: number | null;
  landmark: string;
  guestReporting: boolean;
};
export type SitePatch = Partial<SiteBody> & { isActive?: boolean };

export type CategoryBody = { name: string; defaultPriority: Priority; specialtyId: string | null };
export type CategoryPatch = Partial<CategoryBody> & { isActive?: boolean };

function refresh(queryClient: QueryClient, keys: QueryKey[]) {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

/** Replaces the entry with the same id, or appends it. Leaves an unloaded list alone. */
function upsert<T extends { id: string }>(list: T[] | undefined, item: T): T[] | undefined {
  if (!list) return list;
  return list.some((entry) => entry.id === item.id)
    ? list.map((entry) => (entry.id === item.id ? item : entry))
    : [...list, item];
}

/** Fields of `next` that differ from `previous`, for PATCH bodies that only carry real changes. */
export function changedFields<T extends object>(next: T, previous: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (next[key] !== previous[key]) patch[key] = next[key];
  }
  return patch;
}

/* Reads */

export function useSites() {
  return useQuery({
    queryKey: setupKeys.sites,
    queryFn: ({ signal }) => api.get<SiteDTO[]>('/sites', { signal }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: setupKeys.categories,
    queryFn: ({ signal }) => api.get<CategoryDTO[]>('/categories', { signal }),
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: setupKeys.specialties,
    queryFn: ({ signal }) => api.get<SpecialtyDTO[]>('/specialties', { signal }),
  });
}

export function useOrganizationSettings() {
  return useQuery({
    queryKey: setupKeys.settings,
    queryFn: ({ signal }) => api.get<OrganizationSettings>('/organization', { signal }),
  });
}

/* Sites */

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: SiteBody; idempotencyKey: string }) =>
      api.post<SiteDTO>('/sites', body, { idempotencyKey }),
    onSuccess: (site) => {
      queryClient.setQueryData<SiteDTO[]>(setupKeys.sites, (list) => upsert(list, site));
      refresh(queryClient, [setupKeys.sites, dashboardKeys.checklist]);
    },
  });
}

/** Edits, deactivates or reactivates a site. Its name and code also show in incident lists and the dashboard. */
export function useUpdateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SitePatch }) => api.patch<SiteDTO>(`/sites/${id}`, patch),
    onSuccess: (site) => {
      queryClient.setQueryData<SiteDTO[]>(setupKeys.sites, (list) => upsert(list, site));
      refresh(queryClient, [setupKeys.sites, dashboardKeys.checklist, dashboardKeys.all, incidentKeys.all]);
    },
  });
}

/* Categories */

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CategoryBody; idempotencyKey: string }) =>
      api.post<CategoryDTO>('/categories', body, { idempotencyKey }),
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryDTO[]>(setupKeys.categories, (list) => upsert(list, category));
      refresh(queryClient, [setupKeys.categories, setupKeys.specialties, dashboardKeys.checklist]);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CategoryPatch }) =>
      api.patch<CategoryDTO>(`/categories/${id}`, patch),
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryDTO[]>(setupKeys.categories, (list) => upsert(list, category));
      refresh(queryClient, [
        setupKeys.categories,
        setupKeys.specialties,
        dashboardKeys.checklist,
        dashboardKeys.all,
        incidentKeys.all,
      ]);
    },
  });
}

const toggleCategoryKey = ['categories', 'toggle'] as const;

function setCategoryActive(queryClient: QueryClient, id: string, isActive: boolean) {
  queryClient.setQueryData<CategoryDTO[]>(setupKeys.categories, (list) =>
    list?.map((entry) => (entry.id === id ? { ...entry, isActive } : entry)),
  );
}

/**
 * The switch in the categories table. Flips the row at once and rolls only
 * that row back on failure. The list is refetched once the last toggle settles,
 * so quick toggles on several rows never overwrite each other.
 */
export function useToggleCategory() {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: toggleCategoryKey,
    mutationFn: ({ category, isActive }: { category: CategoryDTO; isActive: boolean }) =>
      api.patch<CategoryDTO>(`/categories/${category.id}`, { isActive }),
    onMutate: async ({ category, isActive }) => {
      await queryClient.cancelQueries({ queryKey: setupKeys.categories, exact: true });
      setCategoryActive(queryClient, category.id, isActive);
    },
    onError: (error, { category }) => {
      setCategoryActive(queryClient, category.id, category.isActive);
      toastError(error, t);
    },
    onSuccess: (category) => {
      queryClient.setQueryData<CategoryDTO[]>(setupKeys.categories, (list) => upsert(list, category));
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: toggleCategoryKey }) > 1) return;
      refresh(queryClient, [setupKeys.categories, dashboardKeys.checklist]);
    },
  });
}

/* Specialties */

export function useCreateSpecialty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, idempotencyKey }: { name: string; idempotencyKey: string }) =>
      api.post<SpecialtyDTO>('/specialties', { name }, { idempotencyKey }),
    onSuccess: (specialty) => {
      queryClient.setQueryData<SpecialtyDTO[]>(setupKeys.specialties, (list) =>
        upsert(list, specialty)?.sort((a, b) => a.name.localeCompare(b.name)),
      );
      refresh(queryClient, [setupKeys.specialties]);
    },
  });
}

/* Settings */

/**
 * Saves the settings form (owner only). The session carries the display name,
 * time zone and language, open case files carry the photo rule, and the
 * dashboard counts days in the organization's time zone, so all three refresh.
 */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) => api.patch<OrganizationSettings>('/organization', input),
    onSuccess: (settings) => {
      queryClient.setQueryData(setupKeys.settings, settings);
      refresh(queryClient, [meQueryKey, ['incident'], dashboardKeys.all]);
    },
  });
}

/* Areas and QR codes */

export function useSiteAreas(siteId: string) {
  return useQuery({
    queryKey: ['site-areas', siteId],
    queryFn: ({ signal }) => api.get<SiteAreasDTO>(`/sites/${siteId}/areas`, { signal }),
  });
}

export function useAreaMutations(siteId: string) {
  const queryClient = useQueryClient();
  const { t } = useT();
  const options = {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-areas', siteId] }),
    onError: (error: unknown) => toastError(error, t),
  };
  return {
    add: useMutation({
      mutationFn: (name: string) => api.post<AreaDTO>(`/sites/${siteId}/areas`, { name }),
      ...options,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: { name?: string; isActive?: boolean } }) =>
        api.patch<AreaDTO>(`/sites/${siteId}/areas/${id}`, patch),
      ...options,
    }),
  };
}
