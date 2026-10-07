import type { NotificationDTO, Page } from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { useLiveUpdates } from './live-updates';
import { NotificationItem, notificationKeys, useMarkAllRead, useOpenNotification } from './parts';

export function NotificationBell({ to }: { to: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useLiveUpdates();
  const open_ = useOpenNotification();
  const markAll = useMarkAllRead();
  const unread = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
  const recent = useQuery({
    queryKey: notificationKeys.recent,
    queryFn: () => api.page<NotificationDTO>('/notifications', { query: { limit: 8 } }),
    enabled: open,
  });
  const count = unread.data?.count ?? 0;
  const items = (recent.data as Page<NotificationDTO> | undefined)?.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          label={count ? `${t('notifications.title')} (${count})` : t('notifications.title')}
          className="relative"
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden />
          )}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold text-ink">{t('notifications.title')}</p>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => markAll.mutate()}
            className="text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-40"
          >
            {t('notifications.markAllRead')}
          </button>
        </div>
        <div className="max-h-[min(420px,60vh)] divide-y divide-line overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-3">
              {recent.isPending ? t('common.loading') : t('notifications.empty')}
            </p>
          ) : (
            items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onOpen={(n) => {
                  setOpen(false);
                  open_(n);
                }}
              />
            ))
          )}
        </div>
        <Link
          to={to}
          onClick={() => setOpen(false)}
          className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-ink-2 hover:text-ink"
        >
          {t('notifications.viewAll')}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
