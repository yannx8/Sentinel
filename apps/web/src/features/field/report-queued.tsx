import { CloudOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n';

/** After a report was saved on the phone because there is no connection. */
export function ReportQueued({ onReportAnother }: { onReportAnother: () => void }) {
  const { t } = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, []);
  return (
    <div className="flex flex-col items-center pt-8 text-center">
      <CloudOff className="size-16 text-accent" strokeWidth={1.5} aria-hidden />
      <h1 ref={heading} tabIndex={-1} className="mt-5 text-2xl font-semibold text-ink outline-none">
        {t('offline.queuedTitle')}
      </h1>
      <p className="mt-2 max-w-sm text-md text-ink-2">{t('offline.queuedBody')}</p>
      <Button size="xl" className="mt-8" onClick={onReportAnother}>
        {t('field.report.reportAnother')}
      </Button>
    </div>
  );
}
