import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Page header: title, optional description and actions. Sits on the canvas, no chrome. */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 pb-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Scrollable page body with consistent gutters and a max width. */
export function Page({ children, width = 'wide', className }: { children: ReactNode; width?: 'wide' | 'narrow' | 'full'; className?: string }) {
  const max = { wide: 'max-w-[1240px]', narrow: 'max-w-[880px]', full: 'max-w-none' }[width];
  return <div className={cn('mx-auto w-full px-4 py-6 sm:px-8 sm:py-8', max, className)}>{children}</div>;
}

/** A flat bordered surface for tables and grouped content. */
export function Panel({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      {(title || actions) && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Logo({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <svg viewBox="0 0 32 32" className="size-6 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path
          d="M16 6.5 8.5 9.4v6.1c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10V9.4L16 6.5Z"
          fill="none"
          className="stroke-on-primary"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="15.5" r="2.4" className="fill-on-primary" />
      </svg>
      {withName && <span className="text-[15px] font-semibold tracking-[-0.01em]">Sentinel</span>}
    </span>
  );
}
