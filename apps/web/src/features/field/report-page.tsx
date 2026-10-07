import { zodResolver } from '@hookform/resolvers/zod';
import { createIncidentSchema, type IncidentDetail } from '@sentinel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { useMembership } from '../../app/session';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n';
import { api, ApiError, newIdempotencyKey } from '../../lib/api';
import { applyServerErrors, toastError } from '../../lib/forms';
import { incidentKeys } from '../../lib/incidents';
import type { GeoFix } from './location-control';
import { BottomBar, StepProgress } from './parts';
import type { PreparedPhoto } from './photos';
import { ReportSent } from './report-sent';
import { StepReview, StepWhat, StepWhere, type ReportInput, type ReportOutput } from './report-steps';

/** Fields checked before leaving each step. The last step only reviews. */
const stepFields: FieldPath<ReportInput>[][] = [
  ['title', 'description', 'categoryId'],
  ['siteId', 'locationDetail', 'latitude', 'longitude'],
];
const LAST_STEP = 2;

/** Employees report in three steps. Intervenants do not report and land on their work. */
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
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [sent, setSent] = useState<IncidentDetail | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  /** One key per submission, reused when the same report is retried after a failure. */
  const attempt = useRef<{ key: string; body: string } | null>(null);

  const form = useForm<ReportInput, unknown, ReportOutput>({
    resolver: zodResolver(createIncidentSchema),
    mode: 'onTouched',
    defaultValues: { title: '', description: '', categoryId: '', siteId: '', locationDetail: '' },
  });

  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [step]);

  const goTo = (next: number) => {
    moved.current = true;
    setStep(next);
  };

  const changeFix = (next: GeoFix | null) => {
    setFix(next);
    form.setValue('latitude', next?.latitude);
    form.setValue('longitude', next?.longitude);
  };

  const next = async () => {
    if (await form.trigger(stepFields[step] ?? [], { shouldFocus: true })) goTo(step + 1);
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
      if (applyServerErrors(form, error) && error instanceof ApiError) {
        const fields = Object.keys(error.fields);
        const failing = stepFields.findIndex((group) => group.some((name) => fields.includes(name)));
        if (failing >= 0) goTo(failing);
      } else {
        toastError(error, t);
      }
    }
  });

  // Enter in a field moves forward instead of sending a half-filled report.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (step < LAST_STEP) {
      event.preventDefault();
      void next();
      return;
    }
    void send(event);
  };

  if (sent) return <ReportSent incident={sent} photos={photos} onReportAnother={onReportAnother} />;

  const titles = [t('field.report.steps.what'), t('field.report.steps.where'), t('field.report.steps.review')];
  const submitting = form.formState.isSubmitting;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 pb-6">
        <StepProgress current={step} total={titles.length} />
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
          {titles[step]}
        </h1>
      </div>

      {step === 0 && <StepWhat form={form} photos={photos} onPhotosChange={setPhotos} />}
      {step === 1 && <StepWhere form={form} fix={fix} onFixChange={changeFix} />}
      {step === LAST_STEP && <StepReview values={form.getValues()} photos={photos} fix={fix} onEdit={goTo} />}

      <BottomBar>
        {step > 0 && (
          <Button size="xl" disabled={submitting} onClick={() => goTo(step - 1)}>
            {t('common.back')}
          </Button>
        )}
        <Button type="submit" variant="primary" size="xl" className="flex-1" loading={step === LAST_STEP && submitting}>
          {step === LAST_STEP ? t('field.report.send') : t('field.report.continue')}
        </Button>
      </BottomBar>
    </form>
  );
}
