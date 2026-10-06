import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './spinner';
import { Tooltip } from './tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-control',
  accent: 'bg-accent text-white hover:bg-accent-hover shadow-control',
  secondary:
    'bg-surface text-ink border border-line-strong/80 hover:bg-subtle hover:border-line-strong shadow-control',
  ghost: 'text-ink-2 hover:bg-muted hover:text-ink',
  danger: 'bg-critical text-white hover:brightness-95 shadow-control',
  link: 'text-accent hover:text-accent-hover underline-offset-4 hover:underline px-0 h-auto',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 rounded-sm px-2.5 text-sm',
  md: 'h-8 gap-2 rounded-sm px-3 text-sm',
  lg: 'h-10 gap-2 rounded-md px-4 text-base',
  xl: 'h-12 gap-2.5 rounded-md px-5 text-md',
};

/** Button styling for links that navigate, so an anchor never wraps a button. */
export function buttonClass({ variant = 'secondary', size = 'md', block }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150',
    variants[variant],
    variant !== 'link' && sizes[size],
    block && 'w-full',
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, trailing, block, className, children, disabled, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
        variants[variant],
        variant !== 'link' && sizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-3.5" /> : icon}
      {children}
      {trailing}
    </button>
  );
});

type IconButtonProps = Omit<ButtonProps, 'children' | 'icon'> & {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  children: ReactNode;
  tooltip?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', variant = 'ghost', className, tooltip = true, ...props },
  ref,
) {
  const dimension = { sm: 'size-7', md: 'size-8', lg: 'size-10', xl: 'size-12' }[size];
  const button = (
    <Button
      ref={ref}
      aria-label={label}
      variant={variant}
      size={size}
      className={cn(dimension, 'px-0', className)}
      {...props}
    >
      {children}
    </Button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
