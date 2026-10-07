import type { IncidentStatus, Priority } from '@sentinel/shared';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

/* Priority and status are never shown by colour alone: each has its own shape and a label. */

const priorityColor: Record<Priority, string> = {
  CRITICAL: 'text-critical',
  HIGH: 'text-high',
  MEDIUM: 'text-medium',
  LOW: 'text-low',
};

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 'CRITICAL') {
    return (
      <svg viewBox="0 0 16 16" className={cn('size-4 shrink-0', priorityColor.CRITICAL, className)} aria-hidden>
        <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" />
        <path d="M8 4.6v4.2" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="1.05" fill="var(--surface)" />
      </svg>
    );
  }
  const filled = priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 2 : 1;
  return (
    <svg viewBox="0 0 16 16" className={cn('size-4 shrink-0', priorityColor[priority], className)} aria-hidden>
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={2 + bar * 4.5}
          y={10 - bar * 3.5}
          width="3"
          height={4 + bar * 3.5}
          rx="1"
          fill="currentColor"
          opacity={bar < filled ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

export function PriorityLabel({
  priority,
  className,
  short,
}: {
  priority: Priority;
  className?: string;
  short?: boolean;
}) {
  const { t } = useT();
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-ink-2', className)}>
      <PriorityIcon priority={priority} />
      <span className={cn(short && 'sr-only')}>{t(`common.priority.${priority}`)}</span>
    </span>
  );
}

export function StatusIcon({ status, className }: { status: IncidentStatus; className?: string }) {
  const base = cn('size-4 shrink-0', className);
  switch (status) {
    case 'NEW':
      return (
        <svg viewBox="0 0 16 16" className={cn(base, 'text-ink-3')} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.6 2.1" />
        </svg>
      );
    case 'ASSIGNED':
      return (
        <svg viewBox="0 0 16 16" className={cn(base, 'text-accent')} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      );
    case 'IN_PROGRESS':
      return (
        <svg viewBox="0 0 16 16" className={cn(base, 'text-accent')} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4a4 4 0 0 1 0 8Z" fill="currentColor" />
        </svg>
      );
    case 'RESOLVED':
      return (
        <svg viewBox="0 0 16 16" className={cn(base, 'text-success')} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="m5.4 8.2 1.8 1.8 3.4-3.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'CLOSED':
      return (
        <svg viewBox="0 0 16 16" className={cn(base, 'text-ink-3')} aria-hidden>
          <circle cx="8" cy="8" r="6.75" fill="currentColor" />
          <path
            d="m5.4 8.2 1.8 1.8 3.4-3.6"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function StatusLabel({
  status,
  className,
  short,
}: {
  status: IncidentStatus;
  className?: string;
  short?: boolean;
}) {
  const { t } = useT();
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-ink-2', className)}>
      <StatusIcon status={status} />
      <span className={cn(short && 'sr-only')}>{t(`common.status.${status}`)}</span>
    </span>
  );
}
