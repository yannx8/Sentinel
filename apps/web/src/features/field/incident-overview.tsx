import type { AttachmentDTO, IncidentDetail } from '@sentinel/shared';
import { MapPin, Phone } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useMembership } from '../../app/session';
import { PriorityLabel, StatusLabel } from '../../components/domain/glyphs';
import { Banner, Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { resourceUrl } from '../../lib/api';

const inlineLink =
  'inline-flex min-h-11 items-center gap-1.5 font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline [&_svg]:size-4';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-4 py-2.5">
      <dt className="pt-0.5 text-sm text-ink-3">{label}</dt>
      <dd className="min-h-6 text-md break-words text-ink">{children}</dd>
    </div>
  );
}

function mapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`;
}

function PhotoStrip({ attachments }: { attachments: AttachmentDTO[] }) {
  const { t } = useT();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold text-ink">
        {t('field.incident.photos')}
      </h2>
      <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="shrink-0">
            <a
              href={resourceUrl(attachment.url)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border border-line bg-subtle"
            >
              <img
                src={resourceUrl(attachment.url)}
                alt={t('field.incident.openPhoto', { name: attachment.fileName })}
                loading="lazy"
                className="h-28 w-36 object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Header, key facts, description and photos of an incident, as read on a phone. */
export function IncidentOverview({ incident }: { incident: IncidentDetail }) {
  const { t, date } = useT();
  const membership = useMembership();
  const descriptionId = useId();
  const own = incident.reporter.membershipId === membership.id;
  const assignee = incident.liveAssignment;
  const mine = assignee?.intervenant.membershipId === membership.id;
  const position =
    incident.latitude !== null && incident.longitude !== null
      ? { lat: incident.latitude, lng: incident.longitude }
      : null;

  return (
    <>
      <header className="grid gap-2">
        <p className="text-sm font-medium text-ink-3 tabular-nums">{incident.reference}</p>
        <h1 className="text-2xl font-semibold break-words text-ink">{incident.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusLabel status={incident.status} className="text-md" />
          <PriorityLabel priority={incident.priority} className="text-md" />
        </div>
      </header>

      {mine && assignee?.status === 'REASSIGNMENT_REQUESTED' && (
        <Banner tone="info">{t('field.incident.reassignmentPending')}</Banner>
      )}
      {mine && incident.flags.sentBack && <Banner tone="warning">{t('field.incident.sentBack')}</Banner>}

      <dl className="divide-y divide-line border-y border-line">
        <Detail label={t('field.incident.site')}>{incident.site.name}</Detail>
        {(incident.locationDetail || position) && (
          <Detail label={t('field.incident.locationDetail')}>
            {incident.locationDetail && <span className="block">{incident.locationDetail}</span>}
            {position && (
              <a href={mapUrl(position.lat, position.lng)} target="_blank" rel="noreferrer" className={inlineLink}>
                <MapPin aria-hidden />
                {t('field.incident.showOnMap')}
              </a>
            )}
          </Detail>
        )}
        <Detail label={t('field.incident.category')}>{incident.category.name}</Detail>
        <Detail label={t('field.incident.reportedBy')}>
          <span className="block">{own ? t('common.you') : incident.reporter.name || t('incidents.visitor')}</span>
          {incident.reporterPhone && (
            <a href={`tel:${incident.reporterPhone.replace(/[^\d+]/g, '')}`} className={inlineLink}>
              <Phone aria-hidden />
              <span className="tabular-nums">{incident.reporterPhone}</span>
            </a>
          )}
        </Detail>
        <Detail label={t('field.incident.reported')}>
          <time dateTime={incident.createdAt}>{date(incident.createdAt)}</time>
        </Detail>
      </dl>

      <section aria-labelledby={descriptionId}>
        <h2 id={descriptionId} className="text-sm font-semibold text-ink">
          {t('field.incident.description')}
        </h2>
        <p className="mt-1.5 text-md break-words whitespace-pre-line text-ink">{incident.description}</p>
      </section>

      {incident.attachments.length > 0 && <PhotoStrip attachments={incident.attachments} />}
    </>
  );
}

/** Same shape as the incident screen while it loads. */
export function IncidentSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <Skeleton className="h-6 w-28" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-11/12" />
        <Skeleton className="h-7 w-3/5" />
        <div className="mt-1 flex gap-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="divide-y divide-line border-y border-line">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="grid grid-cols-[7.5rem_1fr] gap-x-4 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}
