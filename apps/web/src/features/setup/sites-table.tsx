import type { SiteDTO } from '@sentinel/shared';
import { TriangleAlert } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/feedback';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { NotSet, OpenIncidentsLink, rowOpener } from './parts';
import { usePlural } from './plural';

/** Two stacked lines in a cell: the value, then a quieter detail. */
function Stacked({ main, detail, muted }: { main: string; detail?: string | null; muted?: boolean }) {
  return (
    <>
      <span className={cn('block max-w-64 truncate', muted ? 'text-ink-3' : 'text-ink-2')}>{main}</span>
      {detail && <span className="block max-w-64 truncate text-xs text-ink-3">{detail}</span>}
    </>
  );
}

function SiteRow({ site, onOpen }: { site: SiteDTO; onOpen: (site: SiteDTO) => void }) {
  const { t, number } = useT();
  const tn = usePlural();
  const muted = !site.isActive;
  const place = site.address ?? site.city;
  const contact = site.contactName ?? site.contactPhone;

  return (
    <Tr interactive onClick={rowOpener(() => onOpen(site))}>
      <Td className="min-w-40 sm:min-w-44">
        <button
          type="button"
          onClick={() => onOpen(site)}
          className={cn(
            'block max-w-72 truncate rounded-xs text-left font-medium underline-offset-2 hover:underline',
            muted ? 'text-ink-2' : 'text-ink',
          )}
        >
          {site.name}
        </button>
        <span className="flex items-center gap-2 text-xs text-ink-3">
          <span>
            {site.code}
            {site.city && <span className="md:hidden"> · {site.city}</span>}
          </span>
          {muted && <Badge className="sm:hidden">{t('common.inactive')}</Badge>}
        </span>
      </Td>
      <Td className="hidden md:table-cell">
        {place ? <Stacked main={place} detail={site.address ? site.city : null} muted={muted} /> : <NotSet />}
      </Td>
      <Td className="hidden lg:table-cell">
        {contact ? <Stacked main={contact} detail={site.contactName ? site.contactPhone : null} muted={muted} /> : <NotSet />}
      </Td>
      <Td className="text-right">
        <OpenIncidentsLink
          count={site.openIncidents}
          label={tn('setup.sites.openIncidents', site.openIncidents, { site: site.name })}
          filter={{ site: site.id }}
          muted={muted}
        />
      </Td>
      <Td className={cn('hidden text-right sm:table-cell', muted ? 'text-ink-3' : 'text-ink-2')}>
        {site.isActive && site.intervenants === 0 ? (
          // Nobody can be assigned here yet: worth a glance, not an alarm.
          <span className="inline-flex items-center gap-1 text-medium-ink" title={t('setup.sites.noIntervenants')}>
            <TriangleAlert className="size-3.5" aria-hidden />
            {number(0)}
            <span className="sr-only">{t('setup.sites.noIntervenants')}</span>
          </span>
        ) : (
          number(site.intervenants)
        )}
      </Td>
      <Td className="hidden sm:table-cell">
        <Badge tone={site.isActive ? 'success' : 'neutral'}>{t(site.isActive ? 'common.active' : 'common.inactive')}</Badge>
      </Td>
    </Tr>
  );
}

function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <Tr key={index}>
          <Td>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-14" />
          </Td>
          <Td className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </Td>
          <Td className="hidden lg:table-cell">
            <Skeleton className="h-3.5 w-28" />
          </Td>
          <Td>
            <Skeleton className="ml-auto h-3.5 w-5" />
          </Td>
          <Td className="hidden sm:table-cell">
            <Skeleton className="ml-auto h-3.5 w-5" />
          </Td>
          <Td className="hidden sm:table-cell">
            <Skeleton className="h-5 w-12" />
          </Td>
        </Tr>
      ))}
    </>
  );
}

export function SitesTable({
  sites,
  loading,
  onOpen,
}: {
  sites: SiteDTO[];
  loading?: boolean;
  onOpen: (site: SiteDTO) => void;
}) {
  const { t } = useT();
  return (
    <Table>
      <caption className="sr-only">{t('setup.sites.title')}</caption>
      <THead>
        <tr>
          <Th>{t('setup.sites.columns.site')}</Th>
          <Th className="hidden md:table-cell">{t('setup.sites.columns.address')}</Th>
          <Th className="hidden lg:table-cell">{t('setup.sites.columns.contact')}</Th>
          <Th className="text-right">{t('setup.sites.columns.openIncidents')}</Th>
          <Th className="hidden text-right sm:table-cell" title={t('setup.sites.columns.intervenantsHint')}>
            {t('setup.sites.columns.intervenants')}
          </Th>
          <Th className="hidden w-24 sm:table-cell">{t('setup.sites.columns.status')}</Th>
        </tr>
      </THead>
      <tbody aria-busy={loading || undefined}>
        {loading ? <SkeletonRows /> : sites.map((site) => <SiteRow key={site.id} site={site} onOpen={onOpen} />)}
      </tbody>
    </Table>
  );
}
