import type { ReassignmentRequestDTO } from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PriorityLabel } from '../../components/domain/glyphs';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Textarea } from '../../components/ui/input';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { incidentKeys, useIncident } from '../../lib/incidents';
import { AssignDialog } from './assign-dialog';

function ReassignDialog({ reference, onClose }: { reference: string; onClose: () => void }) {
  const incident = useIncident(reference);
  if (!incident.data) return null;
  return <AssignDialog incident={incident.data} open onOpenChange={(open) => !open && onClose()} />;
}

function KeepDialog({ request, onClose }: { request: ReassignmentRequestDTO; onClose: () => void }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const keep = useMutation({
    mutationFn: () => api.post(`/reassignments/${request.assignmentId}/reject`, { note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success(
        t('incidents.reassignments.kept', { name: request.intervenant.name, reference: request.incident.reference }),
      );
      void queryClient.invalidateQueries({ queryKey: ['reassignments'] });
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['incident'] });
      onClose();
    },
    onError: (error) => toastError(error, t),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        title={t('incidents.reassignments.keepTitle', {
          name: request.intervenant.name,
          reference: request.incident.reference,
        })}
        description={t('incidents.reassignments.keepBody')}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={keep.isPending} onClick={() => keep.mutate()}>
              {t('incidents.reassignments.keepSubmit')}
            </Button>
          </>
        }
      >
        <Field label={t('incidents.reassignments.note')} optional>
          <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

export function ReassignmentsPage() {
  const { t, relative } = useT();
  const [reassign, setReassign] = useState<string | null>(null);
  const [keep, setKeep] = useState<ReassignmentRequestDTO | null>(null);
  const query = useQuery({
    queryKey: ['reassignments'],
    queryFn: () => api.get<ReassignmentRequestDTO[]>('/reassignments'),
    refetchInterval: 30_000,
  });
  const rows = query.data ?? [];

  return (
    <Page>
      <PageHeader title={t('incidents.reassignments.title')} description={t('incidents.reassignments.description')} />
      <Panel>
        {query.isPending ? (
          <div className="grid gap-px p-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('incidents.reassignments.empty')} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('incidents.reassignments.columns.incident')}</Th>
                <Th>{t('incidents.reassignments.columns.intervenant')}</Th>
                <Th>{t('incidents.reassignments.columns.reason')}</Th>
                <Th className="hidden md:table-cell">{t('incidents.reassignments.columns.age')}</Th>
                <Th />
              </tr>
            </THead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.assignmentId}>
                  <Td>
                    <Link
                      to="/app/incidents"
                      search={{ incident: row.incident.reference }}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <PriorityLabel priority={row.incident.priority} short />
                      <span className="min-w-0">
                        <span className="block max-w-[260px] truncate font-medium">{row.incident.title}</span>
                        <span className="block text-xs text-ink-3">
                          {row.incident.reference}, {row.incident.site}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td>{row.intervenant.name}</Td>
                  <Td>
                    {t(`common.reassignmentReason.${row.reasonCode}`)}
                    {row.note && <span className="block max-w-[260px] truncate text-xs text-ink-3">{row.note}</span>}
                  </Td>
                  <Td className="hidden text-ink-2 md:table-cell">{relative(row.requestedAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button size="sm" className="mr-2" onClick={() => setKeep(row)}>
                      {t('incidents.reassignments.keep')}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => setReassign(row.incident.reference)}>
                      {t('incidents.reassignments.reassign')}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      {reassign && <ReassignDialog reference={reassign} onClose={() => setReassign(null)} />}
      {keep && <KeepDialog request={keep} onClose={() => setKeep(null)} />}
    </Page>
  );
}
