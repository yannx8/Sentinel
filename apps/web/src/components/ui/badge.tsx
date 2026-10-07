import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'critical' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-2',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success-ink',
  warning: 'bg-medium-subtle text-medium-ink',
  critical: 'bg-critical-subtle text-critical-ink',
  outline: 'border border-line-strong text-ink-2',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-xs px-1.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-surface px-1 font-sans text-2xs font-medium text-ink-3 shadow-control',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
