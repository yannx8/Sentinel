import { zodResolver } from '@hookform/resolvers/zod';
import { specialtySchema, type SpecialtyDTO } from '@sentinel/shared';
import { Plus } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Panel } from '../../components/ui/layout';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { newIdempotencyKey } from '../../lib/api';
import { LoadError, showSaveError } from './parts';
import { useCreateSpecialty, useSpecialties } from './queries';

type SpecialtyInput = z.input<typeof specialtySchema>;
type SpecialtyOutput = z.output<typeof specialtySchema>;

function SpecialtyDialogContent({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const formId = useId();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const create = useCreateSpecialty();
  const form = useForm<SpecialtyInput, unknown, SpecialtyOutput>({
    resolver: zodResolver(specialtySchema),
    defaultValues: { name: '' },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async ({ name }) => {
    try {
      const saved = await create.mutateAsync({ name, idempotencyKey });
      toast.success(t('setup.specialties.toast.added', { name: saved.name }));
      onClose();
    } catch (error) {
      showSaveError(form, error, t, { field: 'name', message: t('setup.specialties.form.nameTaken') });
    }
  });

  return (
    <DialogContent
      size="sm"
      title={t('setup.specialties.form.title')}
      description={t('setup.specialties.form.description')}
      modalLock={isDirty}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={isSubmitting}>
            {t('setup.specialties.add')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <Field label={t('setup.specialties.form.name')} error={errors.name?.message}>
          <Input autoFocus autoComplete="off" maxLength={60} {...form.register('name')} />
        </Field>
      </form>
    </DialogContent>
  );
}

function SpecialtiesTable({ specialties, loading }: { specialties: SpecialtyDTO[]; loading?: boolean }) {
  const { t, number } = useT();
  return (
    <Table>
      <caption className="sr-only">{t('setup.specialties.title')}</caption>
      <THead>
        <tr>
          <Th>{t('setup.specialties.columns.name')}</Th>
          <Th className="w-32 text-right">{t('setup.specialties.columns.intervenants')}</Th>
          <Th className="w-32 text-right">{t('setup.specialties.columns.categories')}</Th>
        </tr>
      </THead>
      <tbody aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <Tr key={index}>
                <Td>
                  <Skeleton className="h-3.5 w-32" />
                </Td>
                <Td>
                  <Skeleton className="ml-auto h-3.5 w-5" />
                </Td>
                <Td>
                  <Skeleton className="ml-auto h-3.5 w-5" />
                </Td>
              </Tr>
            ))
          : specialties.map((specialty) => (
              <Tr key={specialty.id}>
                <Td className="font-medium">{specialty.name}</Td>
                <Td className={specialty.intervenants === 0 ? 'text-right text-ink-3' : 'text-right text-ink-2'}>
                  {number(specialty.intervenants)}
                </Td>
                <Td className={specialty.categories === 0 ? 'text-right text-ink-3' : 'text-right text-ink-2'}>
                  {number(specialty.categories)}
                </Td>
              </Tr>
            ))}
      </tbody>
    </Table>
  );
}

/** Skills that categories point to and intervenants hold. They can be added here; Team gives them to people. */
export function SpecialtiesSection() {
  const { t } = useT();
  const headingId = useId();
  const specialties = useSpecialties();
  const [adding, setAdding] = useState(false);

  let body: ReactNode;
  if (specialties.data) {
    body =
      specialties.data.length > 0 ? (
        <SpecialtiesTable specialties={specialties.data} />
      ) : (
        <EmptyState
          title={t('setup.specialties.empty.title')}
          description={t('setup.specialties.empty.body')}
          action={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
              {t('setup.specialties.add')}
            </Button>
          }
        />
      );
  } else if (specialties.isError) {
    body = (
      <LoadError
        error={specialties.error}
        onRetry={() => void specialties.refetch()}
        retrying={specialties.isFetching}
      />
    );
  } else {
    body = <SpecialtiesTable specialties={[]} loading />;
  }

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold text-ink">
            {t('setup.specialties.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-3">{t('setup.specialties.description')}</p>
        </div>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
          {t('setup.specialties.add')}
        </Button>
      </div>
      <Panel>{body}</Panel>
      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && <SpecialtyDialogContent onClose={() => setAdding(false)} />}
      </Dialog>
    </section>
  );
}
