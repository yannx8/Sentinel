import type { IncidentListItem } from '@sentinel/shared';
import { memo } from 'react';
import { PriorityIcon, StatusIcon } from '../../components/domain/glyphs';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/feedback';
import { Tooltip } from '../../components/ui/tooltip';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import type { Density } from '../../lib/density';

const rowPadding: Record<Density, string> = { compact: 'py-1.5', default: 'py-2.5', comfortable: 'py-3.5' };

export function FlagBadges({ item }: { item: Pick<IncidentListItem, 'flags' | 'triaged' | 'status' | 'channel'> }) {
  const { t } = useT();
  return (
    <>
      {item.channel === 'QR_GUEST' && <Badge tone="outline">{t('incidents.visitor')}</Badge>}
      {item.flags.declined && <Badge tone="critical">{t('incidents.flags.declined')}</Badge>}
      {item.flags.reassignmentRequested && <Badge tone="warning">{t('incidents.flags.reassignmentRequested')}</Badge>}
      {item.flags.sentBack && <Badge tone="warning">{t('incidents.flags.sentBack')}</Badge>}
      {!item.triaged && item.status === 'NEW' && <Badge tone="outline">{t('incidents.notTriaged')}</Badge>}
    </>
  );
}

const Row = memo(function Row({
  item,
  selected,
  checked,
  density,
  onSelect,
  onToggle,
}: {
  item: IncidentListItem;
  selected: boolean;
  checked: boolean;
  density: Density;
  onSelect: (reference: string) => void;
  onToggle: (reference: string, on: boolean) => void;
}) {
  const { t, relative, date } = useT();
  return (
    <li className="flex border-b border-line">
      <span className="flex w-9 shrink-0 items-start justify-center pt-3.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(on) => onToggle(item.reference, on)}
          aria-label={t('incidents.bulk.selectRow', { reference: item.reference })}
        />
      </span>
      <button
        type="button"
        data-reference={item.reference}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(item.reference)}
        className={cn(
          'relative flex min-w-0 flex-1 flex-col gap-1 pr-4 text-left transition-colors hover:bg-subtle',
          rowPadding[density],
          selected && 'bg-accent-subtle hover:bg-accent-subtle',
        )}
      >
        {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
        <span className="flex items-center gap-2.5">
          <PriorityIcon priority={item.priority} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.title}</span>
          <Tooltip content={date(item.createdAt, 'datetime')}>
            <time dateTime={item.createdAt} className="shrink-0 text-xs text-ink-3">
              {relative(item.createdAt)}
            </time>
          </Tooltip>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px] text-xs text-ink-3">
          <span className="tabular-nums">{item.reference}</span>
          <span className="truncate">{item.site.name}</span>
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon status={item.status} className="size-3.5" />
            {t(`common.status.${item.status}`)}
          </span>
          {item.assignee ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={item.assignee.name} size="xs" />
              {item.assignee.name}
            </span>
          ) : (
            item.status === 'NEW' && <span>{t('incidents.unassignedLabel')}</span>
          )}
          <FlagBadges item={item} />
        </span>
      </button>
    </li>
  );
});

export function IncidentList({
  items,
  selected,
  picked,
  density,
  onSelect,
  onToggle,
}: {
  items: IncidentListItem[];
  selected: string | undefined;
  picked: ReadonlySet<string>;
  density: Density;
  onSelect: (reference: string) => void;
  onToggle: (reference: string, on: boolean) => void;
}) {
  return (
    <ul>
      {items.map((item) => (
        <Row
          key={item.id}
          item={item}
          selected={item.reference === selected}
          checked={picked.has(item.reference)}
          density={density}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

export function ListSkeleton() {
  return (
    <div aria-busy="true">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
