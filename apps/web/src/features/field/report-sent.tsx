import type { IncidentDetail } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { Check, CircleCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, buttonClass } from '../../components/ui/button';
import { Banner } from '../../components/ui/feedback';
import { Spinner } from '../../components/ui/spinner';
import { useT } from '../../i18n';
import { useUploadPhoto } from '../../lib/incidents';
import type { PreparedPhoto } from './photos';

type Progress = { done: string[]; failed: string[]; running: boolean };

/**
 * Attaches the report's photos one by one once the incident exists. The
 * incident is already safe, so a failed photo only offers a retry.
 */
function usePhotoUploads(reference: string, photos: PreparedPhoto[]) {
  const upload = useUploadPhoto(reference);
  const { mutateAsync } = upload;
  const [progress, setProgress] = useState<Progress>({ done: [], failed: [], running: photos.length > 0 });
  const started = useRef(false);

  const run = useCallback(
    async (batch: PreparedPhoto[]) => {
      setProgress((current) => ({ ...current, running: true }));
      for (const photo of batch) {
        try {
          await mutateAsync({ file: photo.file });
          setProgress((current) => ({
            ...current,
            done: [...current.done, photo.id],
            failed: current.failed.filter((id) => id !== photo.id),
          }));
        } catch {
          setProgress((current) => ({
            ...current,
            failed: current.failed.includes(photo.id) ? current.failed : [...current.failed, photo.id],
          }));
        }
      }
      setProgress((current) => ({ ...current, running: false }));
    },
    [mutateAsync],
  );

  useEffect(() => {
    // Once per report, also under StrictMode's double effect run.
    if (started.current || photos.length === 0) return;
    started.current = true;
    void run(photos);
  }, [photos, run]);

  const retry = () => void run(photos.filter((photo) => progress.failed.includes(photo.id)));
  return { progress, retry };
}

/** Confirmation after a report: the reference, what happens next, and two ways on. */
export function ReportSent({
  incident,
  photos,
  onReportAnother,
}: {
  incident: IncidentDetail;
  photos: PreparedPhoto[];
  onReportAnother: () => void;
}) {
  const { t, number } = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const { progress, retry } = usePhotoUploads(incident.reference, photos);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center pt-8 text-center">
      <CircleCheck className="size-16 text-success" strokeWidth={1.5} aria-hidden />
      <h1 ref={heading} tabIndex={-1} className="mt-5 text-2xl font-semibold text-ink outline-none">
        {t('field.report.sentTitle')}
      </h1>
      <p className="mt-2 text-xl font-semibold text-ink tabular-nums">{incident.reference}</p>
      <p className="mt-2 text-md text-ink-2">{t('field.report.sentBody')}</p>

      {photos.length > 0 && (
        <div className="mt-6 w-full" aria-live="polite">
          {progress.running ? (
            <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
              <Spinner className="size-4" />
              {t('field.report.attachingPhotos', {
                done: Math.min(progress.done.length + 1, photos.length),
                total: photos.length,
              })}
            </p>
          ) : progress.failed.length > 0 ? (
            <Banner
              tone="warning"
              className="text-left"
              action={
                <Button size="lg" onClick={retry}>
                  {t('common.retry')}
                </Button>
              }
            >
              {t(progress.failed.length === 1 ? 'field.report.photosFailedOne' : 'field.report.photosFailedOther', {
                count: number(progress.failed.length),
              })}
            </Banner>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-sm text-ink-2">
              <Check className="size-4 text-success" aria-hidden />
              {t(progress.done.length === 1 ? 'field.report.photosAttachedOne' : 'field.report.photosAttachedOther', {
                count: number(progress.done.length),
              })}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 grid w-full gap-2">
        <Link
          to="/field/incidents/$reference"
          params={{ reference: incident.reference }}
          className={buttonClass({ variant: 'primary', size: 'xl', block: true })}
        >
          {t('field.report.viewIncident')}
        </Link>
        <Button size="xl" block onClick={onReportAnother}>
          {t('field.report.reportAnother')}
        </Button>
      </div>
    </div>
  );
}
