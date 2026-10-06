import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { cn } from '../../lib/cn';

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function push(tone: ToastTone, title: string, options: Omit<ToastItem, 'id' | 'tone' | 'title'> = {}) {
  const item = { id: nextId++, tone, title, ...options };
  items = [...items.slice(-3), item];
  emit();
  return item.id;
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Same verb as the button that caused it: "Assigned to Karim Benali". */
export const toast = {
  success: (title: string, options?: Omit<ToastItem, 'id' | 'tone' | 'title'>) => push('success', title, options),
  error: (title: string, options?: Omit<ToastItem, 'id' | 'tone' | 'title'>) => push('error', title, options),
  info: (title: string, options?: Omit<ToastItem, 'id' | 'tone' | 'title'>) => push('info', title, options),
};

function ToastView({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismissToast(item.id), item.tone === 'error' ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [item, paused]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 shadow-dialog animate-sheet-in sm:w-[380px]"
    >
      {item.tone === 'error' ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
      ) : (
        <CircleCheck className={cn('mt-0.5 size-4 shrink-0', item.tone === 'success' ? 'text-success' : 'text-accent')} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-ink-3">{item.description}</p>}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            dismissToast(item.id);
          }}
          className="shrink-0 rounded-xs px-1.5 text-sm font-medium text-accent hover:text-accent-hover"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(item.id)}
        className="-mr-1 shrink-0 rounded-xs p-0.5 text-ink-3 hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => items,
  );
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      {current.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>
  );
}
