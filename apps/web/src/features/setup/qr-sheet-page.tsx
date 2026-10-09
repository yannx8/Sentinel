import type { SiteAreasDTO } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { LoadError } from './parts';
import { useSites } from './queries';

function Code({ label, token }: { label: string; token: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    void QRCode.toString(`${window.location.origin}/r/${token}`, { type: 'svg', margin: 1, width: 220 }).then(
      (value) => live && setSvg(value),
    );
    return () => {
      live = false;
    };
  }, [token]);
  return (
    <figure className="flex break-inside-avoid flex-col items-center gap-2 rounded-lg border border-line p-4">
      <div role="img" aria-label={label} className="size-[220px]" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="text-center text-lg font-semibold text-ink">{label}</figcaption>
    </figure>
  );
}

/** One A4 sheet per site: a code for the whole site and one per active area, each with its name. */
export function QrSheetPage() {
  const { t } = useT();
  const { siteId } = useParams({ from: '/print/qr/$siteId' });
  const sites = useSites();
  const codes = useQuery({
    queryKey: ['site-areas', siteId],
    queryFn: ({ signal }) => api.get<SiteAreasDTO>(`/sites/${siteId}/areas`, { signal }),
  });
  const site = sites.data?.find((item) => item.id === siteId);

  if (codes.isError)
    return <LoadError error={codes.error} onRetry={() => void codes.refetch()} retrying={codes.isFetching} />;
  if (!codes.data || !site) return <Skeleton className="m-8 h-64" />;

  return (
    <main className="mx-auto max-w-[210mm] p-8">
      <header className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <h1 className="text-xl font-semibold text-ink">{t('setup.sites.qr.title', { site: site.name })}</h1>
        <Button variant="primary" onClick={() => window.print()}>
          {t('setup.sites.qr.print')}
        </Button>
      </header>
      <p className="mb-4 hidden text-2xl font-semibold print:block">{site.name}</p>
      <div className="grid grid-cols-2 gap-4">
        <Code label={site.name} token={codes.data.siteToken} />
        {codes.data.areas
          .filter((area) => area.isActive)
          .map((area) => (
            <Code key={area.id} label={`${site.name} · ${area.name}`} token={area.token} />
          ))}
      </div>
    </main>
  );
}
