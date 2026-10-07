import { CircleAlert, Search } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/feedback';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

export type ChecklistOption = { value: string; label: string; hint?: string };

/** A filter field appears from this many options, so long site lists stay usable. */
const FILTER_FROM = 9;

/**
 * A labelled group of checkboxes, for specialties and site access. With `selectAll`,
 * a first row checks or clears every option shown (the filtered ones when filtering).
 */
export function Checklist({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  selectAll,
  loading,
  disabled,
  empty,
  filterLabel,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  options: ChecklistOption[];
  value: string[];
  onChange: (value: string[]) => void;
  selectAll?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Shown instead of the list when there is nothing to choose from. */
  empty: ReactNode;
  filterLabel: string;
}) {
  const { t } = useT();
  const id = useId();
  const [filter, setFilter] = useState('');
  const selected = new Set(value);
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLowerCase().includes(needle))
    : options;
  const shownChecked = shown.filter((option) => selected.has(option.value)).length;
  const allState =
    shown.length > 0 && shownChecked === shown.length ? true : shownChecked > 0 ? 'indeterminate' : false;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const toggle = (optionValue: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(optionValue);
    else next.delete(optionValue);
    onChange(options.filter((option) => next.has(option.value)).map((option) => option.value));
  };

  const toggleShown = (checked: boolean) => {
    const next = new Set(selected);
    for (const option of shown) {
      if (checked) next.add(option.value);
      else next.delete(option.value);
    }
    onChange(options.filter((option) => next.has(option.value)).map((option) => option.value));
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
          <span className="ml-1.5 font-normal text-ink-3">{t('common.optional')}</span>
        </span>
        {options.length > 0 && (
          <span className="text-xs text-ink-3 tabular-nums">
            {t('team.checklist.selected', { count: selected.size, total: options.length })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-2 rounded-sm border border-line px-3 py-3" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-2.5">
              <Skeleton className="size-4" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      ) : options.length === 0 ? (
        <div className="rounded-sm border border-dashed border-line-strong px-3 py-3 text-sm text-ink-3">{empty}</div>
      ) : (
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          className={cn(
            'overflow-hidden rounded-sm border bg-surface shadow-control',
            error ? 'border-critical' : 'border-line-strong/90',
            disabled && 'opacity-60',
          )}
        >
          {options.length >= FILTER_FROM && (
            <div className="border-b border-line p-1.5">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                // Enter filters; it never submits the surrounding form.
                onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
                placeholder={filterLabel}
                aria-label={filterLabel}
                leading={<Search />}
                disabled={disabled}
                className="[&_input]:border-transparent [&_input]:shadow-none"
              />
            </div>
          )}
          {selectAll && shown.length > 1 && (
            <label
              className={cn(
                'flex items-center gap-2.5 border-b border-line px-3 py-2',
                disabled ? 'cursor-default' : 'cursor-pointer hover:bg-subtle',
              )}
            >
              <Checkbox checked={allState} onCheckedChange={toggleShown} disabled={disabled} />
              <span className="text-sm font-medium text-ink">
                {needle ? t('team.checklist.selectShown') : t('team.checklist.selectAll')}
              </span>
            </label>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {shown.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5',
                  disabled ? 'cursor-default' : 'cursor-pointer hover:bg-subtle',
                )}
              >
                <Checkbox
                  checked={selected.has(option.value)}
                  onCheckedChange={(checked) => toggle(option.value, checked)}
                  disabled={disabled}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{option.label}</span>
                {option.hint && <span className="shrink-0 text-xs text-ink-3">{option.hint}</span>}
              </label>
            ))}
            {shown.length === 0 && <p className="px-3 py-2 text-sm text-ink-3">{t('team.checklist.noMatch')}</p>}
          </div>
        </div>
      )}

      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-xs text-critical-ink">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
