import type { NotificationDTO } from '@sentinel/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSession } from '../../app/session';
import { cn } from '../../lib/cn';
import { useT } from '../../i18n';
import { api } from '../../lib/api';

/**
 * Supervisors read the active organization's notifications. Employees and intervenants read every
 * organization they belong to (/me), so nobody has to switch organization to see what is theirs.
 * Person-scoped keys live under 'me', so they survive an organization switch.
 */
export function useNotificationScope() {
  const { membership } = useSession();
  const person = membership?.role !== 'SUPERVISOR';
  const root = person ? (['me', 'notifications'] as const) : (['notifications'] as const);
  return {
    person,
    path: person ? '/me/notifications' : '/notifications',
    keys: {
      all: root,
      unread: [...root, 'unread'] as const,
      recent: [...root, 'recent'] as const,
      list: (unreadOnly: boolean) => [...root, 'list', unreadOnly] as const,
    },
  };
}

/** Where a notification leads, by role. */
export function useOpenNotification() {
  const { membership } = useSession();
  const scope = useNotificationScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`${scope.path}/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scope.keys.all }),
  });
  return (item: NotificationDTO) => {
    if (!item.readAt) markRead.mutate(item.id);
    if (!item.incident) return;
    if (membership?.role === 'SUPERVISOR')
      void navigate({ to: '/app/incidents', search: { incident: item.incident.reference } });
    else
      void navigate({
        to: '/field/incidents/$reference',
        params: { reference: item.incident.reference },
        search: { org: item.organization.id },
      });
  };
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const scope = useNotificationScope();
  return useMutation({
    mutationFn: () => api.post(`${scope.path}/read-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scope.keys.all }),
  });
}

export function NotificationItem({
  item,
  onOpen,
  showOrganization,
}: {
  item: NotificationDTO;
  onOpen: (item: NotificationDTO) => void;
  /** For people who work for several organizations. */
  showOrganization?: boolean;
}) {
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
        {showOrganization && (
          <span className="mt-0.5 block truncate text-xs font-medium text-ink-2">{item.organization.displayName}</span>
        )}
      </span>
      <time dateTime={item.createdAt} className="shrink-0 text-xs text-ink-3">
        {relative(item.createdAt)}
      </time>
    </button>
  );
}
