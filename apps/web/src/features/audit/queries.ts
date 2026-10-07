import { auditEventTypes, type ApiErrorBody, type AuditEntryDTO, type AuditEventType } from '@sentinel/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { api, apiUrl, ApiError } from '../../lib/api';

export type AuditFilters = {
  type?: AuditEventType;
  incident?: string;
  actor?: string;
  from?: string;
  to?: string;
};

type RawSearch = { type?: string; incident?: string; actor?: string; from?: string; to?: string };

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

/** Turns the URL search into filters the API accepts. Anything malformed is ignored rather than sent. */
export function filtersFromSearch(search: RawSearch): AuditFilters {
  const type = (auditEventTypes as readonly string[]).includes(search.type ?? '') ? (search.type as AuditEventType) : undefined;
  const from = search.from && isoDay.test(search.from) ? search.from : undefined;
  const to = search.to && isoDay.test(search.to) ? search.to : undefined;
  return {
    type,
    incident: search.incident?.trim() || undefined,
    actor: search.actor || undefined,
    from,
    // An inverted range would return nothing; the filter bar flags it instead.
    to: from && to && to < from ? undefined : to,
  };
}

export function hasFilters(filters: AuditFilters) {
  return Object.values(filters).some((value) => value !== undefined);
}

function toQuery(filters: AuditFilters) {
  return { type: filters.type, incident: filters.incident, actorId: filters.actor, from: filters.from, to: filters.to };
}

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => ['audit', 'list', filters] as const,
};

const PAGE_SIZE = 50;

export function useAuditLog(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      api.page<AuditEntryDTO>('/audit', { query: { ...toQuery(filters), cursor: pageParam, limit: PAGE_SIZE }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.page.hasMore ? (last.page.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
  });
}

function fileNameFrom(disposition: string | null) {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : `sentinel-audit-${new Date().toISOString().slice(0, 10)}.csv`;
}

/**
 * Downloads the CSV export with the same filters. An anchor cannot send the
 * X-Org-Id header, so the file is fetched with the session cookie and saved as a Blob.
 */
export async function downloadAuditCsv(filters: AuditFilters, orgId: string) {
  // A network failure rejects here and is reported with the generic message.
  const response = await fetch(apiUrl('/audit/export.csv', toQuery(filters)), {
    credentials: 'include',
    headers: { 'X-Org-Id': orgId, Accept: 'text/csv' },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: ApiErrorBody } | null;
    if (payload?.error) throw new ApiError(payload.error, response.status);
    throw new Error(`Export failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileNameFrom(response.headers.get('Content-Disposition'));
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
