import type { SiteDTO } from '@sentinel/shared';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Input } from '../../components/ui/input';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { fold, LoadError } from './parts';
import { usePlural } from './plural';
import { useSites } from './queries';
import { SiteDialog } from './site-dialog';
import { SitesTable } from './sites-table';

/** Below this many sites the list fits on a screen and a filter is noise. */
const FILTER_FROM = 8;

/** Active sites first, in the API's name order, then the inactive ones. */
function activeFirst(sites: SiteDTO[]) {
  return [...sites].sort((a, b) => Number(b.isActive) - Number(a.isActive));
}

function matches(site: SiteDTO, query: string) {
  return [site.name, site.code, site.city, site.address].some((value) => value && fold(value).includes(query));
}

export function SitesPage() {
  const { t } = useT();
  const tn = usePlural();
  const sites = useSites();
  const [dialog, setDialog] = useState<{ open: boolean; site: SiteDTO | null }>({ open: false, site: null });
  const [query, setQuery] = useState('');

  const ordered = useMemo(() => (sites.data ? activeFirst(sites.data) : []), [sites.data]);
  const visible = useMemo(() => {
    const folded = fold(query.trim());
    return folded ? ordered.filter((site) => matches(site, folded)) : ordered;
  }, [ordered, query]);

  const openCreate = () => setDialog({ open: true, site: null });
  const openEdit = (site: SiteDTO) => setDialog({ open: true, site });
  const addButton = (variant: 'primary' | 'secondary') => (
    <Button variant={variant} icon={<Plus className="size-4" aria-hidden />} onClick={openCreate}>
      {t('setup.sites.add')}
    </Button>
  );

  let body: ReactNode;
  if (sites.data) {
    if (ordered.length === 0) {
      body = (
        <EmptyState
          title={t('setup.sites.empty.title')}
          description={t('setup.sites.empty.body')}
          action={addButton('secondary')}
        />
      );
    } else {
      body = (
        <>
          {ordered.length >= FILTER_FROM && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('setup.sites.filterPlaceholder')}
                aria-label={t('setup.sites.filter')}
                leading={<Search aria-hidden />}
                className="w-full sm:w-80"
              />
              <p className="text-xs text-ink-3 tabular-nums" aria-live="polite">
                {tn('setup.sites.count', visible.length)}
              </p>
            </div>
          )}
          {visible.length > 0 ? (
            <SitesTable sites={visible} onOpen={openEdit} />
          ) : (
            <EmptyState
              title={t('setup.sites.noMatch')}
              action={<Button onClick={() => setQuery('')}>{t('setup.sites.clearFilter')}</Button>}
            />
          )}
        </>
      );
    }
  } else if (sites.isError) {
    body = <LoadError error={sites.error} onRetry={() => void sites.refetch()} retrying={sites.isFetching} />;
  } else {
    body = <SitesTable sites={[]} loading onOpen={openEdit} />;
  }

  return (
    <Page>
      <PageHeader
        title={t('setup.sites.title')}
        description={t('setup.sites.description')}
        actions={addButton('primary')}
      />
      <Panel>{body}</Panel>
      <SiteDialog
        open={dialog.open}
        site={dialog.site}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
    </Page>
  );
}
