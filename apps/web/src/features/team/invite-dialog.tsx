import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberSchema, type InviteResult, type MemberDTO, type MembershipRole } from '@sentinel/shared';
import { useId, useState, type ReactNode } from 'react';
import { useController, useForm, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Banner } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { applyServerErrors, toastError } from '../../lib/forms';
import { InviteResultContent } from './invite-result';
import { fullName } from './parts';
import { EmployeeFields, IntervenantFields, PersonFields } from './profile-fields';
import { pendingInvitationId, renameFieldErrors, useInvite, useResendInvitation, type InviteInput } from './queries';

const [employeeInvite, intervenantInvite, supervisorInvite] = inviteMemberSchema.options;
type EmployeeInvite = z.input<typeof employeeInvite>;
type IntervenantInvite = z.input<typeof intervenantInvite>;
type SupervisorInvite = z.input<typeof supervisorInvite>;

/** What the dialog opens with: a role, and values when inviting a former member again. */
export type InviteDraft = {
  role: MembershipRole;
  email?: string;
  firstName?: string;
  lastName?: string;
  employee?: { employeeCode: string; jobTitle: string; department: string; homeSiteId: string | null };
  intervenant?: { companyName: string; specialtyIds: string[]; siteIds: string[] };
};

/** Prefills an invitation from a revoked member, so access comes back with the same profile. */
export function draftFromMember(member: MemberDTO): InviteDraft {
  return {
    role: member.role,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    employee: member.employee
      ? {
          employeeCode: member.employee.employeeCode ?? '',
          jobTitle: member.employee.jobTitle ?? '',
          department: member.employee.department ?? '',
          homeSiteId: member.employee.homeSite?.id ?? null,
        }
      : undefined,
    intervenant: member.intervenant
      ? {
          companyName: member.intervenant.companyName ?? '',
          specialtyIds: member.intervenant.specialties.map((specialty) => specialty.id),
          siteIds: member.intervenant.sites.map((site) => site.id),
        }
      : undefined,
  };
}

type Sent = (result: InviteResult, resent: boolean) => void;

/**
 * Sends the invitation, puts server errors on the fields and, when the email
 * already has a pending invitation, offers to resend that one instead.
 */
function useInviteSubmit<T extends InviteInput & FieldValues>(
  form: UseFormReturn<T>,
  onSent: Sent,
  rename: (path: string) => string = (path) => path,
) {
  const { t } = useT();
  const invite = useInvite();
  const resend = useResendInvitation();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const submit = form.handleSubmit(async (values) => {
    setPendingId(null);
    try {
      const result = await invite.mutateAsync(values);
      const name = fullName(result.invitation);
      if (result.emailSent) toast.success(t('team.invite.sent', { name }));
      else toast.info(t('team.invite.created', { name }));
      onSent(result, false);
    } catch (error) {
      const pending = pendingInvitationId(error);
      setPendingId(pending);
      if (pending) {
        // Said in the person's language on the field, with the way out in the banner above.
        form.setError('email' as FieldPath<T>, { type: 'server', message: t('team.invite.pendingField') });
      } else if (!applyServerErrors(form, renameFieldErrors(error, rename))) {
        toastError(error, t);
      }
    }
  });

  const resendPending = async () => {
    if (!pendingId) return;
    try {
      const result = await resend.mutateAsync(pendingId);
      toast.success(t('team.invitations.resent', { name: fullName(result.invitation) }));
      onSent(result, true);
    } catch (error) {
      toastError(error, t);
    }
  };

  const pendingBanner = pendingId ? (
    <Banner
      tone="info"
      action={
        <Button size="sm" onClick={resendPending} loading={resend.isPending}>
          {t('team.invite.resendPending')}
        </Button>
      }
    >
      {t('team.invite.pendingBody')}
    </Banner>
  ) : null;

  return { submit, pendingBanner };
}

/** Title, description and footer for one role. The footer submits the form by id. */
function InviteShell({
  role,
  formId,
  state,
  onCancel,
  children,
}: {
  role: MembershipRole;
  formId: string;
  state: { isSubmitting: boolean; isDirty: boolean };
  onCancel: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <DialogContent
      title={t(`team.invite.title.${role}`)}
      description={t(`team.invite.description.${role}`)}
      modalLock={state.isDirty}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={state.isSubmitting}>
            {t('team.invite.submit')}
          </Button>
        </>
      }
    >
      {children}
    </DialogContent>
  );
}

