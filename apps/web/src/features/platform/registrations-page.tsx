import type { RegistrationDTO } from '@sentinel/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { Segmented } from '../../components/ui/segmented';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';

type Filter = 'ALL' | RegistrationDTO['status'];

export function PlatformRegistrationsPage() {
  const { t, date } = useT();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const query = useInfiniteQuery({
    queryKey: ['platform', 'registrations', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.page<RegistrationDTO>('/platform/registrations', {
        query: { status: filter === 'ALL' ? undefined : filter, cursor: pageParam, limit: 50 },
      }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const resend = useMutation({
    mutationFn: (id: string) => api.post<RegistrationDTO>(`/platform/registrations/${id}/resend`),
    onSuccess: (registration) => {
      toast.success(t('platform.registrations.resent', { email: registration.email }));
      void queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (error) => toastError(error, t),
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  const tone = { PENDING: 'warning', EXPIRED: 'neutral', VERIFIED: 'success' } as const;
  const label = { PENDING: 'pending', EXPIRED: 'expired', VERIFIED: 'verified' } as const;

  return (
    <Page>
      <PageHeader title={t('platform.registrations.title')} description={t('platform.registrations.description')}>
        <Segmented<Filter>
          label={t('platform.registrations.title')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: t('platform.registrations.all') },
            { value: 'PENDING', label: t('platform.registrations.pending') },
            { value: 'EXPIRED', label: t('platform.registrations.expired') },
            { value: 'VERIFIED', label: t('platform.registrations.verified') },
          ]}
        />
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <div className="grid gap-px p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('platform.registrations.empty')} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('platform.registrations.columns.company')}</Th>
                <Th>{t('platform.registrations.columns.contact')}</Th>
                <Th>{t('platform.registrations.columns.status')}</Th>
                <Th className="hidden md:table-cell">{t('platform.registrations.columns.created')}</Th>
                <Th className="hidden md:table-cell">{t('platform.registrations.columns.expires')}</Th>
                <Th />
              </tr>
            </THead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.companyName}</Td>
                  <Td>
                    {row.contactName}
                    <span className="block text-xs text-ink-3">{row.email}</span>
                  </Td>
                  <Td>
                    <Badge tone={tone[row.status]}>{t(`platform.registrations.${label[row.status]}`)}</Badge>
                  </Td>
                  <Td className="hidden text-ink-2 md:table-cell">{date(row.createdAt, 'datetime')}</Td>
                  <Td className="hidden text-ink-2 md:table-cell">{date(row.expiresAt, 'datetime')}</Td>
                  <Td className="text-right">
                    {row.status !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        onClick={() => resend.mutate(row.id)}
                        loading={resend.isPending && resend.variables === row.id}
                      >
                        {t('platform.registrations.resend')}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        {query.hasNextPage && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
              {t('common.loadMore')}
            </Button>
          </div>
        )}
      </Panel>
    </Page>
  );
}
