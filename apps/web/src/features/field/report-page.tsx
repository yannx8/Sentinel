import { zodResolver } from '@hookform/resolvers/zod';
import { createIncidentSchema, type IncidentDetail } from '@sentinel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useSearch } from '@tanstack/react-router';
import { useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMembership, useSession } from '../../app/session';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { api, ApiError, newIdempotencyKey } from '../../lib/api';
import { applyServerErrors, toastError } from '../../lib/forms';
import { incidentKeys } from '../../lib/incidents';
import { queueReport } from '../../lib/offline-sync';
import type { GeoFix } from './location-control';
import { BottomBar } from './parts';
import type { PreparedPhoto } from './photos';
import { ReportQueued } from './report-queued';
import { ReportSent } from './report-sent';
import { useActiveCategories, useActiveSites, useQrArea } from './queries';
import { WhatSection, WhereSection, type ReportInput, type ReportOutput } from './report-steps';

/** Employees report on one screen. Intervenants do not report and land on their work. */
export function ReportPage() {
  const membership = useMembership();
  const [round, setRound] = useState(0);
  if (membership.role === 'INTERVENANT') return <Navigate to="/field/work" replace />;
  // A new key gives "Report another" a clean draft, photos and idempotency key.
  return <ReportFlow key={round} onReportAnother={() => setRound((value) => value + 1)} />;
}

function ReportFlow({ onReportAnother }: { onReportAnother: () => void }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const { me } = useSession();
  const membership = useMembership();
  const qr = useSearch({ from: '/field/report' });
  const categories = useActiveCategories();
  const sites = useActiveSites();
  const qrArea = useQrArea(qr.area);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [sent, setSent] = useState<IncidentDetail | null>(null);
  const [queued, setQueued] = useState(false);
  /** One key per submission, reused when the same report is retried after a failure. */
  const attempt = useRef<{ key: string; body: string } | null>(null);

  const form = useForm<ReportInput, unknown, ReportOutput>({
    resolver: zodResolver(createIncidentSchema),
    mode: 'onTouched',
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      siteId: qr.site ?? '',
      areaId: qr.area,
      locationDetail: '',
    },
  });

  const changeFix = (next: GeoFix | null) => {
    setFix(next);
    form.setValue('latitude', next?.latitude);
    form.setValue('longitude', next?.longitude);
  };

  const send = form.handleSubmit(async (values) => {
    const body = JSON.stringify(values);
    if (attempt.current?.body !== body) attempt.current = { key: newIdempotencyKey(), body };
    try {
      const incident = await api.post<IncidentDetail>('/incidents', values, { idempotencyKey: attempt.current.key });
      queryClient.setQueryData(incidentKeys.detail(incident.reference), incident);
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
      setSent(incident);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0 && me) {
        // No connection: keep the report on the phone and send it when the network returns.
        await queueReport({
          userId: me.user.id,
          orgId: membership.organization.id,
          body: values,
          idempotencyKey: attempt.current.key,
          photos: photos.map((photo) => photo.file),
        });
        setQueued(true);
        return;
      }
      if (!applyServerErrors(form, error)) toastError(error, t);
    }
  });

  // A report without a title takes its category name.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const { title, categoryId } = form.getValues();
    const category = categories.data?.find((item) => item.id === categoryId);
    if (!title.trim() && category) form.setValue('title', category.name);
    void send(event);
  };

  if (queued) return <ReportQueued onReportAnother={onReportAnother} />;
  if (sent) return <ReportSent incident={sent} photos={photos} onReportAnother={onReportAnother} />;

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1 className="pb-4 text-2xl font-semibold text-ink">{t('field.report.heading')}</h1>
      {qrArea.data && (
        <Banner className="mb-6">
          {t('field.report.fromQr', {
            site: sites.data?.find((site) => site.id === qrArea.data.siteId)?.name ?? '',
            area: qrArea.data.name,
          })}
        </Banner>
      )}
      <div className="grid gap-8">
        <WhatSection form={form} photos={photos} onPhotosChange={setPhotos} />
        <WhereSection form={form} fix={fix} onFixChange={changeFix} />
      </div>
      <BottomBar>
        <Button type="submit" variant="primary" size="xl" className="flex-1" loading={form.formState.isSubmitting}>
          {t('field.report.send')}
        </Button>
      </BottomBar>
    </form>
  );
}
