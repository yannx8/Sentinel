import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applyAction, ApiError, type IncidentAction } from './actions';
import { directory, seedIncidents, supervisorName } from './seed';
import type { Incident } from './types';

/**
 * In-memory stand-in for the API (milestone R2 replaces this file's fetchers
 * with the typed client in @sentinel/shared). The hooks below stay as they are.
 */
const db = new Map<string, Incident>(seedIncidents.map((i) => [i.reference, structuredClone(i)]));
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchIncidents = async (): Promise<Incident[]> => {
  await delay(180);
  return [...db.values()].map((i) => structuredClone(i));
};

const postAction = async (vars: { reference: string; expectedVersion: number; action: IncidentAction }): Promise<Incident> => {
  await delay(260);
  const current = db.get(vars.reference);
  if (!current) throw new ApiError('NOT_FOUND', 'That incident no longer exists.');
  if (current.version !== vars.expectedVersion) {
    throw new ApiError('CONFLICT_CONCURRENT_UPDATE', 'Someone updated this incident just now.');
  }
  const next = applyAction(current, vars.action, supervisorName, Date.now());
  db.set(next.reference, next);
  return structuredClone(next);
};

export const incidentsKey = ['incidents'] as const;

export const useIncidents = () => useQuery({ queryKey: incidentsKey, queryFn: fetchIncidents });

export const useDirectory = () => directory;

/** `expectedVersion` is read by the caller BEFORE the optimistic update bumps the cached version. */
type Vars = { reference: string; action: IncidentAction; expectedVersion: number };

/** Optimistic: the cache moves first, rolls back with a message on failure. */
export function useIncidentAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Vars) => postAction(vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: incidentsKey });
      const previous = qc.getQueryData<Incident[]>(incidentsKey);
      qc.setQueryData<Incident[]>(incidentsKey, (list) =>
        list?.map((i) => (i.reference === vars.reference ? applyAction(i, vars.action, supervisorName, Date.now()) : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(incidentsKey, ctx.previous);
    },
    onSuccess: (server) => {
      qc.setQueryData<Incident[]>(incidentsKey, (list) => list?.map((i) => (i.reference === server.reference ? server : i)));
    },
  });
}
