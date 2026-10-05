import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastInput = { message: string; actionLabel?: string; onAction?: () => void; tone?: 'default' | 'critical' };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastView({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  // Pausing on hover and focus keeps timed messages readable (WCAG 2.2.1).
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => done.current(), toast.actionLabel ? 6000 : 4000);
    return () => window.clearTimeout(id);
  }, [paused, toast.actionLabel]);

  return (
    <div
      className={`anim-rise pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-4 rounded-panel px-4 py-2.5 text-base text-canvas shadow-1 ${
        toast.tone === 'critical' ? 'bg-critical-ink' : 'bg-ink'
      }`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{toast.message}</span>
      {toast.actionLabel ? (
        <button
          type="button"
          className="rounded-control px-1 font-semibold underline underline-offset-4 outline-offset-4 focus-visible:outline-canvas"
          onClick={() => {
            toast.onAction?.();
            onDone();
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const notify = useCallback((t: ToastInput) => {
    const id = ++counter.current;
    setItems((list) => [...list.slice(-2), { ...t, id }]);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-70 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <ToastView key={t.id} toast={t} onDone={() => setItems((list) => list.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
