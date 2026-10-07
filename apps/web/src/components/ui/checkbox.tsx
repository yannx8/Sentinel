import * as RadixCheckbox from '@radix-ui/react-checkbox';
import * as RadixSwitch from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type CheckboxProps = {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { checked, onCheckedChange, className, ...props },
  ref,
) {
  return (
    <RadixCheckbox.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-xs border border-line-strong bg-surface shadow-control',
        'transition-colors hover:border-ink-4 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator className="text-on-primary">
        {checked === 'indeterminate' ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
});

export function CheckboxField({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-default opacity-60')}>
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-0.5" />
      <span className="grid gap-0.5">
        <span className="text-sm text-ink">{label}</span>
        {description && <span className="text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
}

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, ...props },
  ref,
) {
  return (
    <RadixSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong transition-colors duration-150 data-[state=checked]:bg-primary disabled:opacity-50"
      {...props}
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[18px] dark:data-[state=checked]:bg-[#111114]" />
    </RadixSwitch.Root>
  );
});

/** A setting row: label and description on the left, switch on the right. */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6">
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        {description && <span className="text-sm text-ink-3">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}
