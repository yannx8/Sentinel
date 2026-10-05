import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/util';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-solid text-on-brand hover:bg-brand-solid-hover active:bg-brand-solid-pressed disabled:bg-sunken disabled:text-ink-disabled',
  secondary:
    'bg-surface text-ink border-border-strong hover:bg-surface-2 active:bg-sunken disabled:text-ink-disabled disabled:bg-surface-2',
  ghost: 'bg-transparent text-brand hover:bg-brand-tint active:bg-brand-tint disabled:text-ink-disabled disabled:hover:bg-transparent',
  danger:
    'bg-critical text-surface hover:brightness-90 active:brightness-75 disabled:bg-sunken disabled:text-ink-disabled',
};

const sizes: Record<Size, string> = {
  md: 'h-8 px-3.5 text-base',
  lg: 'h-12 px-5 text-md',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control border border-transparent font-medium whitespace-nowrap',
        'transition-[background-color,transform,filter] duration-(--dur-press) ease-(--ease-out) active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
