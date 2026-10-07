import type { SiteDTO } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Field } from '../../components/ui/field';
import { Input, NativeSelect } from '../../components/ui/input';
import { useT } from '../../i18n';
import { Checklist, type ChecklistOption } from './checklist';
import { useSites, useSpecialties } from './queries';

type Controlled<T> = { value: T; onChange: (value: T) => void; error?: string };

/** First name, last name and email of the person invited. */
export function PersonFields({
  register,
  errors,
}: {
  register: { firstName: UseFormRegisterReturn; lastName: UseFormRegisterReturn; email: UseFormRegisterReturn };
  errors: { firstName?: string; lastName?: string; email?: string };
}) {
  const { t } = useT();
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('team.fields.firstName')} error={errors.firstName}>
          <Input autoComplete="off" autoFocus {...register.firstName} />
        </Field>
        <Field label={t('team.fields.lastName')} error={errors.lastName}>
          <Input autoComplete="off" {...register.lastName} />
        </Field>
      </div>
      <Field label={t('team.fields.email')} hint={t('team.fields.emailHint')} error={errors.email}>
        <Input type="email" autoComplete="off" spellCheck={false} {...register.email} />
      </Field>
    </>
  );
}

/** Active sites, plus any inactive site already chosen so a saved choice is never dropped silently. */
function siteOptions(sites: SiteDTO[], keep: readonly string[], inactiveHint: string): ChecklistOption[] {
  return sites
    .filter((site) => site.isActive || keep.includes(site.id))
    .map((site) => ({
      value: site.id,
      label: site.name,
      hint: site.isActive ? site.code : `${site.code}, ${inactiveHint}`,
    }));
}

function CatalogLink({ to, children }: { to: '/app/sites' | '/app/categories'; children: string }) {
  return (
    <Link to={to} className="font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

/** Employee code, job title, department and home site. */
export function EmployeeFields({
  register,
  homeSite,
  errors,
  disabled,
}: {
  register: { employeeCode: UseFormRegisterReturn; jobTitle: UseFormRegisterReturn; department: UseFormRegisterReturn };
  homeSite: Controlled<string | null>;
  errors: { employeeCode?: string; jobTitle?: string; department?: string };
  disabled?: boolean;
}) {
  const { t } = useT();
  const sites = useSites();
  const options = siteOptions(sites.data ?? [], homeSite.value ? [homeSite.value] : [], t('team.fields.inactive')).map(
    (option) => ({ value: option.value, label: option.hint ? `${option.label} (${option.hint})` : option.label }),
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={t('team.fields.employeeCode')}
        optional
        hint={t('team.fields.employeeCodeHint')}
        error={errors.employeeCode}
      >
        <Input autoComplete="off" spellCheck={false} disabled={disabled} {...register.employeeCode} />
      </Field>
      <Field label={t('team.fields.jobTitle')} optional error={errors.jobTitle}>
        <Input autoComplete="off" disabled={disabled} {...register.jobTitle} />
      </Field>
      <Field label={t('team.fields.department')} optional error={errors.department}>
        <Input autoComplete="off" disabled={disabled} {...register.department} />
      </Field>
      <Field label={t('team.fields.homeSite')} optional error={homeSite.error}>
        <NativeSelect
          value={homeSite.value ?? ''}
          onChange={(event) => homeSite.onChange(event.target.value || null)}
          options={options}
          placeholder={sites.isPending ? t('common.loading') : t('team.fields.noHomeSite')}
          disabled={disabled || sites.isPending}
        />
      </Field>
    </div>
  );
}

/** Company, specialties and site access of an intervenant. */
export function IntervenantFields({
  company,
  companyError,
  specialties,
  sites,
  disabled,
}: {
  company: UseFormRegisterReturn;
  companyError?: string;
  specialties: Controlled<string[]>;
  sites: Controlled<string[]>;
  disabled?: boolean;
}) {
  const { t } = useT();
  const specialtyQuery = useSpecialties();
  const siteQuery = useSites();
  const specialtyOptions = (specialtyQuery.data ?? []).map((specialty) => ({
    value: specialty.id,
    label: specialty.name,
  }));

  return (
    <>
      <Field label={t('team.fields.company')} optional hint={t('team.fields.companyHint')} error={companyError}>
        <Input autoComplete="off" disabled={disabled} {...company} />
      </Field>
      <Checklist
        label={t('team.fields.specialties')}
        hint={t('team.fields.specialtiesHint')}
        error={specialties.error}
        options={specialtyOptions}
        value={specialties.value}
        onChange={specialties.onChange}
        loading={specialtyQuery.isPending}
        disabled={disabled}
        filterLabel={t('team.fields.filterSpecialties')}
        empty={
          <>
            {t('team.fields.noSpecialties')}{' '}
            <CatalogLink to="/app/categories">{t('team.fields.addSpecialties')}</CatalogLink>
          </>
        }
      />
      <Checklist
        label={t('team.fields.siteAccess')}
        hint={t('team.fields.siteAccessHint')}
        error={sites.error}
        options={siteOptions(siteQuery.data ?? [], sites.value, t('team.fields.inactive'))}
        value={sites.value}
        onChange={sites.onChange}
        selectAll
        loading={siteQuery.isPending}
        disabled={disabled}
        filterLabel={t('team.fields.filterSites')}
        empty={
          <>
            {t('team.fields.noSites')} <CatalogLink to="/app/sites">{t('team.fields.addSites')}</CatalogLink>
          </>
        }
      />
    </>
  );
}
