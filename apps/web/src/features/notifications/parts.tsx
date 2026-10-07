import type { NotificationDTO } from '@sentinel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSession } from '../../app/session';
import { cn } from '../../lib/cn';
import { useT } from '../../i18n';
import { api } from '../../lib/api';

export const notificationKeys = {
  unread: ['notifications', 'unread'] as const,
  recent: ['notifications', 'recent'] as const,
  list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
};

/** Where a notification leads, by role. */
export function useOpenNotification() {
  const { membership } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  return (item: NotificationDTO) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (!item.incident) return;
    if (membership?.role === 'SUPERVISOR')
      void navigate({ to: '/app/incidents', search: { incident: item.incident.reference } });
    else void navigate({ to: '/field/incidents/$reference', params: { reference: item.incident.reference } });
  };
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function NotificationItem({ item, onOpen }: { item: NotificationDTO; onOpen: (item: NotificationDTO) => void }) {
  const { t, relative } = useT();
  const sentence = t(`notifications.types.${item.type}`, { actor: item.actorName ?? t('thread.someone') });
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle"
    >
      <span className="mt-1.5 flex size-2 shrink-0">
        <span className={cn('size-2 rounded-full', item.readAt ? 'bg-transparent' : 'bg-accent')} aria-hidden />
        {!item.readAt && <span className="sr-only">{t('notifications.unread')}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', item.readAt ? 'text-ink-2' : 'font-medium text-ink')}>
          {sentence}
          {item.incident && (
            <span className="ml-1.5 font-normal text-ink-3 tabular-nums">{item.incident.reference}</span>
          )}
        </span>
        {item.incident && <span className="mt-0.5 block truncate text-sm text-ink-3">{item.incident.title}</span>}
      </span>
      <time dateTime={item.createdAt} className="shrink-0 text-xs text-ink-3">
        {relative(item.createdAt)}
      </time>
    </button>
  );
}
