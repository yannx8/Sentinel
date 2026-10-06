import type { IncidentListItem, MemberDTO, Page } from '@sentinel/shared';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PriorityIcon, StatusIcon } from '../../components/domain/glyphs';
import { Avatar } from '../../components/ui/avatar';
import { Kbd } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { useT } from '../../i18n';
import { api } from '../../lib/api';

export type PaletteLink = { label: string; to: string; icon: ReactNode; keywords?: string[] };

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const itemClass =
  'flex h-10 cursor-default items-center gap-3 rounded-sm px-3 text-sm text-ink select-none data-[selected=true]:bg-muted [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-ink-3';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3';

/** Ctrl or Cmd + K: jump to an incident by reference or title, a person, or a page. */
export function CommandPalette({
  open,
  onOpenChange,
  links,
  searchPeople,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: PaletteLink[];
  searchPeople: boolean;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim(), 180);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const incidents = useQuery({
    queryKey: ['palette', 'incidents', term],
    queryFn: () => api.page<IncidentListItem>('/incidents', { query: { q: term, limit: 6, sort: 'updated' } }),
    enabled: open && term.length >= 2,
    staleTime: 15_000,
  });
  const people = useQuery({
    queryKey: ['palette', 'people', term],
    queryFn: () => api.get<MemberDTO[]>('/members', { query: { q: term } }),
    enabled: open && searchPeople && term.length >= 2,
    staleTime: 15_000,
  });

  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false);
    void navigate({ to, search });
  };

  const incidentRows = (incidents.data as Page<IncidentListItem> | undefined)?.data ?? [];
  const peopleRows = (people.data ?? []).slice(0, 5);
  const busy = (incidents.isFetching || people.isFetching) && term.length >= 2;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[80] bg-scrim animate-fade-in" />
        <RadixDialog.Content className="fixed top-[12vh] left-1/2 z-[81] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-dialog animate-sheet-in focus:outline-none">
          <RadixDialog.Title className="sr-only">{t('shell.search')}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{t('shell.palette.hint')}</RadixDialog.Description>
          <Command shouldFilter={false} loop label={t('shell.search')}>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t('shell.palette.placeholder')}
                className="h-12 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3"
              />
              {busy && <Spinner className="text-ink-3" label={t('shell.palette.searching')} />}
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {term.length >= 2 && !busy && incidentRows.length === 0 && peopleRows.length === 0 && (
                <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">{t('shell.palette.empty')}</Command.Empty>
              )}
              {incidentRows.length > 0 && (
                <Command.Group heading={t('shell.palette.incidents')} className={groupClass}>
                  {incidentRows.map((incident) => (
                    <Command.Item
                      key={incident.id}
                      value={`incident-${incident.id}`}
                      onSelect={() => go('/app/incidents', { incident: incident.reference })}
                      className={itemClass}
                    >
                      <PriorityIcon priority={incident.priority} />
                      <span className="w-[112px] shrink-0 text-xs text-ink-3 tabular-nums">{incident.reference}</span>
                      <span className="min-w-0 flex-1 truncate">{incident.title}</span>
                      <StatusIcon status={incident.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {peopleRows.length > 0 && (
                <Command.Group heading={t('shell.palette.people')} className={groupClass}>
                  {peopleRows.map((member) => {
                    const name = `${member.firstName} ${member.lastName}`;
                    const tab = member.role === 'REPORTER' ? 'employees' : member.role === 'INTERVENANT' ? 'intervenants' : 'supervisors';
                    return (
                      <Command.Item
                        key={member.id}
                        value={`member-${member.id}`}
                        onSelect={() => go('/app/team', { tab, q: name })}
                        className={itemClass}
                      >
                        <Avatar name={name} size="xs" />
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                        <span className="text-xs text-ink-3">{t(`common.role.${member.role}`)}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              <Command.Group heading={t('shell.palette.pages')} className={groupClass}>
                {links
                  .filter((link) => {
                    if (!term) return true;
                    const needle = term.toLowerCase();
                    return [link.label, ...(link.keywords ?? [])].some((value) => value.toLowerCase().includes(needle));
                  })
                  .map((link) => (
                    <Command.Item key={link.to} value={`page-${link.to}`} onSelect={() => go(link.to)} className={itemClass}>
                      {link.icon}
                      <span className="flex-1">{link.label}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-between border-t border-line bg-subtle/60 px-4 py-2 text-xs text-ink-3">
              <span>{t('shell.palette.hint')}</span>
              <span className="hidden items-center gap-1 sm:flex">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
              </span>
            </div>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