function EmployeeInviteForm({ draft, onSent, onCancel }: { draft: InviteDraft; onSent: Sent; onCancel: () => void }) {
  const formId = useId();
  const form = useForm<EmployeeInvite>({
    resolver: zodResolver(employeeInvite),
    defaultValues: {
      role: 'REPORTER',
      email: draft.email ?? '',
      firstName: draft.firstName ?? '',
      lastName: draft.lastName ?? '',
      employee: draft.employee ?? { employeeCode: '', jobTitle: '', department: '', homeSiteId: null },
    },
  });
  // The API reports a taken employee code on `employeeCode`.
  const { submit, pendingBanner } = useInviteSubmit(form, onSent, (path) =>
    path === 'employeeCode' ? 'employee.employeeCode' : path,
  );
  const homeSite = useController({ control: form.control, name: 'employee.homeSiteId' });
  const errors = form.formState.errors;

  return (
    <InviteShell
      role="REPORTER"
      formId={formId}
      state={{ isSubmitting: form.formState.isSubmitting, isDirty: form.formState.isDirty }}
      onCancel={onCancel}
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {pendingBanner}
        <PersonFields
          register={{
            firstName: form.register('firstName'),
            lastName: form.register('lastName'),
            email: form.register('email'),
          }}
          errors={{
            firstName: errors.firstName?.message,
            lastName: errors.lastName?.message,
            email: errors.email?.message,
          }}
        />
        <div className="border-t border-line pt-4">
          <EmployeeFields
            register={{
              employeeCode: form.register('employee.employeeCode'),
              jobTitle: form.register('employee.jobTitle'),
              department: form.register('employee.department'),
            }}
            homeSite={{
              value: homeSite.field.value ?? null,
              onChange: homeSite.field.onChange,
              error: homeSite.fieldState.error?.message,
            }}
            errors={{
              employeeCode: errors.employee?.employeeCode?.message,
              jobTitle: errors.employee?.jobTitle?.message,
              department: errors.employee?.department?.message,
            }}
          />
        </div>
      </form>
    </InviteShell>
  );
}

function IntervenantInviteForm({
  draft,
  onSent,
  onCancel,
}: {
  draft: InviteDraft;
  onSent: Sent;
  onCancel: () => void;
}) {
  const formId = useId();
  const form = useForm<IntervenantInvite>({
    resolver: zodResolver(intervenantInvite),
    defaultValues: {
      role: 'INTERVENANT',
      email: draft.email ?? '',
      firstName: draft.firstName ?? '',
      lastName: draft.lastName ?? '',
      intervenant: draft.intervenant ?? { companyName: '', specialtyIds: [], siteIds: [] },
    },
  });
  const { submit, pendingBanner } = useInviteSubmit(form, onSent);
  const specialties = useController({ control: form.control, name: 'intervenant.specialtyIds' });
  const sites = useController({ control: form.control, name: 'intervenant.siteIds' });
  const errors = form.formState.errors;

  return (
    <InviteShell
      role="INTERVENANT"
      formId={formId}
      state={{ isSubmitting: form.formState.isSubmitting, isDirty: form.formState.isDirty }}
      onCancel={onCancel}
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {pendingBanner}
        <PersonFields
          register={{
            firstName: form.register('firstName'),
            lastName: form.register('lastName'),
            email: form.register('email'),
          }}
          errors={{
            firstName: errors.firstName?.message,
            lastName: errors.lastName?.message,
            email: errors.email?.message,
          }}
        />
        <div className="grid gap-4 border-t border-line pt-4">
          <IntervenantFields
            company={form.register('intervenant.companyName')}
            companyError={errors.intervenant?.companyName?.message}
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
          />
        </div>
      </form>
    </InviteShell>
  );
}

function SupervisorInviteForm({ draft, onSent, onCancel }: { draft: InviteDraft; onSent: Sent; onCancel: () => void }) {
  const formId = useId();
  const form = useForm<SupervisorInvite>({
    resolver: zodResolver(supervisorInvite),
    defaultValues: {
      role: 'SUPERVISOR',
      email: draft.email ?? '',
      firstName: draft.firstName ?? '',
      lastName: draft.lastName ?? '',
    },
  });
  const { submit, pendingBanner } = useInviteSubmit(form, onSent);
  const errors = form.formState.errors;

  return (
    <InviteShell
      role="SUPERVISOR"
      formId={formId}
      state={{ isSubmitting: form.formState.isSubmitting, isDirty: form.formState.isDirty }}
      onCancel={onCancel}
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {pendingBanner}
        <PersonFields
          register={{
            firstName: form.register('firstName'),
            lastName: form.register('lastName'),
            email: form.register('email'),
          }}
          errors={{
            firstName: errors.firstName?.message,
            lastName: errors.lastName?.message,
            email: errors.email?.message,
          }}
        />
      </form>
    </InviteShell>
  );
}

/**
 * Invite one person in the role chosen from the Invite menu. After sending,
 * the dialog shows the link to copy, and can start another invitation.
 * Rendered only while open, so every opening starts clean.
 */
export function InviteDialog({ draft, onClose }: { draft: InviteDraft; onClose: () => void }) {
  const [sent, setSent] = useState<{ result: InviteResult; resent: boolean } | null>(null);
  const [current, setCurrent] = useState(draft);
  const [round, setRound] = useState(0);

  const props = {
    draft: current,
    onSent: (result: InviteResult, resent: boolean) => setSent({ result, resent }),
    onCancel: onClose,
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {sent ? (
        <InviteResultContent
          result={sent.result}
          resent={sent.resent}
          onDone={onClose}
          onAnother={() => {
            setSent(null);
            setCurrent({ role: draft.role });
            setRound((value) => value + 1);
          }}
        />
      ) : draft.role === 'REPORTER' ? (
        <EmployeeInviteForm key={round} {...props} />
      ) : draft.role === 'INTERVENANT' ? (
        <IntervenantInviteForm key={round} {...props} />
      ) : (
        <SupervisorInviteForm key={round} {...props} />
      )}
    </Dialog>
  );
}
