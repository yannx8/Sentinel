import { useI18n } from '../i18n';

/** Locale-aware relative time using Intl.RelativeTimeFormat. */
export function timeAgo(dateStr: string, locale: 'fr' | 'en' = 'en'): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.round(diff / 1000);
  const formatter = new Intl.RelativeTimeFormat(
    locale === 'fr' ? 'fr-FR' : 'en-US',
    { numeric: 'auto' }
  );

  if (Math.abs(seconds) < 60) return formatter.format(-seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(-days, 'day');
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 4) return formatter.format(-weeks, 'week');
  const months = Math.round(days / 30);
  return formatter.format(-months, 'month');
}

/** Returns a date formatter that uses the active locale (fr-FR / en-US). */
export function useFormatDate() {
  const locale = useI18n((s) => s.locale);
  return (v: string) => new Date(v).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

/** Returns a date+time formatter that uses the active locale. */
export function useFormatDateTime() {
  const locale = useI18n((s) => s.locale);
  return (v: string) => new Date(v).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US');
}

/** Hook wrapper around timeAgo that stays in sync with the active locale. */
export function useTimeAgo() {
  const locale = useI18n((s) => s.locale);
  return (dateStr: string): string => timeAgo(dateStr, locale);
}

export function escapeHtml(v: string) {
  return v.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] || c));
}
