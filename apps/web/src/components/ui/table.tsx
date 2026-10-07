import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Data table with a sticky header. Wrap in a bordered panel; scrolls horizontally on small screens. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-subtle">{children}</thead>;
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-9 border-b border-line px-3 text-left text-xs font-medium whitespace-nowrap text-ink-3 first:pl-4 last:pr-4',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  className,
  children,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        '[&>td]:border-b [&>td]:border-line last:[&>td]:border-b-0',
        interactive && 'cursor-pointer transition-colors hover:bg-subtle',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('h-11 px-3 align-middle text-ink first:pl-4 last:pr-4', className)} {...props}>
      {children}
    </td>
  );
}
