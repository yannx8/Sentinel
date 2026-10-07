import { zodResolver } from '@hookform/resolvers/zod';
import { siteSchema, type SiteDTO } from '@sentinel/shared';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../../components/ui/button';
import { ConfirmDialog, Dialog, DialogContent } from '../../components/ui/dialog';
import { Banner } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { newIdempotencyKey } from '../../lib/api';
import { cn } from '../../lib/cn';
import { toastError } from '../../lib/forms';
import { showSaveError } from './parts';
import { changedFields, useCreateSite, useUpdateSite, type SiteBody } from './queries';

type SiteInput = z.input<typeof siteSchema>;
type SiteOutput = z.output<typeof siteSchema>;

function bodyOf(site: SiteDTO | null): SiteBody {
  return {
    code: site?.code ?? '',
    name: site?.name ?? '',
    address: site?.address ?? '',
    city: site?.city ?? '',
    contactName: site?.contactName ?? '',
    contactPhone: site?.contactPhone ?? '',
  };
}

/** Parsed values back to the wire shape: a cleared optional field is sent as '' so the API clears it. */
function toBody(values: SiteOutput): SiteBody {
  return {
    code: values.code,
    name: values.name,
    address: values.address ?? '',
    city: values.city ?? '',
    contactName: values.contactName ?? '',
    contactPhone: values.contactPhone ?? '',
  };
}

/** Add a site, or edit one and deactivate or reactivate it. */
export function SiteDialog({
  open,
  site,
  onOpenChange,
}: {
  open: boolean;
  /** Null adds a new site. */
  site: SiteDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <SiteDialogContent key={site?.id ?? 'new'} site={site} onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function SiteDialogContent({ site, onClose }: { site: SiteDTO | null; onClose: () => void }) {
  const { t } = useT();
  const formId = useId();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [confirming, setConfirming] = useState(false);
  const create = useCreateSite();
  const update = useUpdateSite();
  const initial = bodyOf(site);
  const form = useForm<SiteInput, unknown, SiteOutput>({
    resolver: zodResolver(siteSchema),
    defaultValues: initial,
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const body = toBody(values);
    try {
      if (site) {
        const patch = changedFields(body, initial);
        if (Object.keys(patch).length > 0) {
          const saved = await update.mutateAsync({ id: site.id, patch });
          toast.success(t('setup.sites.toast.saved', { name: saved.name }));
        }
      } else {
        const saved = await create.mutateAsync({ body, idempotencyKey });
        toast.success(t('setup.sites.toast.added', { name: saved.name }));
      }
      onClose();
    } catch (error) {
      showSaveError(form, error, t, { field: 'code', message: t('setup.sites.form.codeTaken') });
    }
  });

  const setActive = async (isActive: boolean) => {
    if (!site) return;
    try {
      const saved = await update.mutateAsync({ id: site.id, patch: { isActive } });
      toast.success(t(saved.isActive ? 'setup.sites.toast.reactivated' : 'setup.sites.toast.deactivated', { name: saved.name }));
      onClose();
    } catch (error) {
      toastError(error, t);
    }
  };

  return (
    <DialogContent
      title={site ? t('setup.sites.form.editTitle') : t('setup.sites.form.createTitle')}
      description={site ? undefined : t('setup.sites.form.createDescription')}
      modalLock={isDirty}
      footer={
        <>
          {site && (
            <Button
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => setConfirming(true)}
              className={cn('mr-auto', site.isActive && 'text-critical-ink hover:bg-critical-subtle hover:text-critical-ink')}
            >
              {site.isActive ? t('setup.sites.form.deactivate') : t('setup.sites.form.reactivate')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={isSubmitting}>
            {site ? t('common.saveChanges') : t('setup.sites.add')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-4">
        {site && !site.isActive && <Banner>{t('setup.sites.form.inactiveNotice')}</Banner>}
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field label={t('setup.sites.form.name')} error={errors.name?.message}>
            <Input autoFocus autoComplete="off" maxLength={80} {...form.register('name')} />
          </Field>
          <Field label={t('setup.sites.form.code')} hint={t('setup.sites.form.codeHint')} error={errors.code?.message}>
            <Input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              className="uppercase"
              {...form.register('code')}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field label={t('setup.sites.form.address')} optional error={errors.address?.message}>
            <Input autoComplete="off" maxLength={200} {...form.register('address')} />
          </Field>
          <Field label={t('setup.sites.form.city')} optional error={errors.city?.message}>
            <Input autoComplete="off" maxLength={80} {...form.register('city')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('setup.sites.form.contactName')} optional error={errors.contactName?.message}>
            <Input autoComplete="off" maxLength={80} {...form.register('contactName')} />
          </Field>
          <Field label={t('setup.sites.form.contactPhone')} optional error={errors.contactPhone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="off" maxLength={32} {...form.register('contactPhone')} />
          </Field>
        </div>
      </form>

      {site && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t(site.isActive ? 'setup.sites.confirm.deactivateTitle' : 'setup.sites.confirm.reactivateTitle', {
            name: site.name,
          })}
          description={t(site.isActive ? 'setup.sites.confirm.deactivateBody' : 'setup.sites.confirm.reactivateBody')}
          confirmLabel={site.isActive ? t('setup.sites.form.deactivate') : t('setup.sites.form.reactivate')}
          variant={site.isActive ? 'danger' : 'primary'}
          onConfirm={() => setActive(!site.isActive)}
        />
      )}
    </DialogContent>
  );
}
