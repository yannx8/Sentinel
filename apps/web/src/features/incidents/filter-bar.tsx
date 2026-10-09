import {
  inboxViews,
  priorities,
  type CategoryDTO,
  type InboxView,
  type MemberDTO,
  type SiteDTO,
} from '@sentinel/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowDownUp, ListFilter, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PriorityLabel } from '../../components/domain/glyphs';
import { densities, type Density } from '../../lib/density';
import { SavedViewsMenu } from './saved-views';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '../../components/ui/menu';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import type { IncidentsSearch } from '../../app/router';
import { useDebounced } from './hooks';

const sorts = ['urgency', 'newest', 'oldest', 'updated'] as const;

function useCatalogs() {
  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get<SiteDTO[]>('/sites'), staleTime: 60_000 });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<CategoryDTO[]>('/categories'),
    staleTime: 60_000,
  });
  const assignees = useQuery({
    queryKey: ['members', 'INTERVENANT'],
    queryFn: () => api.get<MemberDTO[]>('/members', { query: { role: 'INTERVENANT', status: 'ACTIVE' } }),
    staleTime: 60_000,
  });
  return { sites: sites.data ?? [], categories: categories.data ?? [], assignees: assignees.data ?? [] };
}

export function FilterBar({
  search,
  counts,
  density,
  onDensity,
  onCreate,
}: {
  search: IncidentsSearch;
  counts?: Partial<Record<InboxView, number>>;
  density: Density;
  onDensity: (density: Density) => void;
  onCreate: () => void;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const catalogs = useCatalogs();
  const [text, setText] = useState(search.q ?? '');
  const debounced = useDebounced(text.trim(), 250);
  const update = (patch: Partial<IncidentsSearch>) =>
    void navigate({ to: '/app/incidents', search: (prev: IncidentsSearch) => ({ ...prev, ...patch }), replace: true });

  useEffect(() => {
    if ((search.q ?? '') !== debounced) update({ q: debounced || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const view = search.view ?? 'attention';
  const selectedPriorities = (search.priority ?? '').split(',').filter(Boolean);
  const togglePriority = (priority: string, on: boolean) => {
    const next = on ? [...selectedPriorities, priority] : selectedPriorities.filter((p) => p !== priority);
    update({ priority: next.length ? next.join(',') : undefined });
  };

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (selectedPriorities.length) {
    chips.push({
      key: 'priority',
      label: selectedPriorities.map((p) => t(`common.priority.${p as 'LOW'}`)).join(', '),
      clear: () => update({ priority: undefined }),
    });
  }
  const site = catalogs.sites.find((s) => s.id === search.site);
  if (search.site)
    chips.push({
      key: 'site',
      label: site?.name ?? t('incidents.filters.site'),
      clear: () => update({ site: undefined }),
    });
  const category = catalogs.categories.find((c) => c.id === search.category);
  if (search.category)
    chips.push({
      key: 'category',
      label: category?.name ?? t('incidents.filters.category'),
      clear: () => update({ category: undefined }),
    });
  const assignee = catalogs.assignees.find((a) => a.id === search.assignee);
  if (search.assignee) {
    chips.push({
      key: 'assignee',
      label: assignee ? `${assignee.firstName} ${assignee.lastName}` : t('incidents.filters.assignee'),
      clear: () => update({ assignee: undefined }),
    });
  }

  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold text-ink">{t('incidents.title')}</h1>
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={onCreate}>
          {t('incidents.new')}
        </Button>
      </div>
      <div role="tablist" aria-label={t('incidents.title')} className="flex gap-4 overflow-x-auto px-4">
        {inboxViews.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={view === value}
            type="button"
            onClick={() => update({ view: value === 'attention' ? undefined : value, incident: search.incident })}
            className={cn(
              'relative -mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors',
              view === value ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink',
            )}
          >
            {t(`incidents.views.${value}`)}
            {counts?.[value] ? (
              <span className="rounded-full bg-muted px-1.5 text-2xs font-semibold tabular-nums text-ink-2">
                {counts[value]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-subtle/50 px-4 py-2">
        <Input
          className="min-w-0 flex-1"
          leading={<Search />}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('incidents.search')}
          aria-label={t('incidents.search')}
        />
        <SavedViewsMenu search={search} />
        <Menu>
          <MenuTrigger asChild>
            <Button icon={<ListFilter className="size-3.5" />} aria-label={t('incidents.filters.filter')}>
              <span className="hidden sm:inline">{t('incidents.filters.filter')}</span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end" className="w-60">
            <MenuLabel>{t('incidents.filters.priority')}</MenuLabel>
            {[...priorities].reverse().map((priority) => (
              <MenuCheckboxItem
                key={priority}
                checked={selectedPriorities.includes(priority)}
                onCheckedChange={(on) => togglePriority(priority, on)}
              >
                <PriorityLabel priority={priority} />
              </MenuCheckboxItem>
            ))}
            <MenuSeparator />
            {(
              [
                [
                  'site',
                  t('incidents.filters.site'),
                  catalogs.sites.map((s) => ({ id: s.id, label: s.name })),
                  search.site,
                ],
                [
                  'category',
                  t('incidents.filters.category'),
                  catalogs.categories.map((c) => ({ id: c.id, label: c.name })),
                  search.category,
                ],
                [
                  'assignee',
                  t('incidents.filters.assignee'),
                  catalogs.assignees.map((a) => ({ id: a.id, label: `${a.firstName} ${a.lastName}` })),
                  search.assignee,
                ],
              ] as const
            ).map(([key, label, options, current]) => (
              <MenuSub key={key}>
                <MenuSubTrigger>{label}</MenuSubTrigger>
                <MenuSubContent>
                  <MenuRadioGroup
                    value={current ?? ''}
                    onValueChange={(value) => update({ [key]: value || undefined })}
                  >
                    <MenuRadioItem value="">{t('common.all')}</MenuRadioItem>
                    {options.map((option) => (
                      <MenuRadioItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuSubContent>
              </MenuSub>
            ))}
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger asChild>
            <Button icon={<ArrowDownUp className="size-3.5" />} aria-label={t('incidents.sort.label')}>
              <span className="hidden sm:inline">{t(`incidents.sort.${search.sort ?? 'urgency'}`)}</span>
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuRadioGroup
              value={search.sort ?? 'urgency'}
              onValueChange={(value) =>
                update({ sort: value === 'urgency' ? undefined : (value as (typeof sorts)[number]) })
              }
            >
              {sorts.map((value) => (
                <MenuRadioItem key={value} value={value}>
                  {t(`incidents.sort.${value}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
            <MenuLabel>{t('incidents.density.label')}</MenuLabel>
            <MenuRadioGroup value={density} onValueChange={(value) => onDensity(value as Density)}>
              {densities.map((value) => (
                <MenuRadioItem key={value} value={value}>
                  {t(`incidents.density.${value}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-6 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs font-medium text-ink-2"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.clear}
                className="rounded-full p-0.5 hover:bg-line-strong"
                aria-label={`${t('common.remove')} ${chip.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-ink-3 hover:text-ink"
            onClick={() => {
              setText('');
              update({ q: undefined, priority: undefined, site: undefined, category: undefined, assignee: undefined });
            }}
          >
            {t('common.clearAll')}
          </button>
        </div>
      )}
    </div>
  );
}
