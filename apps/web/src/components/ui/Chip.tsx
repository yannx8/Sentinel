import type { IncidentStatus, Priority } from '@sentinel/shared';
import { cn } from '../../lib/util';
import { Glyph, type GlyphName } from './Glyph';

export const priorityLabel: Record<Priority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const statusLabel: Record<IncidentStatus, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const priorityGlyph: Record<Priority, GlyphName> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const statusGlyph: Record<IncidentStatus, GlyphName> = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

/** Full class names so Tailwind can see them. */
export const priorityText: Record<Priority, string> = {
  CRITICAL: 'text-critical',
  HIGH: 'text-high',
  MEDIUM: 'text-medium',
  LOW: 'text-low',
};

const priorityChip: Record<Priority, string> = {
  CRITICAL: 'bg-critical-tint text-critical-ink border-transparent',
  HIGH: 'bg-high-tint text-high-ink border-transparent',
  MEDIUM: 'bg-medium-tint text-medium-ink border-transparent',
  LOW: 'bg-low-tint text-low-ink border-transparent',
};

const statusChip: Record<IncidentStatus, string> = {
  NEW: 'bg-surface text-ink-2 border-border-strong',
  ASSIGNED: 'bg-surface text-brand border-brand',
  IN_PROGRESS: 'bg-brand-solid text-on-brand border-transparent',
  RESOLVED: 'bg-surface text-success-ink border-success',
  CLOSED: 'bg-sunken text-ink-2 border-transparent',
};

const base = 'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border pl-2 pr-2.5 text-xs font-semibold';

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn(base, priorityChip[priority], className)}>
      <Glyph name={priorityGlyph[priority]} className={priorityText[priority]} />
      {priorityLabel[priority]}
    </span>
  );
}

export function StatusChip({ status, live = false, className }: { status: IncidentStatus; live?: boolean; className?: string }) {
  return (
    <span className={cn(base, statusChip[status], className)}>
      <Glyph name={statusGlyph[status]} className={cn('rounded-full', live && 'live-pulse')} />
      {statusLabel[status]}
    </span>
  );
}
