import type { PublicTrackDTO } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Link2Off } from 'lucide-react';
import { Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { AuthStatus } from '../auth/parts';

/** Where a visitor follows their report. The link is the only credential, so it shows no names and no notes. */
export function TrackPage() {
  const { t, date } = useT();
  const { token } = useParams({ from: '/public/t/$token' });
  const report = useQuery({
    queryKey: ['public-track', token],
    queryFn: ({ signal }) => api.get<PublicTrackDTO>(`/public/track/${token}`, { signal }),
    retry: false,
    refetchInterval: 60_000,
  });

  if (report.isPending) return <Skeleton className="h-40 w-full max-w-[400px]" />;
  if (report.isError) {
    return (
      <AuthStatus icon={<Link2Off />} title={t('field.track.invalidTitle')}>
        <p>{t('field.track.invalidBody')}</p>
      </AuthStatus>
    );
  }
  const data = report.data;
  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-6 shadow-pop">
      <p className="text-sm text-ink-3">{data.siteName}</p>
      <h1 className="text-xl font-semibold text-ink">{data.reference}</h1>
      <p className="mt-3 text-md text-ink">{t(`field.track.status.${data.status}`)}</p>
      <p className="mt-1 text-sm text-ink-3">{t('field.track.sent', { date: date(data.createdAt, 'datetime') })}</p>
      {data.events.length > 0 && (
        <ol className="mt-4 grid gap-1 border-t border-line pt-3 text-sm text-ink-2">
          {data.events.map((event, index) => (
            <li key={index}>
              {date(event.createdAt, 'datetime')}: {t(`field.track.event.${event.type}`)}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-sm text-ink-3">{t('field.track.keepLink')}</p>
    </div>
  );
}
