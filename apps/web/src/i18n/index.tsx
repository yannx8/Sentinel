import type { Locale } from '@sentinel/shared';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { en, type Dictionary } from './en';
import { fr } from './fr';
import type { Translation } from './types';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
/** Base of a plural pair: `fooOne` and `fooOther` give `foo`. */
export type PluralKey = TKey extends infer K ? (K extends `${infer Base}One` ? Base : never) : never;
type Vars = Record<string, string | number>;

const dictionaries: Record<Locale, Translation<Dictionary>> = { en, fr };

function lookup(dictionary: Translation<Dictionary>, key: string): string {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === 'string' ? node : key;
}

export function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem('sentinel.locale');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    // storage unavailable
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export type Formatter = {
  locale: Locale;
  timeZone: string;
  t: (key: TKey, vars?: Vars) => string;
  /** Picks `${key}One` or `${key}Other` by count, and passes {count}. */
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  date: (iso: string | Date, style?: 'date' | 'datetime' | 'time' | 'short' | 'weekday') => string;
  relative: (iso: string | Date) => string;
  duration: (minutes: number | null) => string;
  number: (value: number) => string;
};

const I18nContext = createContext<Formatter | null>(null);

export function I18nProvider({
  locale,
  timeZone,
  children,
}: {
  locale: Locale;
  timeZone: string;
  children: ReactNode;
}) {
  const dictionary = dictionaries[locale];
  const t = useCallback((key: TKey, vars?: Vars) => interpolate(lookup(dictionary, key), vars), [dictionary]);

  const value = useMemo<Formatter>(() => {
    const dateFormats = {
      date: new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short', year: 'numeric' }),
      datetime: new Intl.DateTimeFormat(locale, {
        timeZone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      time: new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit' }),
      short: new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short' }),
      weekday: new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long' }),
    };
    const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    const numberFormat = new Intl.NumberFormat(locale);

    return {
      locale,
      timeZone,
      t,
      tn: (key, count, vars) =>
        interpolate(lookup(dictionary, `${key}${count === 1 ? 'One' : 'Other'}`), {
          count: numberFormat.format(count),
          ...vars,
        }),
      date: (iso, style = 'datetime') => dateFormats[style].format(typeof iso === 'string' ? new Date(iso) : iso),
      relative: (iso) => {
        const ms = (typeof iso === 'string' ? new Date(iso) : iso).getTime() - Date.now();
        const abs = Math.abs(ms);
        if (abs < 45_000) return t('common.justNow');
        if (abs < 3_600_000) return relativeFormat.format(Math.round(ms / 60_000), 'minute');
        if (abs < 86_400_000) return relativeFormat.format(Math.round(ms / 3_600_000), 'hour');
        if (abs < 7 * 86_400_000) return relativeFormat.format(Math.round(ms / 86_400_000), 'day');
        return dateFormats.short.format(new Date(Date.now() + ms));
      },
      duration: (minutes) => {
        if (minutes === null) return '-';
        const m = Math.max(0, Math.round(minutes));
        if (m < 60) return t('common.minutesShort', { n: m });
        if (m < 24 * 60) {
          const h = Math.floor(m / 60);
          const rest = m % 60;
          return rest ? t('common.hoursMinutesShort', { h, m: rest }) : t('common.hoursShort', { n: h });
        }
        const d = Math.floor(m / 1440);
        const h = Math.floor((m % 1440) / 60);
        return h ? t('common.daysHoursShort', { d, h }) : t('common.daysShort', { n: d });
      },
      number: (value) => numberFormat.format(value),
    };
  }, [dictionary, locale, t, timeZone]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Formatter {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT must be used inside I18nProvider');
  return value;
}
