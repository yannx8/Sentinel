import type { IncidentListItem } from '@sentinel/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { incidentKeys } from '../../lib/incidents';
import type { IncidentsSearch } from '../../app/router';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Search params in the URL map one to one onto the API filters. */
export function listParams(search: IncidentsSearch) {
  return {
    view: search.view ?? 'attention',
    q: search.q,
    priority: search.priority,
    siteId: search.site,
    categoryId: search.category,
    assigneeId: search.assignee,
    sort: search.sort,
  };
}

export function hasFilters(search: IncidentsSearch) {
  return !!(search.q || search.priority || search.site || search.category || search.assignee);
}

export function useIncidentList(search: IncidentsSearch) {
  const params = listParams(search);
  const query = useInfiniteQuery({
    queryKey: incidentKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.page<IncidentListItem>('/incidents', { query: { ...params, cursor: pageParam, limit: 50 } }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
    refetchInterval: 20_000,
  });
  return { ...query, items: query.data?.pages.flatMap((page) => page.data) ?? [] };
}
