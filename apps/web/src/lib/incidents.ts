import type { CandidateDTO, IncidentDetail, ThreadEvent } from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '../components/ui/toast';
import { useT } from '../i18n';
import { api, ApiError, newIdempotencyKey } from './api';
import { toastError } from './forms';

/** Query keys for incident data. Lists and counts share the 'incidents' prefix. */
export const incidentKeys = {
  all: ['incidents'] as const,
  list: (params: Record<string, unknown>) => ['incidents', 'list', params] as const,
  counts: ['incidents', 'counts'] as const,
  detail: (key: string) => ['incident', key] as const,
  thread: (key: string) => ['incident', key, 'thread'] as const,
  candidates: (key: string) => ['incident', key, 'candidates'] as const,
  /** Under 'me': person-scoped, so it survives an organization switch. */
  myWork: ['me', 'work'] as const,
  myHistory: ['me', 'incidents'] as const,
};

export function useIncident(key: string | undefined) {
  return useQuery({
    queryKey: incidentKeys.detail(key ?? ''),
    queryFn: () => api.get<IncidentDetail>(`/incidents/${encodeURIComponent(key ?? '')}`),
    enabled: !!key,
    refetchInterval: 30_000,
  });
}

export function useThread(key: string | undefined) {
  return useQuery({
    queryKey: incidentKeys.thread(key ?? ''),
    queryFn: () => api.get<ThreadEvent[]>(`/incidents/${encodeURIComponent(key ?? '')}/thread`),
    enabled: !!key,
    refetchInterval: 30_000,
  });
}

export function useCandidates(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: incidentKeys.candidates(key ?? ''),
    queryFn: () => api.get<CandidateDTO[]>(`/incidents/${encodeURIComponent(key ?? '')}/candidates`),
    enabled: !!key && enabled,
    staleTime: 0,
  });
}

type ActionInput = {
  /** API path, for example `/incidents/INC-2026-00042/assign` or `/assignments/<id>/accept`. */
  path: string;
  body?: Record<string, unknown>;
  /** Toast shown on success. Same verb as the button. */
  success?: string;
};

/**
 * Runs an incident transition: one idempotency key per attempt, the returned
 * incident replaces the cached one, and lists, thread and counts refresh.
 * A version conflict reloads the incident and explains what happened.
 */
export function useIncidentAction() {
  const { t } = useT();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ path, body }: ActionInput) =>
      api.post<IncidentDetail>(path, body ?? {}, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (incident, input) => {
      queryClient.setQueryData(incidentKeys.detail(incident.reference), incident);
      void queryClient.invalidateQueries({ queryKey: incidentKeys.thread(incident.reference) });
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      void queryClient.invalidateQueries({ queryKey: incidentKeys.myWork });
      void queryClient.invalidateQueries({ queryKey: incidentKeys.myHistory });
      void queryClient.invalidateQueries({ queryKey: ['reassignments'] });
      if (input.success) toast.success(input.success);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.code === 'CONFLICT_CONCURRENT_UPDATE' || error.code === 'INVALID_STATE_TRANSITION')
      ) {
        void queryClient.invalidateQueries({ queryKey: ['incident'] });
        void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      }
      toastError(error, t);
    },
  });
}

/** Posts a comment and refreshes the Thread. */
export function useAddComment(key: string) {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; visibility: 'PUBLIC' | 'INTERNAL' }) =>
      api.post<ThreadEvent>(`/incidents/${encodeURIComponent(key)}/comments`, input),
    onSuccess: (event) => {
      queryClient.setQueryData<ThreadEvent[]>(incidentKeys.thread(key), (events) =>
        events ? [...events, event] : [event],
      );
      void queryClient.invalidateQueries({ queryKey: incidentKeys.thread(key) });
    },
    onError: (error) => toastError(error, t),
  });
}

/** Uploads one photo to an incident. */
export function useUploadPhoto(key: string) {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind?: 'EVIDENCE' | 'PROGRESS' }) => {
      const data = new FormData();
      data.append('file', file);
      if (kind) data.append('kind', kind);
      return api.post(`/incidents/${encodeURIComponent(key)}/attachments`, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(key) });
      void queryClient.invalidateQueries({ queryKey: incidentKeys.thread(key) });
    },
    onError: (error) => toastError(error, t),
  });
}
