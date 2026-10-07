import { LocateFixed } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n';

export type GeoFix = { latitude: number; longitude: number; accuracy: number };

type State = 'idle' | 'locating' | 'denied' | 'unavailable';

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * Optional position for a report. The browser asks for permission only when
 * the button is tapped, and a refusal leaves the written location as the fallback.
 */
export function LocationControl({ fix, onChange }: { fix: GeoFix | null; onChange: (fix: GeoFix | null) => void }) {
  const { t, number } = useT();
  const [state, setState] = useState<State>('idle');
  const id = useId();
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;

  const locate = () => {
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: round(position.coords.latitude),
          longitude: round(position.coords.longitude),
          accuracy: Math.max(1, Math.round(position.coords.accuracy)),
        });
        setState('idle');
      },
      (error) => setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  return (
    <div role="group" aria-labelledby={id} className="grid gap-2">
      <p id={id} className="text-sm font-medium text-ink">
        {t('field.location.label')}
        <span className="ml-1.5 font-normal text-ink-3">{t('common.optional')}</span>
      </p>
      {fix ? (
        <div className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-1.5 pl-4">
          <LocateFixed className="size-5 shrink-0 text-accent" aria-hidden />
          <p role="status" className="min-w-0 flex-1 text-md text-ink">
            {t('field.location.added', { meters: number(fix.accuracy) })}
          </p>
          <Button variant="ghost" size="lg" className="h-11" onClick={() => onChange(null)}>
            {t('common.remove')}
          </Button>
        </div>
      ) : (
        <Button
          size="xl"
          block
          icon={<LocateFixed className="size-5" />}
          loading={state === 'locating'}
          onClick={locate}
        >
          {state === 'locating' ? t('field.location.locating') : t('field.location.use')}
        </Button>
      )}
      {!fix && (
        <p role={state === 'denied' || state === 'unavailable' ? 'status' : undefined} className="text-sm text-ink-3">
          {state === 'denied'
            ? t('field.location.denied')
            : state === 'unavailable'
              ? t('field.location.unavailable')
              : t('field.location.hint')}
        </p>
      )}
    </div>
  );
}
