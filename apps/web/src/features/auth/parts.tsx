import { Check, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Input } from '../../components/ui/input';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

export function AuthCard({
  title,
  description,
  children,
  footer,
  width = 'sm',
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md';
}) {
  return (
    <div className={cn('w-full', width === 'sm' ? 'max-w-[400px]' : 'max-w-[560px]')}>
      <div className="rounded-xl border border-line bg-surface p-6 shadow-pop sm:p-8">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-3">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-sm text-ink-3">{footer}</div>}
    </div>
  );
}

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { inputSize?: 'md' | 'lg' }
>(function PasswordInput({ inputSize = 'lg', ...props }, ref) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      inputSize={inputSize}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="pointer-events-auto rounded-xs p-1 text-ink-3 hover:text-ink"
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

/** For true sequences only (registration, CSV import). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                done && 'bg-primary text-on-primary',
                active && 'bg-surface text-ink ring-2 ring-primary',
                !done && !active && 'bg-muted text-ink-3',
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn('truncate text-sm', active ? 'font-medium text-ink' : 'text-ink-3')}>{label}</span>
            {index < steps.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function AuthStatus({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-xl border border-line bg-surface p-8 text-center shadow-pop">
      <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-full bg-muted text-ink-2 [&_svg]:size-5">
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {children && <div className="mt-2 grid gap-5 text-sm text-ink-3">{children}</div>}
    </div>
  );
}
