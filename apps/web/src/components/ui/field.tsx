import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

type FieldProps = {
  label: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Shown at the end of the label row, e.g. a character counter. */
  aside?: ReactNode;
  className?: string;
  hideLabel?: boolean;
};

/** Label above, help below, error replaces help. Wires ids and aria attributes into the control. */
export function Field({ label, children, hint, error, optional, aside, className, hideLabel }: FieldProps) {
  const { t } = useT();
  const id = useId();
  const controlId = (children.props.id as string | undefined) ?? id;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
        <label htmlFor={controlId} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">{t('common.optional')}</span>}
        </label>
        {aside && <span className="text-xs text-ink-3 tabular-nums">{aside}</span>}
      </div>
      {control}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-xs text-critical-ink" role="alert">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Groups fields under a heading in long forms. */
export function FieldGroup({ title, description, children }: { title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-6 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      <div className="grid max-w-xl gap-4">{children}</div>
    </section>
  );
}
