import type { SavedViewDTO } from '@sentinel/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bookmark, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { IncidentsSearch } from '../../app/router';
import { Button, IconButton } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { api } from '../../lib/api';
import { toastError } from '../../lib/forms';

const savedViewsKey = ['saved-views'] as const;
const FILTER_KEYS = ['view', 'q', 'priority', 'site', 'category', 'assignee', 'sort'] as const;

/** The filters in the URL that a saved view can hold (never the open incident). */
function filtersOf(search: IncidentsSearch): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of FILTER_KEYS) if (search[key]) params[key] = search[key];
  return params;
}

export function SavedViewsMenu({ search }: { search: IncidentsSearch }) {
  const { t } = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const views = useQuery({
    queryKey: savedViewsKey,
    queryFn: () => api.get<SavedViewDTO[]>('/views'),
    enabled: open,
  });
  const params = filtersOf(search);
  const canSave = Object.keys(params).length > 0 && name.trim().length > 0;

  const save = useMutation({
    mutationFn: () => api.post<SavedViewDTO>('/views', { name: name.trim(), params }),
    onSuccess: () => {
      setName('');
      toast.success(t('incidents.saved.saved'));
      void queryClient.invalidateQueries({ queryKey: savedViewsKey });
    },
    onError: (error) => toastError(error, t),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/views/${id}`),
    onSuccess: () => {
      toast.success(t('incidents.saved.deleted'));
      void queryClient.invalidateQueries({ queryKey: savedViewsKey });
    },
    onError: (error) => toastError(error, t),
  });

  const apply = (view: SavedViewDTO) => {
    setOpen(false);
    void navigate({
      to: '/app/incidents',
      search: { ...view.params, incident: search.incident } as IncidentsSearch,
      replace: true,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button icon={<Bookmark className="size-3.5" />} aria-label={t('incidents.saved.title')}>
          <span className="hidden sm:inline">{t('incidents.saved.title')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <ul className="mb-2 max-h-56 overflow-y-auto">
          {views.data?.length === 0 && <li className="px-2 py-3 text-sm text-ink-3">{t('incidents.saved.empty')}</li>}
          {views.data?.map((view) => (
            <li key={view.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => apply(view)}
                className="min-w-0 flex-1 truncate rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-subtle"
              >
                {view.name}
              </button>
              <IconButton
                label={t('incidents.saved.delete', { name: view.name })}
                onClick={() => remove.mutate(view.id)}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
        <form
          className="flex items-center gap-2 border-t border-line pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <Input
            className="min-w-0 flex-1"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('incidents.saved.namePlaceholder')}
            aria-label={t('incidents.saved.namePlaceholder')}
          />
          <Button type="submit" variant="primary" disabled={!canSave} loading={save.isPending}>
            {t('incidents.saved.save')}
          </Button>
        </form>
        {Object.keys(params).length === 0 && (
          <p className="px-1 pt-2 text-xs text-ink-3">{t('incidents.saved.nothingToSave')}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
