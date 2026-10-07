import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { controlBase } from './input';

export type SelectOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean };

type SelectProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: 'md' | 'lg';
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onValueChange, options, placeholder, disabled, className, size = 'md', ...aria },
  ref,
) {
  return (
    <RadixSelect.Root value={value ?? ''} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        ref={ref}
        className={cn(
          controlBase,
          'flex items-center justify-between gap-2 px-2.5 text-left data-[placeholder]:text-ink-3',
          size === 'lg' ? 'h-11 text-md' : 'h-8 text-sm',
          className,
        )}
        {...aria}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-ink-3" aria-hidden />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="z-[70] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-surface shadow-pop animate-pop-in"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-default items-start gap-2 rounded-xs py-1.5 pr-2 pl-7 text-sm text-ink outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted"
              >
                <RadixSelect.ItemIndicator className="absolute left-2 top-2">
                  <Check className="size-3.5" aria-hidden />
                </RadixSelect.ItemIndicator>
                <div className="min-w-0">
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  {option.description && <div className="text-xs text-ink-3">{option.description}</div>}
                </div>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
});
