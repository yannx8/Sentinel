import { useQueryClient } from '@tanstack/react-query';
import { ApiError, type IncidentAction } from '../../data/actions';
import { incidentsKey, useIncidentAction } from '../../data/queries';
import type { Incident } from '../../data/types';
import { useToast } from '../../components/ui/Toast';

const message = (err: unknown): string => {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'CONFLICT_CONCURRENT_UPDATE':
        return 'Someone updated this incident just now. The latest version is loaded. Review it, then try again.';
      case 'INVALID_STATE_TRANSITION':
        return 'That is no longer possible because the incident has moved on. The latest version is loaded.';
      case 'NOT_FOUND':
        return 'That incident no longer exists.';
      case 'VALIDATION_FAILED':
        return err.message;
    }
  }
  return 'Something went wrong and nothing was changed. Try again.';
};

export type RunOptions = { success: string; undo?: IncidentAction };

/** Runs an action optimistically, then confirms with a toast (with Undo where it is safe) or explains the failure. */
export function useActionRunner() {
  const mutation = useIncidentAction();
  const toast = useToast();
  const qc = useQueryClient();

  const run = (reference: string, action: IncidentAction, opts: RunOptions): void => {
    const expectedVersion = qc.getQueryData<Incident[]>(incidentsKey)?.find((i) => i.reference === reference)?.version ?? 0;
    mutation.mutate(
      { reference, action, expectedVersion },
      {
        onSuccess: () =>
          toast({
            message: opts.success,
            actionLabel: opts.undo ? 'Undo' : undefined,
            onAction: opts.undo ? () => run(reference, opts.undo as IncidentAction, { success: 'Undone' }) : undefined,
          }),
        onError: (err) => {
          void qc.invalidateQueries({ queryKey: incidentsKey });
          toast({ message: message(err), tone: 'critical' });
        },
      },
    );
  };

  return run;
}
