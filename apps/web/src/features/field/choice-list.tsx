import { Check, CircleAlert, Search } from 'lucide-react';
import { useId, useMemo, useState, type Ref } from 'react';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

export type Choice = { value: string; label: string; description?: string; tag?: string };

const SEARCH_THRESHOLD = 8;

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * A single choice from a list of large rows, built on native radio inputs so
 * arrow keys, labels and screen readers work as people expect. Long lists get
 * a search field.
 */
export function ChoiceList({
  name,
  label,
  options,
  value,
  onChange,
  onBlur,
  inputRef,
  error,
  searchLabel,
  chips,
}: {
  name: string;
  label: string;
  options: Choice[];
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  error?: string;
  /** Shown as a search field when the list is long. */
  searchLabel?: string;
  /** Wrapping pills instead of full rows, for short labels. */
  chips?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const [query, setQuery] = useState('');
  const searchable = !!searchLabel && options.length > SEARCH_THRESHOLD;

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!searchable || !needle) return options;
    return options.filter((option) => normalize(`${option.label} ${option.description ?? ''}`).includes(needle));
  }, [options, query, searchable]);

  return (
    <fieldset className="min-w-0" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      {searchable && (
        <Input
          type="search"
          inputSize="lg"
          leading={<Search />}
          placeholder={searchLabel}
          aria-label={searchLabel}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-2"
        />
      )}
      <div
        className={cn(
          chips ? 'flex flex-wrap gap-2' : 'divide-y divide-line overflow-hidden rounded-lg border bg-surface',
          !chips && (error ? 'border-critical' : 'border-line'),
        )}
      >
        {visible.map((option, index) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 px-4 transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent',
                chips
                  ? cn(
                      'min-h-11 rounded-full border py-2',
                      selected
                        ? 'border-accent bg-accent-subtle'
                        : error
                          ? 'border-critical'
                          : 'border-line bg-surface',
                    )
                  : cn('min-h-14 py-3', selected ? 'bg-accent-subtle' : 'hover:bg-subtle active:bg-muted'),
              )}
            >
              <input
                ref={index === 0 ? inputRef : undefined}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
                aria-invalid={error ? true : undefined}
                className="sr-only"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('text-md text-ink', selected && 'font-medium')}>{option.label}</span>
                  {option.tag && <Badge>{option.tag}</Badge>}
                </span>
                {option.description && <span className="mt-0.5 block text-sm text-ink-3">{option.description}</span>}
              </span>
              {!chips && (
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    selected ? 'border-accent bg-accent text-surface' : 'border-line-strong bg-surface',
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3.5} />}
                </span>
              )}
            </label>
          );
        })}
        {visible.length === 0 && <p className="px-4 py-4 text-md text-ink-3">{t('field.report.noMatch')}</p>}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-critical-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </fieldset>
  );
}
