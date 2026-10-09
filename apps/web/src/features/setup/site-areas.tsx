import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { useAreaMutations, useSiteAreas } from './queries';

/** Areas of a site, each with its own QR code, and the link to the printable sheet. */
export function SiteAreas({ siteId }: { siteId: string }) {
  const { t } = useT();
  const areas = useSiteAreas(siteId);
  const { add, update } = useAreaMutations(siteId);
  const [name, setName] = useState('');

  const submit = () => {
    const value = name.trim();
    if (value.length >= 2) add.mutate(value, { onSuccess: () => setName('') });
  };

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{t('setup.sites.areas.title')}</h3>
        <a
          href={`/print/qr/${siteId}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-accent hover:underline"
        >
          {t('setup.sites.areas.printSheet')}
        </a>
      </div>
      <p className="text-sm text-ink-3">{t('setup.sites.areas.hint')}</p>
      {areas.data && areas.data.areas.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {areas.data.areas.map((area) => (
            <li key={area.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className={area.isActive ? 'text-md text-ink' : 'text-md text-ink-3 line-through'}>
                {area.name}
              </span>
              <Button
                variant="ghost"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: area.id, patch: { isActive: !area.isActive } })}
              >
                {area.isActive ? t('setup.sites.areas.deactivate') : t('setup.sites.areas.reactivate')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={t('setup.sites.areas.nameLabel')}
          placeholder={t('setup.sites.areas.namePlaceholder')}
          maxLength={80}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button loading={add.isPending} onClick={submit}>
          {t('setup.sites.areas.add')}
        </Button>
      </div>
    </section>
  );
}
