import type { CategoryDTO } from '@sentinel/shared';
import { Switch } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/feedback';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { toast } from '../../components/ui/toast';
import { PriorityLabel } from '../../components/domain/glyphs';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { NotSet, OpenIncidentsLink, rowOpener } from './parts';
import { usePlural } from './plural';
import { useToggleCategory } from './queries';

function CategoryRow({ category, onOpen }: { category: CategoryDTO; onOpen: (category: CategoryDTO) => void }) {
  const { t } = useT();
  const tn = usePlural();
  const toggle = useToggleCategory();
  const muted = !category.isActive;

  const change = (isActive: boolean) =>
    toggle.mutate(
      { category, isActive },
      {
        onSuccess: (saved) =>
          toast.success(
            t(saved.isActive ? 'setup.categories.toast.reactivated' : 'setup.categories.toast.deactivated', { name: saved.name }),
            {
              action: {
                label: t('setup.undo'),
                onClick: () => toggle.mutate({ category: saved, isActive: !saved.isActive }),
              },
            },
          ),
      },
    );

  return (
    <Tr interactive onClick={rowOpener(() => onOpen(category))}>
      <Td className="min-w-32 sm:min-w-44">
        <button
          type="button"
          onClick={() => onOpen(category)}
          className={cn(
            'block max-w-80 truncate rounded-xs text-left font-medium underline-offset-2 hover:underline',
            muted ? 'text-ink-3' : 'text-ink',
          )}
        >
          {category.name}
        </button>
      </Td>
      <Td className="whitespace-nowrap">
        <PriorityLabel priority={category.defaultPriority} className={cn(muted && 'text-ink-3')} />
      </Td>
      <Td className="hidden md:table-cell">
        {category.specialty ? (
          <span className={cn('block max-w-56 truncate', muted ? 'text-ink-3' : 'text-ink-2')}>{category.specialty.name}</span>
        ) : (
          <NotSet />
        )}
      </Td>
      <Td className="hidden text-right sm:table-cell">
        <OpenIncidentsLink
          count={category.openIncidents}
          label={tn('setup.categories.openIncidents', category.openIncidents, { category: category.name })}
          filter={{ category: category.id }}
          muted={muted}
        />
      </Td>
      <Td className="w-16 text-right">
        <Switch
          checked={category.isActive}
          onCheckedChange={change}
          disabled={toggle.isPending}
          aria-label={t('setup.categories.activeSwitch', { name: category.name })}
        />
      </Td>
    </Tr>
  );
}

function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <Tr key={index}>
          <Td>
            <Skeleton className="h-3.5 w-36" />
          </Td>
          <Td>
            <span className="flex items-center gap-1.5">
              <Skeleton className="size-4" />
              <Skeleton className="h-3.5 w-14" />
            </span>
          </Td>
          <Td className="hidden md:table-cell">
            <Skeleton className="h-3.5 w-24" />
          </Td>
          <Td className="hidden sm:table-cell">
            <Skeleton className="ml-auto h-3.5 w-5" />
          </Td>
          <Td>
            <Skeleton className="ml-auto h-5 w-9 rounded-full" />
          </Td>
        </Tr>
      ))}
    </>
  );
}

export function CategoriesTable({
  categories,
  loading,
  onOpen,
}: {
  categories: CategoryDTO[];
  loading?: boolean;
  onOpen: (category: CategoryDTO) => void;
}) {
  const { t } = useT();
  return (
    <Table>
      <caption className="sr-only">{t('setup.categories.title')}</caption>
      <THead>
        <tr>
          <Th>{t('setup.categories.columns.name')}</Th>
          <Th>
            <span className="sm:hidden">{t('setup.categories.columns.priorityShort')}</span>
            <span className="hidden sm:inline">{t('setup.categories.columns.priority')}</span>
          </Th>
          <Th className="hidden md:table-cell">{t('setup.categories.columns.specialty')}</Th>
          <Th className="hidden text-right sm:table-cell">{t('setup.categories.columns.openIncidents')}</Th>
          <Th className="text-right">{t('setup.categories.columns.active')}</Th>
        </tr>
      </THead>
      <tbody aria-busy={loading || undefined}>
        {loading ? (
          <SkeletonRows />
        ) : (
          categories.map((category) => <CategoryRow key={category.id} category={category} onOpen={onOpen} />)
        )}
      </tbody>
    </Table>
  );
}
