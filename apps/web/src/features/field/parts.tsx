import { Link } from '@tanstack/react-router';
import { ChevronLeft, X } from 'lucide-react';
import { useId, type FormEventHandler, type ReactNode } from 'react';
import { Button, IconButton } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Sheet } from '../../components/ui/sheet';
import { useT } from '../../i18n';
import { errorMessage } from '../../lib/forms';
import { cn } from '../../lib/cn';

/**
 * Bar fixed above the tab bar that holds the one primary action of a screen.
 * Renders a spacer in the flow so the last content is never hidden behind it.
 */
export function BottomBar({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <>
      <div aria-hidden className="h-20" />
      <div
        role={label ? 'region' : undefined}
        aria-label={label}
        className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85"
      >
        <div className="mx-auto flex min-h-[72px] w-full max-w-[680px] items-center gap-2 px-4 py-3">{children}</div>
      </div>
    </>
  );
}

/** "Step 1 of 3" with a thin segmented bar. */
export function StepProgress({ current, total }: { current: number; total: number }) {
  const { t } = useT();
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-ink-3 tabular-nums">{t('field.stepOf', { current: current + 1, total })}</p>
      <div className="grid grid-flow-col gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn('h-1 rounded-full transition-colors', index <= current ? 'bg-ink' : 'bg-muted')} />
        ))}
      </div>
    </div>
  );
}

export const backLinkClass =
  '-ml-2 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-md font-medium text-ink-2 transition-colors hover:text-ink [&_svg]:size-5';

export function BackLink({ to, label }: { to: '/field/work' | '/field/incidents'; label: string }) {
  return (
    <Link to={to} className={backLinkClass}>
      <ChevronLeft aria-hidden />
      {label}
    </Link>
  );
}

/** Separator dot between meta values. */
export function Dot() {
  return (
    <span aria-hidden className="text-ink-4">
      ·
    </span>
  );
}

/** A titled group of tappable rows. Children are list items. */
export function ListGroup({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2 id={id} className="flex items-baseline gap-2 px-1 text-sm font-semibold text-ink">
        {title}
        <span className="font-normal text-ink-3 tabular-nums">{count}</span>
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">{children}</ul>
    </section>
  );
}

/** Same shape as a group of incident rows. */
export function ListSkeleton({ groups = 2 }: { groups?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true">
      {Array.from({ length: groups }, (_, group) => (
        <div key={group} className="grid gap-2">
          <Skeleton className="ml-1 h-4 w-24" />
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {Array.from({ length: group === 0 ? 3 : 2 }, (_, row) => (
              <div key={row} className="grid gap-2 px-4 py-3.5">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list or screen that failed to load, with a way to try again. */
export function LoadError({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  const { t } = useT();
  return (
    <EmptyState
      title={title}
      description={errorMessage(error, t)}
      action={
        <Button size="xl" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}

/**
 * Full-height form sheet for phone screens: title and close at the top,
 * scrollable fields, the submit action at the bottom above the safe area.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  footer,
  children,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  footer: ReactNode;
  children: ReactNode;
  busy?: boolean;
}) {
  const { t } = useT();
  const change = (next: boolean) => {
    if (!busy) onOpenChange(next);
  };
  return (
    <Sheet open={open} onOpenChange={change} title={title}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-start gap-3 border-b border-line px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-3">
          <div className="min-w-0 flex-1 pt-2.5">
            {/* The dialog is named by the sheet's own title; this one is visual. */}
            <p aria-hidden className="text-xl font-semibold text-ink">
              {title}
            </p>
            {description && <p className="mt-1 text-md text-ink-2">{description}</p>}
          </div>
          <IconButton label={t('common.close')} size="xl" tooltip={false} className="-mr-2" onClick={() => change(false)}>
            <X className="size-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="grid gap-6">{children}</div>
        </div>
        <footer className="border-t border-line bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">{footer}</footer>
      </form>
    </Sheet>
  );
}
