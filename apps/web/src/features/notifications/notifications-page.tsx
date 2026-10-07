import type { NotificationDTO } from '@sentinel/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from '../../app/session';
import { Button } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Page, PageHeader } from '../../components/ui/layout';
import { Segmented } from '../../components/ui/segmented';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { NotificationItem, notificationKeys, useMarkAllRead, useOpenNotification } from './parts';

export function NotificationsPage() {
  const { t } = useT();
  const { membership } = useSession();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const open = useOpenNotification();
  const markAll = useMarkAllRead();
  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(filter === 'unread'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.page<NotificationDTO>('/notifications', {
        query: { cursor: pageParam, limit: 30, unread: filter === 'unread' ? 'true' : undefined },
      }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((p) => p.data) ?? [];
  const actions = (
    <>
      <Segmented
        label={t('notifications.title')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('notifications.all') },
          { value: 'unread', label: t('notifications.unread') },
        ]}
      />
      <Button onClick={() => markAll.mutate()} loading={markAll.isPending}>
        {t('notifications.markAllRead')}
      </Button>
    </>
  );

  const list = query.isPending ? (
    <div className="grid gap-px">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  ) : items.length === 0 ? (
    <EmptyState title={filter === 'unread' ? t('notifications.emptyUnread') : t('notifications.empty')} />
  ) : (
    <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {items.map((item) => (
        <NotificationItem key={item.id} item={item} onOpen={open} />
      ))}
      {query.hasNextPage && (
        <div className="p-3 text-center">
          <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            {t('notifications.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );

  if (membership?.role !== 'SUPERVISOR') {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{t('notifications.title')}</h1>
          <Segmented
            label={t('notifications.title')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('notifications.all') },
              { value: 'unread', label: t('notifications.unread') },
            ]}
          />
        </div>
        {list}
      </div>
    );
  }
  return (
    <Page width="narrow">
      <PageHeader title={t('notifications.title')} description={t('notifications.description')} actions={actions} />
      {list}
    </Page>
  );
}
