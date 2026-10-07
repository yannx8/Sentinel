import type { OrganizationSettings } from '@sentinel/shared';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/dialog';
import { Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { usePlural } from './plural';

const DAY_MS = 86_400_000;

/** Current plan and, during a trial, when it ends. Plans are changed by Sentinel, so nothing here is editable. */
export function PlanSummary({ settings }: { settings: OrganizationSettings }) {
  const { t, date } = useT();
  const tn = usePlural();
  const trialEnd = settings.plan === 'TRIAL' && settings.trialEndsAt ? settings.trialEndsAt : null;
  const daysLeft = trialEnd ? Math.ceil((new Date(trialEnd).getTime() - Date.now()) / DAY_MS) : 0;

  return (
    <div className="grid gap-0.5">
      <p className="text-base font-medium text-ink">{t(`common.plan.${settings.plan}`)}</p>
      {trialEnd && (
        <p className="text-sm text-ink-3">
          {daysLeft > 0 ? (
            <>
              <time dateTime={trialEnd}>{t('setup.settings.plan.trialEnds', { date: date(trialEnd, 'date') })}</time>
              <span aria-hidden> · </span>
              <span className="tabular-nums">{tn('setup.settings.plan.daysLeft', daysLeft)}</span>
            </>
          ) : (
            <time dateTime={trialEnd}>{t('setup.settings.plan.trialEnded', { date: date(trialEnd, 'date') })}</time>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Floats at the bottom of the content panel while the form has unsaved changes.
 * Lives inside the form, so Save submits it. The form announces it through its own live region.
 */
export function SaveBar({ saving, onDiscard }: { saving: boolean; onDiscard: () => void }) {
  const { t } = useT();
  return (
    <div className="sticky bottom-4 z-20 mt-8 animate-sheet-in">
      <section
        aria-label={t('setup.settings.saveBar.label')}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface py-2.5 pr-2.5 pl-4 shadow-pop"
      >
        <p className="text-sm text-ink-2">{t('setup.settings.saveBar.unsaved')}</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            {t('setup.settings.saveBar.discard')}
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {t('common.saveChanges')}
          </Button>
        </div>
      </section>
    </div>
  );
}

const blockNavigation = () => true;

/** Asks before leaving the page with unsaved changes. The browser asks on reload or tab close. */
export function LeaveGuard({ when }: { when: boolean }) {
  const { t } = useT();
  const blocker = useBlocker({ shouldBlockFn: blockNavigation, disabled: !when, withResolver: true });
  return (
    <ConfirmDialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
      title={t('setup.settings.leave.title')}
      description={t('setup.settings.leave.body')}
      confirmLabel={t('setup.settings.leave.confirm')}
      variant="danger"
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

/** Same rhythm as the FieldGroup sections, so nothing moves when the settings arrive. */
export function SettingsSkeleton() {
  return (
    <div aria-busy="true">
      {[5, 2, 2, 1].map((fields, section) => (
        <div
          key={section}
          className="grid gap-x-10 gap-y-4 border-t border-line py-6 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
        >
          <div className="grid content-start gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-52 max-w-full" />
          </div>
          <div className="grid max-w-xl gap-4">
            {Array.from({ length: fields }, (_, field) => (
              <div key={field} className="grid gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
