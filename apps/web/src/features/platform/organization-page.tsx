import { plans, updatePlanSchema, type Plan, type PlatformOrganizationDetail } from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import { Field } from '../../components/ui/field';
import { Input, Textarea } from '../../components/ui/input';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { Select } from '../../components/ui/select';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api, ApiError } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { countryName, OrgStatusBadge } from './parts';

const key = (id: string) => ['platform', 'organization', id] as const;

function Figure({ label, value }: { label: string; value: number }) {
  const { number } = useT();
  return (
    <div>
      <p className="text-figure font-semibold text-ink tabular-nums">{number(value)}</p>
      <p className="text-sm text-ink-3">{label}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children || '-'}</dd>
    </>
  );
}

function useOrgAction(id: string, onDone?: () => void) {
  const { t } = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown; message: string }) =>
      api.post<PlatformOrganizationDetail>(`/platform/organizations/${id}${path}`, body),
    onSuccess: (data, input) => {
      queryClient.setQueryData(key(id), data);
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
      toast.success(input.message);
      onDone?.();
    },
    onError: (error) => toastError(error, t),
  });
}

function ReasonDialog({
  org,
  open,
  onOpenChange,
}: {
  org: PlatformOrganizationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const suspending = org.status === 'ACTIVE';
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const action = useOrgAction(org.id, () => {
    onOpenChange(false);
    setReason('');
  });
  const submit = () => {
    if (suspending && (reason.trim().length < 10 || reason.trim().length > 500)) {
      setError(t('common.validation.tooShort', { min: 10 }));
      return;
    }
    setError(undefined);
    action.mutate({
      path: suspending ? '/suspend' : '/reactivate',
      body: { reason: reason.trim() || undefined },
      message: t(suspending ? 'platform.detail.suspended' : 'platform.detail.reactivated', {
        organization: org.displayName,
      }),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={t(suspending ? 'platform.detail.suspendTitle' : 'platform.detail.reactivateTitle', {
          organization: org.displayName,
        })}
        description={t(suspending ? 'platform.detail.suspendBody' : 'platform.detail.reactivateBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant={suspending ? 'danger' : 'primary'} loading={action.isPending} onClick={submit}>
              {t(suspending ? 'platform.detail.suspend' : 'platform.detail.reactivate')}
            </Button>
          </>
        }
      >
        <Field
          label={t(suspending ? 'platform.detail.reason' : 'platform.detail.optionalReason')}
          hint={suspending ? t('platform.detail.reasonHint') : undefined}
          error={error}
          aside={t('common.characters', { count: reason.length, max: 500 })}
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({
  org,
  open,
  onOpenChange,
}: {
  org: PlatformOrganizationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const [plan, setPlan] = useState<Plan>(org.plan);
  const [trialEnd, setTrialEnd] = useState(org.trialEndsAt?.slice(0, 10) ?? '');
  const [error, setError] = useState<string>();
  const action = useOrgAction(org.id, () => onOpenChange(false));
  const submit = () => {
    const body = { plan, trialEndsAt: plan === 'TRIAL' && trialEnd ? trialEnd : null };
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) return setError(t('common.validation.invalid'));
    action.mutate({
      path: '/plan',
      body: parsed.data,
      message: t('platform.detail.planChanged', { plan: t(`common.plan.${plan}`) }),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={t('platform.detail.planTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" loading={action.isPending} onClick={submit}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t('platform.detail.plan')}>
            <Select
              value={plan}
              onValueChange={(value) => setPlan(value as Plan)}
              options={plans.map((value) => ({ value, label: t(`common.plan.${value}`) }))}
            />
          </Field>
          {plan === 'TRIAL' && (
            <Field label={t('platform.detail.trialEnd')} error={error}>
              <Input type="date" value={trialEnd} onChange={(e) => setTrialEnd(e.target.value)} />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlatformOrganizationPage() {
  const { t, date, locale } = useT();
  const { organizationId } = useParams({ from: '/platform/organizations/$organizationId' });
  const [reasonOpen, setReasonOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const query = useQuery({
    queryKey: key(organizationId),
    queryFn: () => api.get<PlatformOrganizationDetail>(`/platform/organizations/${organizationId}`),
  });
  const org = query.data;

  if (query.error instanceof ApiError && query.error.code === 'NOT_FOUND') throw query.error;
  if (!org) {
    return (
      <Page>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-48 w-full" />
      </Page>
    );
  }

  return (
    <Page>
      <Link
        to="/platform/organizations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('platform.detail.back')}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {org.displayName}
            <OrgStatusBadge status={org.status} />
          </span>
        }
        description={`${t(`common.plan.${org.plan}`)}${org.plan === 'TRIAL' && org.trialEndsAt ? ` - ${t('platform.organizations.trialEnds', { date: date(org.trialEndsAt, 'date') })}` : ''}`}
        actions={
          <>
            <Button onClick={() => setPlanOpen(true)} disabled={org.status === 'CLOSED'}>
              {t('platform.detail.changePlan')}
            </Button>
            {org.status !== 'CLOSED' && (
              <Button variant={org.status === 'ACTIVE' ? 'danger' : 'primary'} onClick={() => setReasonOpen(true)}>
                {t(org.status === 'ACTIVE' ? 'platform.detail.suspend' : 'platform.detail.reactivate')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">{t('platform.detail.profile')}</h2>
          <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
            <Row label={t('platform.detail.legalName')}>{org.legalName}</Row>
            <Row label={t('platform.detail.registrationNumber')}>{org.registrationNumber}</Row>
            <Row label={t('platform.detail.billingEmail')}>
              <a className="text-accent hover:underline" href={`mailto:${org.billingEmail}`}>
                {org.billingEmail}
              </a>
            </Row>
            <Row label={t('platform.detail.owner')}>
              {org.owner && (
                <>
                  {org.owner.name} (
                  <a className="text-accent hover:underline" href={`mailto:${org.owner.email}`}>
                    {org.owner.email}
                  </a>
                  )
                </>
              )}
            </Row>
            <Row label={t('platform.detail.country')}>{countryName(org.country, locale)}</Row>
            <Row label={t('platform.detail.industry')}>{t(`common.industry.${org.industry}`)}</Row>
            <Row label={t('platform.detail.timezone')}>{org.timezone}</Row>
            <Row label={t('platform.detail.created')}>{date(org.createdAt, 'date')}</Row>
          </dl>
        </section>
        <section>
          <h2 className="mb-4 text-sm font-semibold text-ink">{t('platform.detail.usage')}</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
            <Figure label={t('platform.detail.supervisors')} value={org.counts.supervisors} />
            <Figure label={t('platform.detail.employees')} value={org.counts.employees} />
            <Figure label={t('platform.detail.intervenants')} value={org.counts.intervenants} />
            <Figure label={t('platform.detail.sites')} value={org.counts.sites} />
            <Figure label={t('platform.detail.openIncidents')} value={org.counts.openIncidents} />
            <Figure label={t('platform.detail.incidents30')} value={org.counts.incidentsLast30Days} />
          </div>
        </section>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold text-ink">{t('platform.detail.history')}</h2>
      <Panel>
        {org.history.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-3">{t('platform.detail.noHistory')}</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('platform.audit.columns.time')}</Th>
                <Th>{t('platform.audit.columns.event')}</Th>
                <Th>{t('platform.audit.columns.admin')}</Th>
                <Th>{t('platform.audit.columns.reason')}</Th>
              </tr>
            </THead>
            <tbody>
              {org.history.map((event) => (
                <Tr key={event.id}>
                  <Td className="whitespace-nowrap text-ink-2 tabular-nums">{date(event.createdAt, 'datetime')}</Td>
                  <Td>{t(`platform.audit.events.${event.type}`)}</Td>
                  <Td>{event.admin.name}</Td>
                  <Td className="text-ink-2">{event.reason ?? '-'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <ReasonDialog key={`reason-${org.status}`} org={org} open={reasonOpen} onOpenChange={setReasonOpen} />
      <PlanDialog key={`plan-${org.plan}`} org={org} open={planOpen} onOpenChange={setPlanOpen} />
    </Page>
  );
}
