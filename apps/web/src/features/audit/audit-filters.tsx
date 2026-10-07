import { auditEventTypes } from '@sentinel/shared';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { useT } from '../../i18n';

export type AuditSearchPatch = { type?: string; incident?: string; actor?: string; from?: string; to?: string };

const ALL = 'all';

/** Event type, incident reference and date range. Every change lands in the URL so a filtered view can be shared. */
export function AuditFilters({
  search,
  actorName,
  onChange,
  onClear,
}: {
  search: AuditSearchPatch;
  /** Name of the person the log is filtered on, when known from the loaded entries. */
  actorName: string | null;
  onChange: (patch: AuditSearchPatch) => void;
  onClear: () => void;
}) {
  const { t } = useT();
  const [incident, setIncident] = useState(search.incident ?? '');
  useEffect(() => setIncident(search.incident ?? ''), [search.incident]);

  const commitIncident = () => {
    const value = incident.trim().toUpperCase();
    if (value !== (search.incident ?? '')) onChange({ incident: value || undefined });
  };

  const rangeInvalid = !!search.from && !!search.to && search.to < search.from;
  const active = Object.values(search).some(Boolean);
  const typeOptions = [
    { value: ALL, label: t('audit.filters.allTypes') },
    ...auditEventTypes.map((type) => ({ value: type, label: t(`audit.types.${type}`) })),
  ];

  return (
    <div className="grid gap-3">
      <form
        role="search"
        aria-label={t('audit.filters.label')}
        onSubmit={(event) => {
          event.preventDefault();
          commitIncident();
        }}
        className="grid grid-cols-2 items-start gap-3 sm:flex sm:flex-wrap"
      >
        <Field label={t('audit.filters.type')} className="col-span-2 sm:w-60">
          <Select
            value={search.type && (auditEventTypes as readonly string[]).includes(search.type) ? search.type : ALL}
            onValueChange={(value) => onChange({ type: value === ALL ? undefined : value })}
            options={typeOptions}
          />
        </Field>
        <Field label={t('audit.filters.incident')} className="col-span-2 sm:w-48">
          <Input
            value={incident}
            onChange={(event) => setIncident(event.target.value)}
            onBlur={commitIncident}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitIncident();
              }
            }}
            placeholder={t('audit.filters.incidentPlaceholder')}
            leading={<Search />}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={40}
          />
        </Field>
        <Field label={t('audit.filters.from')} className="sm:w-40">
          <Input
            type="date"
            value={search.from ?? ''}
            max={search.to || undefined}
            onChange={(event) => onChange({ from: event.target.value || undefined })}
          />
        </Field>
        <Field label={t('audit.filters.to')} className="sm:w-40" error={rangeInvalid ? t('audit.filters.rangeError') : undefined}>
          <Input
            type="date"
            value={search.to ?? ''}
            min={search.from || undefined}
            onChange={(event) => onChange({ to: event.target.value || undefined })}
          />
        </Field>
        {active && (
          <div className="col-span-2 flex sm:pt-[26px]">
            <Button variant="ghost" icon={<X className="size-4" aria-hidden />} onClick={onClear}>
              {t('audit.filters.clear')}
            </Button>
          </div>
        )}
      </form>
      {search.actor && (
        <div>
          <span className="inline-flex h-7 items-center gap-1 rounded-sm border border-line-strong pr-1 pl-2.5 text-sm text-ink-2">
            {actorName ? t('audit.filters.actor', { name: actorName }) : t('audit.filters.actorUnknown')}
            <button
              type="button"
              onClick={() => onChange({ actor: undefined })}
              aria-label={t('audit.filters.removeActor')}
              className="flex size-5 items-center justify-center rounded-xs text-ink-3 hover:bg-muted hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
