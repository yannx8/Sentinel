import { zodResolver } from '@hookform/resolvers/zod';
import { priorities, updateCategorySchema, type CategoryDTO, type Priority } from '@sentinel/shared';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { SwitchRow } from '../../components/ui/checkbox';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Select, type SelectOption } from '../../components/ui/select';
import { toast } from '../../components/ui/toast';
import { PriorityLabel } from '../../components/domain/glyphs';
import { useT } from '../../i18n';
import { newIdempotencyKey } from '../../lib/api';
import { showSaveError } from './parts';
import { changedFields, useCreateCategory, useSpecialties, useUpdateCategory } from './queries';

/**
 * updateCategorySchema with every field present: the dialog always holds the full
 * category, so one form adds (the API ignores isActive there) and edits.
 */
const categoryFormSchema = updateCategorySchema.required();
type CategoryInput = z.input<typeof categoryFormSchema>;
type CategoryOutput = z.output<typeof categoryFormSchema>;

/** Radix Select needs a non-empty value for the "no specialty" choice. Ids are UUIDs, so this never collides. */
const NO_SPECIALTY = 'none';

function isPriority(value: string): value is Priority {
  return (priorities as readonly string[]).includes(value);
}

function valuesOf(category: CategoryDTO | null): CategoryOutput {
  return {
    name: category?.name ?? '',
    defaultPriority: category?.defaultPriority ?? 'MEDIUM',
    specialtyId: category?.specialty?.id ?? null,
    isActive: category?.isActive ?? true,
  };
}

/** Add a category, or edit one, including turning it off. */
export function CategoryDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean;
  /** Null adds a new category. */
  category: CategoryDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CategoryDialogContent key={category?.id ?? 'new'} category={category} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function CategoryDialogContent({ category, onClose }: { category: CategoryDTO | null; onClose: () => void }) {
  const { t } = useT();
  const formId = useId();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const specialties = useSpecialties();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const initial = valuesOf(category);
  const form = useForm<CategoryInput, unknown, CategoryOutput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: initial,
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const priorityOptions = useMemo<SelectOption[]>(
    () => [...priorities].reverse().map((priority) => ({ value: priority, label: <PriorityLabel priority={priority} /> })),
    [],
  );

  // The current link stays selectable while the list loads, so the field never shows blank.
  const specialtyOptions = useMemo<SelectOption[]>(() => {
    const list = specialties.data ?? (category?.specialty ? [category.specialty] : []);
    return [
      { value: NO_SPECIALTY, label: t('setup.categories.form.noSpecialty') },
      ...list.map((specialty) => ({ value: specialty.id, label: specialty.name })),
    ];
  }, [specialties.data, category, t]);
  const noSpecialties = specialties.data?.length === 0;

  const submit = form.handleSubmit(async (values) => {
    try {
      if (category) {
        const patch = changedFields(values, initial);
        const changed = Object.keys(patch);
        if (changed.length > 0) {
          const saved = await update.mutateAsync({ id: category.id, patch });
          // Turning a category off or on reads as that action, like the switch in the table.
          const onlyActive = changed.length === 1 && patch.isActive !== undefined;
          const message = onlyActive
            ? saved.isActive
              ? 'setup.categories.toast.reactivated'
              : 'setup.categories.toast.deactivated'
            : 'setup.categories.toast.saved';
          toast.success(t(message, { name: saved.name }));
        }
      } else {
        const body = { name: values.name, defaultPriority: values.defaultPriority, specialtyId: values.specialtyId };
        const saved = await create.mutateAsync({ body, idempotencyKey });
        toast.success(t('setup.categories.toast.added', { name: saved.name }));
      }
      onClose();
    } catch (error) {
      showSaveError(form, error, t, { field: 'name', message: t('setup.categories.form.nameTaken') });
    }
  });

  return (
    <DialogContent
      title={category ? t('setup.categories.form.editTitle') : t('setup.categories.form.createTitle')}
      description={category ? undefined : t('setup.categories.form.createDescription')}
      modalLock={isDirty}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={isSubmitting}>
            {category ? t('common.saveChanges') : t('setup.categories.add')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-4">
        <Field label={t('setup.categories.form.name')} error={errors.name?.message}>
          <Input autoFocus autoComplete="off" maxLength={60} {...form.register('name')} />
        </Field>
        <Controller
          control={form.control}
          name="defaultPriority"
          render={({ field, fieldState }) => (
            <Field
              label={t('setup.categories.form.priority')}
              hint={t('setup.categories.form.priorityHint')}
              error={fieldState.error?.message}
            >
              <Select
                ref={field.ref}
                value={field.value}
                onValueChange={(value) => {
                  if (isPriority(value)) field.onChange(value);
                }}
                options={priorityOptions}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="specialtyId"
          render={({ field, fieldState }) => (
            <Field
              label={t('setup.categories.form.specialty')}
              hint={t(noSpecialties ? 'setup.categories.form.noSpecialtiesHint' : 'setup.categories.form.specialtyHint')}
              error={fieldState.error?.message}
            >
              <Select
                ref={field.ref}
                value={field.value ?? NO_SPECIALTY}
                onValueChange={(value) => field.onChange(value === NO_SPECIALTY ? null : value)}
                options={specialtyOptions}
              />
            </Field>
          )}
        />
        {category && (
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="border-t border-line pt-4">
                <SwitchRow
                  label={t('setup.categories.form.active')}
                  description={t('setup.categories.form.activeHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        )}
      </form>
    </DialogContent>
  );
}
