import type { AuditEntryDTO } from '@sentinel/shared';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { IconButton } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { useAuditSummary } from './summary';

const COLUMNS = 6;

function Actor({ actor }: { actor: AuditEntryDTO['actor'] }) {
  const { t } = useT();
  if (!actor) return <span className="text-ink-3">{t('audit.system')}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={actor.name} size="xs" />
      <span className="truncate">{actor.name}</span>
    </span>
  );
}

function EntryRow({ entry, summary }: { entry: AuditEntryDTO; summary: string }) {
  const { t, date } = useT();
  const [open, setOpen] = useState(false);
  const panelId = `audit-payload-${entry.id}`;
  const toggle = () => setOpen((value) => !value);

  return (
    <Fragment>
      <Tr interactive onClick={toggle} className={cn(open && 'bg-subtle [&>td]:border-b-0')}>
        <Td className="whitespace-nowrap text-ink-2 tabular-nums">
          <time dateTime={entry.createdAt}>{date(entry.createdAt, 'datetime')}</time>
        </Td>
        <Td className="hidden max-w-48 md:table-cell">
          <Actor actor={entry.actor} />
        </Td>
        <Td className="max-w-72 min-w-44">
          <span className="block font-medium text-ink">{t(`audit.types.${entry.type}`)}</span>
          {summary && <span className="block truncate text-xs text-ink-3 lg:hidden">{summary}</span>}
        </Td>
        <Td className="whitespace-nowrap">
          {entry.incident ? (
            <Link
              to="/app/incidents"
              search={{ incident: entry.incident.reference }}
              onClick={(event) => event.stopPropagation()}
              className="text-accent tabular-nums hover:underline hover:underline-offset-2"
            >
              {entry.incident.reference}
            </Link>
          ) : (
            <span className="text-ink-3">-</span>
          )}
        </Td>
        <Td className="hidden max-w-0 w-full text-ink-2 lg:table-cell">
          <span className="block truncate" title={summary || undefined}>
            {summary || <span className="text-ink-3">-</span>}
          </span>
        </Td>
        <Td className="w-10 pr-2">
          <IconButton
            label={open ? t('audit.hidePayload') : t('audit.showPayload')}
            size="sm"
            tooltip={false}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
          >
            <ChevronRight className={cn('size-4 transition-transform duration-150', open && 'rotate-90')} aria-hidden />
          </IconButton>
        </Td>
      </Tr>
      {open && (
        <tr className="bg-subtle [&>td]:border-b [&>td]:border-line">
          <td id={panelId} colSpan={COLUMNS} className="px-4 pt-0 pb-4">
            <div className="grid gap-2 md:hidden">
              <Actor actor={entry.actor} />
            </div>
            {summary && <p className="mt-2 text-sm text-ink-2 lg:hidden">{summary}</p>}
            <p className="mt-2 text-xs font-medium text-ink-3">{t('audit.payloadLabel')}</p>
            <pre className="mt-1.5 max-h-80 overflow-auto rounded-sm border border-line bg-surface p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words text-ink-2">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function SkeletonRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <Tr key={index}>
          <Td>
            <Skeleton className="h-3.5 w-32" />
          </Td>
          <Td className="hidden md:table-cell">
            <span className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
            </span>
          </Td>
          <Td>
            <Skeleton className="h-3.5 w-32" />
          </Td>
          <Td>
            <Skeleton className="h-3.5 w-24" />
          </Td>
          <Td className="hidden lg:table-cell">
            <Skeleton className="h-3.5 w-56" />
          </Td>
          <Td className="w-10" />
        </Tr>
      ))}
    </>
  );
}

export function AuditTable({ entries, loading }: { entries: AuditEntryDTO[]; loading?: boolean }) {
  const { t } = useT();
  const summarize = useAuditSummary();
  return (
    <Table>
      <caption className="sr-only">{t('audit.title')}</caption>
      <THead>
        <tr>
          <Th>{t('audit.columns.time')}</Th>
          <Th className="hidden md:table-cell">{t('audit.columns.actor')}</Th>
          <Th>{t('audit.columns.event')}</Th>
          <Th>{t('audit.columns.incident')}</Th>
          <Th className="hidden lg:table-cell">{t('audit.columns.details')}</Th>
          <Th className="w-10">
            <span className="sr-only">{t('audit.columns.expand')}</span>
          </Th>
        </tr>
      </THead>
      <tbody>
        {loading ? (
          <SkeletonRows rows={10} />
        ) : (
          entries.map((entry) => <EntryRow key={entry.id} entry={entry} summary={summarize(entry)} />)
        )}
      </tbody>
    </Table>
  );
}
