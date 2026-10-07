import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

export const controlBase = cn(
  'w-full rounded-sm border bg-surface text-ink shadow-control',
  'border-line-strong/90 hover:border-ink-4 placeholder:text-ink-3',
  'transition-[border-color,box-shadow] duration-150',
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/20',
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3',
  'aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/20',
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  inputSize?: 'md' | 'lg';
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, inputSize = 'md', ...props },
  ref,
) {
  const height = inputSize === 'lg' ? 'h-11 text-md' : 'h-8 text-sm';
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(controlBase, height, 'px-2.5', className)} {...props} />;
  }
  return (
    <div className={cn('relative flex items-center', className)}>
      {leading && (
        <span className="pointer-events-none absolute left-2.5 flex text-ink-3 [&_svg]:size-4">{leading}</span>
      )}
      <input
        ref={ref}
        className={cn(controlBase, height, leading ? 'pl-8' : 'pl-2.5', trailing ? 'pr-8' : 'pr-2.5')}
        {...props}
      />
      {trailing && <span className="absolute right-2 flex text-ink-3">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, 'min-h-16 resize-y px-2.5 py-2 text-sm', className)}
      {...props}
    />
  );
});

type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
  inputSize?: 'md' | 'lg';
};

/** Native select for long lists (countries, time zones): type-to-search and the platform picker on phones. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(function NativeSelect(
  { options, placeholder, className, inputSize = 'md', ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(controlBase, 'appearance-none pr-8 pl-2.5', inputSize === 'lg' ? 'h-11 text-md' : 'h-8 text-sm')}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      >
        <path
          d="m4.5 6.5 3.5 3.5 3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});
