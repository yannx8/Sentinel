import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-xs bg-[linear-gradient(90deg,var(--muted)_25%,var(--subtle)_50%,var(--muted)_75%)] bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

/** One sentence that says what belongs here, and one action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 shadow-control [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const bannerTones = {
  info: { className: 'border-accent-line bg-accent-subtle text-ink', icon: <Info className="text-accent" /> },
  success: { className: 'border-success/30 bg-success-subtle text-ink', icon: <CircleCheck className="text-success" /> },
  warning: { className: 'border-medium/30 bg-medium-subtle text-ink', icon: <TriangleAlert className="text-medium" /> },
  critical: { className: 'border-critical/30 bg-critical-subtle text-ink', icon: <CircleAlert className="text-critical" /> },
};

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof bannerTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const config = bannerTones[tone];
  return (
    <div
      role={tone === 'critical' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-md border px-3.5 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', config.className, className)}
    >
      {config.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-ink-2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
