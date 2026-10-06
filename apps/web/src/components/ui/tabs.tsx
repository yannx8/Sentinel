import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <RadixTabs.List className={cn('flex gap-5 border-b border-line', className)}>{children}</RadixTabs.List>;
}

export function TabsTrigger({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative -mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium text-ink-3',
        'transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink',
      )}
    >
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 text-2xs font-semibold text-ink-2 tabular-nums">{count}</span>
      )}
    </RadixTabs.Trigger>
  );
}

/** Link-based tabs for routed sections. */
export function TabLinkBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav className={cn('flex gap-5 border-b border-line', className)} aria-label="Sections">
      {children}
    </nav>
  );
}

export const tabLinkClass =
  'relative -mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent text-sm font-medium text-ink-3 transition-colors hover:text-ink';
export const tabLinkActiveClass = '!border-ink !text-ink';
