import type { PlatformOrganizationDTO } from '@sentinel/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState, Skeleton } from '../../components/ui/feedback';
import { Input } from '../../components/ui/input';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { Segmented } from '../../components/ui/segmented';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { OrgStatusBadge } from './parts';

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

export function PlatformOrganizationsPage() {
  const { t, date, relative } = useT();
  const search = useSearch({ from: '/platform/organizations' });
  const navigate = useNavigate();
  const [text, setText] = useState(search.q ?? '');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((search.q ?? '') !== text.trim())
        void navigate({
          to: '/platform/organizations',
          search: { ...search, q: text.trim() || undefined },
          replace: true,
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [text, search, navigate]);

  const query = useInfiniteQuery({
    queryKey: ['platform', 'organizations', search.q, search.status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.page<PlatformOrganizationDTO>('/platform/organizations', {
        query: { q: search.q, status: search.status, cursor: pageParam, limit: 50 },
      }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Page>
      <PageHeader title={t('platform.organizations.title')} description={t('platform.organizations.description')}>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="w-full sm:w-80"
            leading={<Search />}
            placeholder={t('platform.organizations.search')}
            aria-label={t('platform.organizations.search')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Segmented<StatusFilter>
            label={t('platform.organizations.title')}
            value={search.status === 'ACTIVE' || search.status === 'SUSPENDED' ? search.status : 'ALL'}
            onChange={(value) =>
              void navigate({
                to: '/platform/organizations',
                search: { ...search, status: value === 'ALL' ? undefined : value },
              })
            }
            options={[
              { value: 'ALL', label: t('platform.organizations.all') },
              { value: 'ACTIVE', label: t('common.orgStatus.ACTIVE') },
              { value: 'SUSPENDED', label: t('common.orgStatus.SUSPENDED') },
            ]}
          />
        </div>
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <div className="grid gap-px p-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('platform.organizations.empty')} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>{t('platform.organizations.columns.organization')}</Th>
                <Th>{t('platform.organizations.columns.plan')}</Th>
                <Th className="hidden lg:table-cell">{t('platform.organizations.columns.owner')}</Th>
                <Th className="text-right">{t('platform.organizations.columns.members')}</Th>
                <Th className="hidden text-right md:table-cell">{t('platform.organizations.columns.sites')}</Th>
                <Th className="hidden text-right md:table-cell">{t('platform.organizations.columns.incidents')}</Th>
                <Th className="hidden xl:table-cell">{t('platform.organizations.columns.activity')}</Th>
                <Th className="hidden xl:table-cell">{t('platform.organizations.columns.created')}</Th>
              </tr>
            </THead>
            <tbody>
              {rows.map((org) => (
                <Tr key={org.id}>
                  <Td>
                    <Link
                      to="/platform/organizations/$organizationId"
                      params={{ organizationId: org.id }}
                      className="block hover:underline"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {org.displayName}
                        <OrgStatusBadge status={org.status} />
                      </span>
                      <span className="block text-xs text-ink-3">{org.legalName}</span>
                    </Link>
                  </Td>
                  <Td>
                    {t(`common.plan.${org.plan}`)}
                    {org.plan === 'TRIAL' && org.trialEndsAt && (
                      <span className="block text-xs text-ink-3">
                        {t('platform.organizations.trialEnds', { date: date(org.trialEndsAt, 'date') })}
                      </span>
                    )}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {org.owner ? (
                      <>
                        {org.owner.name}
                        <span className="block text-xs text-ink-3">{org.owner.email}</span>
                      </>
                    ) : (
                      '-'
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{org.counts.members}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{org.counts.sites}</Td>
                  <Td className="hidden text-right tabular-nums md:table-cell">{org.counts.incidentsLast30Days}</Td>
                  <Td className="hidden text-ink-2 xl:table-cell">
                    {org.lastActivityAt ? relative(org.lastActivityAt) : t('platform.organizations.never')}
                  </Td>
                  <Td className="hidden text-ink-2 xl:table-cell">{date(org.createdAt, 'date')}</Td>
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
