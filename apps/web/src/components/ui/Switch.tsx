import { useId } from 'react';
import { cn } from '../../lib/util';

/** Immediate-effect setting. The label is part of the control so the hit area includes it. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-2', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-pill transition-colors duration-(--dur-small) ease-(--ease-out)',
          checked ? 'bg-brand-solid' : 'bg-border-strong',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-[3px] left-[3px] size-[18px] rounded-full bg-surface transition-transform duration-(--dur-small) ease-(--ease-out)',
            checked && 'translate-x-4',
          )}
        />
      </button>
      {label}
    </label>
  );
}
