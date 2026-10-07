import { cn } from '../../lib/cn';

type Option<T extends string> = { value: T; label: string };

/** Mutually exclusive choice with up to four short options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-sm bg-muted p-0.5', className)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const index = options.findIndex((option) => option.value === value);
        const next = options[(index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
        if (next) {
          onChange(next.value);
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]');
          buttons[options.indexOf(next)]?.focus();
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 rounded-[5px] px-2.5 text-sm font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-control ring-1 ring-line' : 'text-ink-3 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
