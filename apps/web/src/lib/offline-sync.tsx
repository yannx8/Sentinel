import type { IncidentDetail } from '@sentinel/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from '../app/session';
import { ConfirmDialog } from '../components/ui/dialog';
import { toast } from '../components/ui/toast';
import { useT } from '../i18n';
import { api, ApiError, getActiveOrg } from './api';
import { createQueue, indexedDbStore, type NewItem, type Outcome, type QueueItem } from './offline-queue';

const queue = createQueue(typeof indexedDB === 'undefined' ? emptyStore() : indexedDbStore());

function emptyStore() {
  return { list: async () => [], put: async () => undefined, remove: async () => undefined };
}

/* What the screen shows: the signed-in person's items, refreshed after every change. */

let current: { userId: string | null; items: QueueItem[] } = { userId: null, items: [] };
const listeners = new Set<() => void>();
const publish = (next: typeof current) => {
  current = next;
  listeners.forEach((listener) => listener());
};
async function refresh(userId: string | null) {
  publish({ userId, items: userId ? await queue.list(userId) : [] });
}

export function useQueueItems() {
  return useSyncExternalStore(
    (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    () => current,
  ).items;
}

/** True for failures that say nothing about the report itself: no network, server trouble, or a lapsed session. */
function isTransient(error: unknown) {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || [401, 408, 429].includes(error.status);
}

async function sendItem(item: QueueItem, save: (patch: Partial<QueueItem>) => Promise<void>): Promise<Outcome> {
  if (item.kind === 'report') return sendReport(item, save);
  try {
    await api.post(item.path, item.body, { idempotencyKey: item.idempotencyKey, orgId: item.orgId });
    return 'done';
  } catch (error) {
    return isTransient(error) ? 'offline' : { failed: error instanceof Error ? error.message : '' };
  }
}

async function sendReport(item: QueueItem, save: (patch: Partial<QueueItem>) => Promise<void>): Promise<Outcome> {
  try {
    let reference = item.reference;
    if (!reference) {
      const incident = await api.post<IncidentDetail>('/incidents', item.body, {
        idempotencyKey: item.idempotencyKey,
        orgId: item.orgId,
      });
      reference = incident.reference;
      await save({ reference });
    }
    for (let index = item.photosSent; index < item.photos.length; index++) {
      try {
        const data = new FormData();
        data.append('file', item.photos[index]!);
        await api.post(`/incidents/${encodeURIComponent(reference)}/attachments`, data, { orgId: item.orgId });
      } catch (error) {
        // The report is safe. A photo the server refuses is skipped; a lost connection is retried.
        if (isTransient(error)) throw error;
      }
      await save({ photosSent: index + 1 });
    }
    return 'done';
  } catch (error) {
    return isTransient(error) ? 'offline' : { failed: error instanceof Error ? error.message : '' };
  }
}

let draining = false;
let onSent: (item: QueueItem) => void = () => undefined;

async function flush() {
  const userId = current.userId;
  if (!userId || draining) return;
  draining = true;
  try {
    const result = await queue.drain(userId, sendItem);
    result.sent.forEach(onSent);
  } finally {
    draining = false;
    await refresh(userId);
  }
}

/** Saves a report that could not be sent, to go out when the connection returns. */
export async function queueReport(input: NewItem) {
  await queue.add(input);
  await refresh(input.userId);
  void flush();
}

/** Keeps an action (accept, comment, resolve...) for sending later. False when nobody is signed in to own it. */
export async function queueAction(input: {
  path: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
  label: string;
}) {
  const userId = current.userId;
  const orgId = getActiveOrg();
  if (!userId || !orgId) return false;
  // Actions on the same incident or assignment share a group, which keeps their order.
  await queue.add({ ...input, userId, orgId, kind: 'action', group: input.path.split('/')[2] });
  await refresh(userId);
  void flush();
  return true;
}

export const retryQueued = async (id: string) => {
  if (!current.userId) return;
  await queue.retry(current.userId, id);
  await refresh(current.userId);
  void flush();
};

export const discardQueued = async (id: string) => {
  await queue.discard(id);
  await refresh(current.userId);
};

/** Replays the queue when the connection returns, when the app is opened again, and every half minute. Renders nothing. */
export function OfflineSync() {
  const { t } = useT();
  const { me } = useSession();
  const queryClient = useQueryClient();
  const userId = me?.user.id ?? null;

  useEffect(() => {
    onSent = (item) => {
      toast.success(
        item.kind === 'report'
          ? t('offline.sentToast', { reference: item.reference ?? '' })
          : t('offline.actionSentToast', { label: item.label }),
      );
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      void queryClient.invalidateQueries({ queryKey: ['incident'] });
    };
  }, [t, queryClient]);

  useEffect(() => {
    void refresh(userId).then(() => flush());
    if (!userId) return;
    const run = () => void flush();
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    const timer = window.setInterval(run, 30_000);
    return () => {
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      window.clearInterval(timer);
    };
  }, [userId]);

  return null;
}

/* Sign-out asks first when reports are still waiting. */

let askSignOut: ((proceed: () => Promise<void>) => void) | null = null;

/** Runs `proceed` now, or after the person confirms when reports would be lost. */
export function guardSignOut(proceed: () => Promise<void>) {
  if (current.items.length === 0 || !askSignOut) return proceed();
  askSignOut(proceed);
}

export function SignOutGuard() {
  const { t } = useT();
  const items = useQueueItems();
  const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
  useEffect(() => {
    askSignOut = (proceed) => setPending(() => proceed);
    return () => {
      askSignOut = null;
    };
  }, [setPending]);
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={t('offline.signOutTitle')}
      description={t('offline.signOutBody', { count: items.length })}
      confirmLabel={t('offline.signOutConfirm')}
      variant="danger"
      onConfirm={async () => {
        const proceed = pending;
        setPending(null);
        // Signing out means these reports are gone: leave nothing behind for the next person on this phone.
        await Promise.all(items.map((item) => queue.discard(item.id)));
        await proceed?.();
      }}
    />
  );
}
