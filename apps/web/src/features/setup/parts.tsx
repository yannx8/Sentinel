import { Link } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { useT, type Formatter } from '../../i18n';
import { ApiError } from '../../lib/api';
import { applyServerErrors, errorMessage, toastError } from '../../lib/forms';

/** An optional value that was never filled in. Screen readers hear "Not set" instead of a dash. */
export function NotSet() {
  const { t } = useT();
  return (
    <span className="text-ink-3">
      <span aria-hidden>-</span>
      <span className="sr-only">{t('setup.notSet')}</span>
    </span>
  );
}

/** Replaces a list inside its Panel when the first load fails. */
export function LoadError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const { t } = useT();
  return (
    <EmptyState
      title={t('setup.loadError')}
      description={errorMessage(error, t)}
      action={
        <Button onClick={onRetry} loading={retrying}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}

/**
 * Open incident count that opens the inbox filtered on the site or category.
 * Zero is plain text: there is nothing to look at.
 */
export function OpenIncidentsLink({
  count,
  label,
  filter,
  muted,
}: {
  count: number;
  /** Full sentence for screen readers, since the visible text is only a number. */
  label: string;
  filter: { site: string } | { category: string };
  muted?: boolean;
}) {
  const { number } = useT();
  if (count === 0) return <span className="text-ink-3">{number(0)}</span>;
  return (
    <Link
      to="/app/incidents"
      search={{ view: 'open', ...filter }}
      aria-label={label}
      className={
        muted
          ? 'font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline'
          : 'font-medium text-accent underline-offset-2 hover:text-accent-hover hover:underline'
      }
    >
      {number(count)}
    </Link>
  );
}

/**
 * Click handler for a table row that opens its item. Clicks on links and
 * controls inside the row keep their own behaviour, and so does selecting text.
 * Keyboard users reach the same action through the button in the first cell.
 */
export function rowOpener(open: () => void) {
  return (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection()?.toString()) return;
    open();
  };
}

/** Lowercase without accents, so "lyon" finds "Lyon" and "evry" finds "Évry". */
export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Shows a failed save on its form. A uniqueness conflict on `conflict.field`
 * gets a translated message, other field errors come from the API, and
 * anything that is not about a field becomes a toast.
 */
export function showSaveError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  t: Formatter['t'],
  conflict?: { field: Path<T>; message: string },
) {
  if (conflict && error instanceof ApiError && error.code === 'CONFLICT' && error.fields[conflict.field]) {
    form.setError(conflict.field, { type: 'server', message: conflict.message }, { shouldFocus: true });
    return;
  }
  if (!applyServerErrors(form, error)) toastError(error, t);
}
