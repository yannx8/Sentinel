import type { IncidentDetail } from '@sentinel/shared';
import { MapPinCheck, Navigation, Phone } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonClass } from '../../components/ui/button';
import { useT } from '../../i18n';
import { useIncidentAction } from '../../lib/incidents';

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/** What an intervenant needs once on the way: directions, a call, and "I am on site" with a position. */
export function SiteActions({ incident }: { incident: IncidentDetail }) {
  const { t } = useT();
  const arrive = useIncidentAction();
  const [locating, setLocating] = useState(false);
  const assignmentId = incident.liveAssignment?.id;
  const { latitude, longitude, contactPhone } = incident.site;
  const canArrive = !!assignmentId && incident.actions.includes('progress');
  if (!canArrive && latitude === null && !contactPhone) return null;

  const send = (fix?: { latitude: number; longitude: number; accuracy: number }) =>
    arrive.mutate(
      {
        path: `/assignments/${assignmentId}/progress`,
        body: { progressType: 'ON_SITE', note: t('field.siteActions.arrivedNote'), ...fix },
        success: t('field.siteActions.arrivedDone'),
      },
      { onSettled: () => setLocating(false) },
    );

  // A refused or failed position still records the arrival, without a fix.
  const onSite = () => {
    setLocating(true);
    if (!('geolocation' in navigator)) return send();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        send({
          latitude: round(coords.latitude),
          longitude: round(coords.longitude),
          accuracy: Math.max(1, Math.round(coords.accuracy)),
        }),
      () => send(),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canArrive && (
        <Button size="lg" loading={locating || arrive.isPending} onClick={onSite}>
          <MapPinCheck className="size-5" aria-hidden />
          {t('field.siteActions.onSite')}
        </Button>
      )}
      {latitude !== null && incident.site.longitude !== null && (
        <a
          className={buttonClass({ size: 'lg' })}
          href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation className="size-5" aria-hidden />
          {t('field.siteActions.directions')}
        </a>
      )}
      {contactPhone && (
        <a className={buttonClass({ size: 'lg' })} href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`}>
          <Phone className="size-5" aria-hidden />
          {t('field.siteActions.call')}
        </a>
      )}
    </div>
  );
}
