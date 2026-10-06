import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;
export const MenuGroup = RadixMenu.Group;

export function MenuContent({
  children,
  align = 'start',
  side = 'bottom',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        side={side}
        sideOffset={4}
        collisionPadding={8}
        className={cn(
          'z-[70] min-w-48 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-pop animate-pop-in',
          className,
        )}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

const itemClass =
  'relative flex h-8 cursor-default items-center gap-2 rounded-xs px-2 text-sm text-ink outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-ink-3';

export function MenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  shortcut?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <RadixMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(itemClass, danger && 'text-critical-ink [&_svg]:text-critical-ink')}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-xs text-ink-3">{shortcut}</span>}
    </RadixMenu.Item>
  );
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <RadixMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className={cn(itemClass, 'pl-7')}
    >
      <RadixMenu.ItemIndicator className="absolute left-2 flex">
        <Check className="!text-ink" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="px-2 pt-1.5 pb-1 text-xs font-medium text-ink-3">{children}</RadixMenu.Label>;
}

export function MenuSeparator() {
  return <RadixMenu.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export const MenuRadioGroup = RadixMenu.RadioGroup;

export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixMenu.RadioItem value={value} className={cn(itemClass, 'pl-7')}>
      <RadixMenu.ItemIndicator className="absolute left-2 flex">
        <Check className="!text-ink" />
      </RadixMenu.ItemIndicator>
      {children}
    </RadixMenu.RadioItem>
  );
}

export const MenuSub = RadixMenu.Sub;

export function MenuSubTrigger({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <RadixMenu.SubTrigger className={cn(itemClass, 'data-[state=open]:bg-muted')}>
      {icon}
      <span className="flex-1">{children}</span>
      <span aria-hidden className="text-ink-3">›</span>
    </RadixMenu.SubTrigger>
  );
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.SubContent
        sideOffset={6}
        className="z-[71] min-w-40 rounded-md border border-line bg-surface p-1 shadow-pop animate-pop-in"
      >
        {children}
      </RadixMenu.SubContent>
    </RadixMenu.Portal>
  );
}
