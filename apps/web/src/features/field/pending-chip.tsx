import { CloudOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { useT } from '../../i18n';
import { DEPENDENT_ERROR } from '../../lib/offline-queue';
import { discardQueued, retryQueued, useQueueItems } from '../../lib/offline-sync';

/** Header chip: how many reports wait for a connection, and what became of each. */
export function PendingChip() {
  const { t, number } = useT();
  const items = useQueueItems();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)} className="gap-1.5">
        <CloudOff className="size-4" aria-hidden />
        {t(items.length === 1 ? 'offline.chipOne' : 'offline.chipOther', { count: number(items.length) })}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('offline.listTitle')} description={t('offline.listBody')}>
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-line p-3">
                <p className="text-md font-medium text-ink">
                  {item.kind === 'report' ? String(item.body.title ?? '') : item.label}
                </p>
                <p className="mt-0.5 text-sm text-ink-3">
                  {item.state === 'failed'
                    ? `${t('offline.failed')}: ${item.error === DEPENDENT_ERROR ? t('offline.dependentFailed') : (item.error ?? '')}`
                    : item.reference
                      ? t('offline.sendingPhotos', { reference: item.reference })
                      : t('offline.waiting')}
                </p>
                <div className="mt-2 flex gap-2">
                  {item.state === 'failed' && (
                    <Button onClick={() => void retryQueued(item.id)}>{t('offline.retry')}</Button>
                  )}
                  <Button variant="ghost" onClick={() => void discardQueued(item.id)}>
                    {t('offline.discard')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
