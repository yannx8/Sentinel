import type { PublicSiteDTO } from '@sentinel/shared';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Field } from '../../components/ui/field';
import { Input, Textarea } from '../../components/ui/input';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { ChoiceList } from '../field/choice-list';

/** A visitor's report from a QR code: a category, a few words, and optionally a name and phone to be reached. */
export function GuestReportForm({ token, site }: { token: string; site: PublicSiteDTO }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryId) {
      setMissing(true);
      return;
    }
    setSubmitting(true);
    try {
      const sent = await api.post<{ trackingToken: string }>(`/public/sites/${token}/reports`, {
        categoryId,
        description,
        guestName,
        guestPhone,
        consent,
        website,
        locationDetail: site.areaName ?? undefined,
      });
      await navigate({ to: '/t/$token', params: { token: sent.trackingToken }, replace: true });
    } catch (error) {
      toastError(error, t);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid w-full max-w-[480px] gap-6 p-4">
      <div>
        <p className="text-sm text-ink-3">{site.organizationName}</p>
        <h1 className="text-2xl font-semibold text-ink">
          {t('field.qr.guestTitle', { place: site.areaName ? `${site.siteName}, ${site.areaName}` : site.siteName })}
        </h1>
      </div>
      <ChoiceList
        name="categoryId"
        label={t('field.report.categoryLabel')}
        options={site.categories.map((category) => ({ value: category.id, label: category.name }))}
        value={categoryId}
        onChange={(value) => {
          setCategoryId(value);
          setMissing(false);
        }}
        searchLabel={t('field.report.searchCategories')}
        error={missing ? t('field.report.chooseCategory') : undefined}
        chips
      />
      <Field label={t('field.report.descriptionLabel')} optional>
        <Textarea
          rows={4}
          maxLength={4000}
          className="text-md"
          placeholder={t('field.report.descriptionPlaceholder')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Field label={t('field.qr.nameLabel')} optional>
        <Input
          inputSize="lg"
          maxLength={80}
          autoComplete="name"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
      </Field>
      <Field label={t('field.qr.phoneLabel')} optional hint={t('field.qr.phoneHint')}>
        <Input
          inputSize="lg"
          type="tel"
          inputMode="tel"
          maxLength={32}
          autoComplete="tel"
          value={guestPhone}
          onChange={(event) => setGuestPhone(event.target.value)}
        />
      </Field>
      {guestPhone.trim() && (
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <Checkbox checked={consent} onCheckedChange={setConsent} className="mt-0.5" />
          {t('field.qr.consent', { organization: site.organizationName })}
        </label>
      )}
      {/* Honeypot: people never see or fill this field. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] size-0 opacity-0"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
      />
      <Button type="submit" variant="primary" size="xl" loading={submitting} disabled={!!guestPhone.trim() && !consent}>
        {t('field.report.send')}
      </Button>
    </form>
  );
}
