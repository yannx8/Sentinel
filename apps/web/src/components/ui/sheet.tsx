import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Slide-over panel from the right, used for the case file on narrow screens and for side forms. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[50] bg-scrim animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-[51] flex w-full max-w-[640px] flex-col border-l border-line bg-surface shadow-dialog animate-panel-in focus:outline-none',
            className,
          )}
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
