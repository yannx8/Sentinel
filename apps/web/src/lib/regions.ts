import type { Locale } from '@sentinel/shared';

/** Countries offered at registration, named in the person's language. */
const countryCodes = [
  'FR', 'BE', 'LU', 'CH', 'MC', 'DE', 'NL', 'ES', 'PT', 'IT', 'IE', 'GB', 'AT', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ',
  'RO', 'GR', 'US', 'CA', 'MA', 'TN', 'DZ', 'SN', 'CI', 'CM', 'AE', 'SA', 'QA', 'SG', 'AU', 'BR', 'MX', 'IN', 'JP',
];

export function countryOptions(locale: Locale) {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return countryCodes
    .map((code) => ({ value: code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function timeZoneOptions() {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Europe/Paris', 'UTC'];
  return zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }));
}

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
}

/** Best guess of the country from the browser language, for example fr-BE gives BE. */
export function browserCountry() {
  const region = navigator.language.split('-')[1]?.toUpperCase();
  return region && countryCodes.includes(region) ? region : 'FR';
}
