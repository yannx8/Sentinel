import type { PlatformAuditDTO } from '@sentinel/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT } from '../../i18n';
import { api } from '../../lib/api';

export function PlatformAuditPage() {
  const { t, date } = useT();
  const query = useInfiniteQuery({
    queryKey: ['platform', 'audit'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.page<PlatformAuditDTO>('/platform/audit', { query: { cursor: pageParam, limit: 50 } }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <Page>
      <PageHeader title={t('platform.audit.title')} description={t('platform.audit.description')} />
      <Panel>
        {query.isPending ? (
          <div className="grid gap-px p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('platform.audit.empty')} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('platform.audit.columns.time')}</Th>
                <Th>{t('platform.audit.columns.event')}</Th>
                <Th>{t('platform.audit.columns.organization')}</Th>
                <Th className="hidden md:table-cell">{t('platform.audit.columns.admin')}</Th>
                <Th className="hidden lg:table-cell">{t('platform.audit.columns.reason')}</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="whitespace-nowrap text-ink-2 tabular-nums">{date(row.createdAt, 'datetime')}</Td>
                  <Td>{t(`platform.audit.events.${row.type}`)}</Td>
                  <Td>
                    {row.organization ? (
                      <Link
                        to="/platform/organizations/$organizationId"
                        params={{ organizationId: row.organization.id }}
                        className="hover:underline"
                      >
                        {row.organization.displayName}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">{row.admin.name}</Td>
                  <Td className="hidden max-w-sm truncate text-ink-2 lg:table-cell">{row.reason ?? '-'}</Td>
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
