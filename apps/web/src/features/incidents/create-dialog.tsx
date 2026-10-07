import { zodResolver } from '@hookform/resolvers/zod';
import { createIncidentSchema, priorities, type MemberDTO, type SiteDTO } from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Field } from '../../components/ui/field';
import { Input, Textarea } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api, newIdempotencyKey } from '../../lib/api';
import { applyServerErrors, toastError } from '../../lib/forms';
import { incidentKeys } from '../../lib/incidents';
import { useCategories } from './assign-dialog';

type Values = z.input<typeof createIncidentSchema>;
const AUTO = 'auto';

export function CreateIncidentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (reference: string) => void;
}) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const employees = useQuery({
    queryKey: ['members', 'REPORTER'],
    queryFn: () => api.get<MemberDTO[]>('/members', { query: { role: 'REPORTER', status: 'ACTIVE' } }),
    enabled: open,
  });
  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get<SiteDTO[]>('/sites'), enabled: open });
  const categories = useCategories();
  const form = useForm<Values>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: { title: '', description: '', locationDetail: '' },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (values: Values) =>
      api.post<{ reference: string }>('/incidents', values, { idempotencyKey: newIdempotencyKey() }),
    onSuccess: (incident) => {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      toast.success(t('incidents.create.created', { reference: incident.reference }));
      form.reset();
      onOpenChange(false);
      onCreated(incident.reference);
    },
    onError: (error) => {
      if (!applyServerErrors(form, error)) toastError(error, t);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        modalLock
        title={t('incidents.create.title')}
        description={t('incidents.create.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              onClick={form.handleSubmit((values) => create.mutate(values))}
            >
              {t('incidents.create.submit')}
            </Button>
          </>
        }
      >
        <form noValidate className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
          <Field label={t('incidents.create.employee')} error={errors.onBehalfOfMembershipId?.message}>
            <Controller
              control={form.control}
              name="onBehalfOfMembershipId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('incidents.create.employeePlaceholder')}
                  options={(employees.data ?? []).map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))}
                />
              )}
            />
          </Field>
          <Field label={t('incidents.create.title_')} error={errors.title?.message}>
            <Input {...form.register('title')} />
          </Field>
          <Field label={t('incidents.create.description_')} error={errors.description?.message}>
            <Textarea rows={4} {...form.register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('incidents.create.site')} error={errors.siteId?.message}>
              <Controller
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('incidents.create.sitePlaceholder')}
                    options={(sites.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
                  />
                )}
              />
            </Field>
            <Field label={t('incidents.create.category')} error={errors.categoryId?.message}>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('incidents.create.categoryPlaceholder')}
                    options={(categories.data ?? [])
                      .filter((c) => c.isActive)
                      .map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('incidents.create.location')} optional error={errors.locationDetail?.message}>
              <Input {...form.register('locationDetail')} />
            </Field>
            <Field label={t('incidents.create.priority')} optional>
              <Controller
                control={form.control}
                name="reportedPriority"
                render={({ field }) => (
                  <Select
                    value={field.value ?? AUTO}
                    onValueChange={(value) => field.onChange(value === AUTO ? undefined : value)}
                    options={[
                      { value: AUTO, label: t('incidents.create.defaultPriority') },
                      ...[...priorities].reverse().map((p) => ({ value: p, label: t(`common.priority.${p}`) })),
                    ]}
                  />
                )}
              />
            </Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
