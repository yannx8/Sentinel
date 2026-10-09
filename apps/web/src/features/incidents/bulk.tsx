import {
  priorities,
  type BulkIncidentsInput,
  type BulkIncidentsResult,
  type IncidentListItem,
  type Priority,
} from '@sentinel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PriorityLabel } from '../../components/domain/glyphs';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../components/ui/menu';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api, newIdempotencyKey } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { incidentKeys, useCandidates } from '../../lib/incidents';
import { Candidate } from './assign-dialog';

function useBulk(onDone: () => void) {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkIncidentsInput) =>
      api.post<BulkIncidentsResult>('/incidents/bulk', body, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['incident'] });
      if (result.failed.length === 0) toast.success(t('incidents.bulk.done', { count: result.done.length }));
      else {
        toast.error(t('incidents.bulk.partial', { done: result.done.length, failed: result.failed.length }), {
          description: result.failed
            .slice(0, 3)
            .map((f) => t('incidents.bulk.failedLine', { reference: f.reference, message: f.message }))
            .join('\n'),
        });
      }
      onDone();
    },
    onError: (error) => toastError(error, t),
  });
}

/** Actions for the incidents ticked in the list. Each incident is checked on its own, so some can fail. */
export function BulkBar({ items, onClear }: { items: IncidentListItem[]; onClear: () => void }) {
  const { t } = useT();
  const [assigning, setAssigning] = useState(false);
  const bulk = useBulk(onClear);

  const setPriority = (priority: Priority) =>
    bulk.mutate({
      action: 'priority',
      priority,
      items: items.map((i) => ({ reference: i.reference, expectedVersion: i.version, categoryId: i.category.id })),
    });

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-subtle px-4 py-2" role="region">
      <span className="text-sm font-medium text-ink">{t('incidents.bulk.selected', { count: items.length })}</span>
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" loading={bulk.isPending}>
            {t('incidents.bulk.priority')}
          </Button>
        </MenuTrigger>
        <MenuContent align="start" className="w-44">
          {[...priorities].reverse().map((priority) => (
            <MenuItem key={priority} onSelect={() => setPriority(priority)}>
              <PriorityLabel priority={priority} />
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Button size="sm" onClick={() => setAssigning(true)}>
        {t('incidents.bulk.assign')}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {t('incidents.bulk.clear')}
      </Button>
      <BulkAssignDialog
        items={items}
        open={assigning}
        onOpenChange={setAssigning}
        onDone={() => {
          setAssigning(false);
          onClear();
        }}
      />
    </div>
  );
}

function BulkAssignDialog({
  items,
  open,
  onOpenChange,
  onDone,
}: {
  items: IncidentListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const first = items[0];
  // ponytail: eligibility is shown for the first incident only; the server rejects the others one by one.
  const candidates = useCandidates(first?.reference, open);
  const [selected, setSelected] = useState<string | null>(null);
  const bulk = useBulk(onDone);
  const list = candidates.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={t('incidents.bulk.assignTitle', { count: items.length })}
        description={t('incidents.bulk.assignDescription', { reference: first?.reference ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!selected}
              loading={bulk.isPending}
              onClick={() =>
                selected &&
                bulk.mutate({
                  action: 'assign',
                  intervenantMembershipId: selected,
                  items: items.map((i) => ({ reference: i.reference, expectedVersion: i.version })),
                })
              }
            >
              {t('incidents.bulk.assignSubmit')}
            </Button>
          </>
        }
      >
        {candidates.isPending ? (
          <Skeleton className="h-[66px] w-full rounded-md" />
        ) : list.length === 0 ? (
          <EmptyState title={t('incidents.assign.noCandidates')} className="py-8" />
        ) : (
          <div
            role="radiogroup"
            aria-label={t('incidents.assign.candidates')}
            className="grid max-h-[360px] gap-2 overflow-y-auto"
          >
            {list.map((candidate) => (
              <Candidate
                key={candidate.membershipId}
                candidate={candidate}
                selected={candidate.membershipId === selected}
                best={false}
                onSelect={() => setSelected(candidate.membershipId)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
