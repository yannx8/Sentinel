import { zodResolver } from '@hookform/resolvers/zod';
import { employeeProfileSchema, intervenantProfileSchema, type MemberDTO } from '@sentinel/shared';
import { useId, type FormEvent, type ReactNode } from 'react';
import { useController, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { applyServerErrors, toastError } from '../../lib/forms';
import { fullName } from './parts';
import { EmployeeFields, IntervenantFields } from './profile-fields';
import { renameFieldErrors, useUpdateMember, type MemberUpdate } from './queries';

type EmployeeProfile = z.input<typeof employeeProfileSchema>;
type IntervenantProfile = z.input<typeof intervenantProfileSchema>;

function employeeValues(member: MemberDTO): EmployeeProfile {
  return {
    employeeCode: member.employee?.employeeCode ?? '',
    jobTitle: member.employee?.jobTitle ?? '',
    department: member.employee?.department ?? '',
    homeSiteId: member.employee?.homeSite?.id ?? null,
  };
}

function intervenantValues(member: MemberDTO): IntervenantProfile {
  return {
    companyName: member.intervenant?.companyName ?? '',
    specialtyIds: member.intervenant?.specialties.map((specialty) => specialty.id) ?? [],
    siteIds: member.intervenant?.sites.map((site) => site.id) ?? [],
  };
}

/** Saves one profile and reports field errors under the names this form uses. */
function useSaveProfile(member: MemberDTO, prefix: 'employee' | 'intervenant') {
  const { t } = useT();
  const update = useUpdateMember();
  return async (body: MemberUpdate, onSaved: (member: MemberDTO) => void, onError: (error: unknown) => boolean) => {
    try {
      const updated = await update.mutateAsync({ id: member.id, body });
      onSaved(updated);
      toast.success(t('team.sheet.saved', { name: fullName(updated) }));
    } catch (error) {
      const renamed = renameFieldErrors(error, (path) => path.replace(`${prefix}.`, ''));
      if (!onError(renamed)) toastError(error, t);
    }
  };
}

/**
 * Scrollable body with the details and the fields, and a footer that stays in
 * view. Without `editable` the fields are read-only and the footer is hidden.
 */
function ProfileFormLayout({
  formId,
  before,
  title,
  editable,
  dirty,
  submitting,
  onSubmit,
  onReset,
  children,
}: {
  formId: string;
  before: ReactNode;
  title: string;
  editable: boolean;
  dirty: boolean;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <form id={formId} noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {before}
        <section aria-labelledby={`${formId}-title`} className="grid gap-4 px-5 py-5">
          <h3 id={`${formId}-title`} className="text-sm font-semibold text-ink">
            {title}
          </h3>
          {children}
        </section>
      </div>
      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">
          <Button variant="ghost" onClick={onReset} disabled={!dirty || submitting}>
            {t('team.sheet.discard')}
          </Button>
          <Button type="submit" variant="primary" loading={submitting} disabled={!dirty}>
            {t('common.saveChanges')}
          </Button>
        </div>
      )}
    </form>
  );
}

export function EmployeeProfileForm({
  member,
  before,
  editable,
}: {
  member: MemberDTO;
  before: ReactNode;
  editable: boolean;
}) {
  const { t } = useT();
  const formId = useId();
  const form = useForm<EmployeeProfile>({
    resolver: zodResolver(employeeProfileSchema),
    defaultValues: employeeValues(member),
  });
  const homeSite = useController({ control: form.control, name: 'homeSiteId' });
  const save = useSaveProfile(member, 'employee');
  const errors = form.formState.errors;

  const submit = form.handleSubmit((values) =>
    save(
      { employee: values },
      (updated) => form.reset(employeeValues(updated)),
      (error) => applyServerErrors(form, error),
    ),
  );

  return (
    <ProfileFormLayout
      formId={formId}
      before={before}
      title={t('team.sheet.employeeProfile')}
      editable={editable}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
      onSubmit={submit}
      onReset={() => form.reset()}
    >
      <EmployeeFields
        register={{
          employeeCode: form.register('employeeCode'),
          jobTitle: form.register('jobTitle'),
          department: form.register('department'),
        }}
        homeSite={{
          value: homeSite.field.value ?? null,
          onChange: homeSite.field.onChange,
          error: homeSite.fieldState.error?.message,
        }}
        errors={{
          employeeCode: errors.employeeCode?.message,
          jobTitle: errors.jobTitle?.message,
          department: errors.department?.message,
        }}
        disabled={!editable}
      />
    </ProfileFormLayout>
  );
}

export function IntervenantProfileForm({
  member,
  before,
  editable,
}: {
  member: MemberDTO;
  before: ReactNode;
  editable: boolean;
}) {
  const { t } = useT();
  const formId = useId();
  const form = useForm<IntervenantProfile>({
    resolver: zodResolver(intervenantProfileSchema),
    defaultValues: intervenantValues(member),
  });
  const specialties = useController({ control: form.control, name: 'specialtyIds' });
  const sites = useController({ control: form.control, name: 'siteIds' });
  const save = useSaveProfile(member, 'intervenant');

  const submit = form.handleSubmit((values) =>
    save(
      { intervenant: values },
      (updated) => form.reset(intervenantValues(updated)),
      (error) => applyServerErrors(form, error),
    ),
  );

  return (
    <ProfileFormLayout
      formId={formId}
      before={before}
      title={t('team.sheet.intervenantProfile')}
      editable={editable}
      dirty={form.formState.isDirty}
      submitting={form.formState.isSubmitting}
      onSubmit={submit}
      onReset={() => form.reset()}
    >
      <IntervenantFields
        company={form.register('companyName')}
        companyError={form.formState.errors.companyName?.message}
        specialties={{
          value: specialties.field.value ?? [],
          onChange: specialties.field.onChange,
          error: specialties.fieldState.error?.message,
        }}
        sites={{
          value: sites.field.value ?? [],
          onChange: sites.field.onChange,
          error: sites.fieldState.error?.message,
        }}
        disabled={!editable}
      />
    </ProfileFormLayout>
  );
}
