import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { Button, IconButton, type ButtonVariant } from './button';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Keeps the dialog open on outside click, for forms with unsaved input. */
  modalLock?: boolean;
};

export function DialogContent({
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  modalLock,
}: ContentProps) {
  const { t } = useT();
  const width = { sm: 'max-w-[420px]', md: 'max-w-[520px]', lg: 'max-w-[680px]' }[size];
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-[60] bg-scrim animate-fade-in" />
      <RadixDialog.Content
        onPointerDownOutside={modalLock ? (event) => event.preventDefault() : undefined}
        className={cn(
          'fixed top-[max(16px,10vh)] left-1/2 z-[61] flex max-h-[min(calc(100dvh-32px),780px)] w-[calc(100vw-24px)] -translate-x-1/2 flex-col',
          'rounded-xl border border-line bg-surface shadow-dialog animate-sheet-in focus:outline-none',
          width,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="grid gap-1">
            <RadixDialog.Title className="text-lg font-semibold text-ink">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="text-sm text-ink-2">{description}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close asChild>
            <IconButton label={t('common.close')} size="sm" className="-mr-1.5 -mt-0.5" tooltip={false}>
              <X className="size-4" />
            </IconButton>
          </RadixDialog.Close>
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-5 pb-4">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3 rounded-b-xl">
            {footer}
          </div>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
};

/** Names the object and the consequence. The confirm button repeats the verb. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = 'primary',
  onConfirm,
  children,
}: ConfirmProps) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={variant}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
