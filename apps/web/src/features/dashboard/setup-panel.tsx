import type { SetupChecklist } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Check } from 'lucide-react';
import { buttonClass } from '../../components/ui/button';
import { Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

type StepKey = 'site' | 'category' | 'intervenant' | 'employee' | 'incident';

function StepLink({ step, label }: { step: StepKey; label: string }) {
  const className = buttonClass({ variant: 'secondary', size: 'sm' });
  const content = (
    <>
      {label}
      <ArrowRight className="size-3.5 text-ink-3" aria-hidden />
    </>
  );
  switch (step) {
    case 'site':
      return (
        <Link to="/app/sites" className={className}>
          {content}
        </Link>
      );
    case 'category':
      return (
        <Link to="/app/categories" className={className}>
          {content}
        </Link>
      );
    case 'intervenant':
      return (
        <Link to="/app/team" search={{ tab: 'intervenants' }} className={className}>
          {content}
        </Link>
      );
    case 'employee':
      return (
        <Link to="/app/team" search={{ tab: 'employees' }} className={className}>
          {content}
        </Link>
      );
    case 'incident':
      return (
        <Link to="/app/incidents" className={className}>
          {content}
        </Link>
      );
  }
}

export function isSetupComplete(checklist: SetupChecklist) {
  return checklist.hasSite && checklist.hasCategory && checklist.hasIntervenant && checklist.hasEmployee && checklist.hasIncident;
}

/** First-run checklist. Rendered only while at least one step is left. */
export function SetupPanel({ checklist }: { checklist: SetupChecklist }) {
  const { t } = useT();
  const steps: { key: StepKey; done: boolean }[] = [
    { key: 'site', done: checklist.hasSite },
    { key: 'category', done: checklist.hasCategory },
    { key: 'intervenant', done: checklist.hasIntervenant },
    { key: 'employee', done: checklist.hasEmployee },
    { key: 'incident', done: checklist.hasIncident },
  ];
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;

  return (
    <Panel
      title={t('dashboard.setup.title')}
      actions={
        <span className="text-xs text-ink-3 tabular-nums">
          {t('dashboard.setup.progress', { done, total: steps.length })}
        </span>
      }
    >
      <ol className="divide-y divide-line">
        {steps.map((step) => (
          <li key={step.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full',
                step.done ? 'bg-success text-surface' : 'border border-dashed border-line-strong',
              )}
            >
              {step.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
              <span className="sr-only">{t(step.done ? 'dashboard.setup.done' : 'dashboard.setup.todo')}</span>
            </span>
            <div className="min-w-0 flex-1 basis-60">
              <p className={cn('text-sm font-medium', step.done ? 'text-ink-3' : 'text-ink')}>
                {t(`dashboard.setup.${step.key}.title`)}
              </p>
              {!step.done && <p className="text-sm text-ink-3">{t(`dashboard.setup.${step.key}.body`)}</p>}
            </div>
            {!step.done && <StepLink step={step.key} label={t(`dashboard.setup.${step.key}.action`)} />}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
