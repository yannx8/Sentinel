import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/util';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const closeButton =
  'grid size-8 place-items-center rounded-control text-ink-2 transition-colors duration-(--dur-small) hover:bg-sunken hover:text-ink';

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <RadixDialog.Title className="font-display text-title-md font-semibold text-ink">{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="mt-0.5 text-sm text-ink-2">{description}</RadixDialog.Description>
        ) : (
          <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
        )}
      </div>
      <RadixDialog.Close className={closeButton} aria-label="Close">
        <X size={18} strokeWidth={1.75} aria-hidden />
      </RadixDialog.Close>
    </header>
  );
}

/** Centered task dialog: only for work that needs interruption and protected focus. */
export function Modal({ open, onOpenChange, title, description, children, footer, className }: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="anim-fade fixed inset-0 z-60 bg-scrim" />
        <RadixDialog.Content
          className={cn(
            'anim-pop fixed inset-0 z-60 m-auto flex h-fit max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-sheet bg-surface shadow-2',
            className,
          )}
        >
          <Header title={title} description={description} />
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">{footer}</footer> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Right-hand slide-over, used for the case file below the docked breakpoint.
 * The content owns its visible header and close button, so the title here is for screen readers only.
 */
export function SlideOver({ open, onOpenChange, title, description, children, className }: Omit<Props, 'footer'>) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="anim-fade fixed inset-0 z-50 bg-scrim" />
        <RadixDialog.Content
          className={cn(
            'anim-slide-right fixed inset-y-0 right-0 z-50 flex w-[min(640px,100vw)] flex-col bg-surface shadow-2',
            className,
          )}
        >
          <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{description ?? title}</RadixDialog.Description>
          <div className="min-h-0 flex-1">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
