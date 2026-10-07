import type { ImportResult, ImportRowResult } from '@sentinel/shared';
import { CircleCheck, Download } from 'lucide-react';
import { useState } from 'react';
import { Badge, type Tone } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Banner } from '../../components/ui/feedback';
import { Segmented } from '../../components/ui/segmented';
import { Table, Td, Th, THead, Tr } from '../../components/ui/table';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { downloadCsv, reportCsv } from './csv';
import { NotSet } from './parts';
import { usePlural } from './plural';

type RowStatus = ImportRowResult['status'];
type Filter = 'ALL' | 'ERROR' | 'SKIPPED' | 'READY';

const statusTones: Record<RowStatus, Tone> = {
  READY: 'success',
  CREATED: 'success',
  SKIPPED: 'neutral',
  ERROR: 'critical',
};

/** Rendered at once in the review table; the downloadable report always has every row. */
const ROW_CAP = 300;

function RowStatusBadge({ status }: { status: RowStatus }) {
  const { t } = useT();
  return <Badge tone={statusTones[status]}>{t(`team.import.status.${status}`)}</Badge>;
}

function useDownloadReport() {
  const { t } = useT();
  return (rows: ImportRowResult[]) =>
    downloadCsv(
      t('team.import.reportFile'),
      reportCsv(
        [
          t('team.import.reportColumns.line'),
          t('team.import.reportColumns.email'),
          t('team.import.reportColumns.status'),
          t('team.import.reportColumns.messages'),
        ],
        rows,
        (row) => t(`team.import.status.${row.status}`),
      ),
    );
}

function ReportButton({ rows }: { rows: ImportRowResult[] }) {
  const { t } = useT();
  const download = useDownloadReport();
  return (
    <Button variant="link" icon={<Download className="size-4" aria-hidden />} onClick={() => download(rows)}>
      {t('team.import.report')}
    </Button>
  );
}

function RowsTable({ rows }: { rows: ImportRowResult[] }) {
  const { t, number } = useT();
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-line px-4 py-6 text-center text-sm text-ink-3">
        {t('team.import.noRows')}
      </p>
    );
  }
  const shown = rows.slice(0, ROW_CAP);
  return (
    <div className="grid gap-2">
      <Table className="max-h-72 overflow-y-auto rounded-md border border-line">
        <caption className="sr-only">{t('team.import.rowsCaption')}</caption>
        <THead>
          <tr>
            <Th className="w-14">{t('team.import.reportColumns.line')}</Th>
            <Th>{t('team.import.reportColumns.email')}</Th>
            <Th>{t('team.import.reportColumns.status')}</Th>
            <Th>{t('team.import.reportColumns.messages')}</Th>
          </tr>
        </THead>
        <tbody>
          {shown.map((row) => (
            <Tr key={row.line}>
              <Td className="text-ink-3 tabular-nums">{row.line}</Td>
              <Td>{row.email ? <span className="block max-w-56 truncate">{row.email}</span> : <NotSet />}</Td>
              <Td>
                <RowStatusBadge status={row.status} />
              </Td>
              <Td className="min-w-56 py-2 text-ink-2">
                {row.errors.length > 0 ? row.errors.map((error, index) => <p key={index}>{error}</p>) : <NotSet />}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {rows.length > shown.length && (
        <p className="text-xs text-ink-3">
          {t('team.import.capped', { shown: number(shown.length), total: number(rows.length) })}
        </p>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'critical' }) {
  const { number } = useT();
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-xl font-semibold tabular-nums',
          tone === 'critical' && value > 0 ? 'text-critical-ink' : 'text-ink',
        )}
      >
        {number(value)}
      </dd>
    </div>
  );
}

function initialFilter(result: ImportResult): Filter {
  if (result.failed > 0) return 'ERROR';
  if (result.skipped > 0) return 'SKIPPED';
  return 'ALL';
}

/** Step 2: what the dry run found, row by row. Nothing is sent yet. */
export function ReviewStep({ result }: { result: ImportResult }) {
  const { t, number } = useT();
  const [filter, setFilter] = useState<Filter>(() => initialFilter(result));
  const rows = filter === 'ALL' ? result.rows : result.rows.filter((row) => row.status === filter);
  const label = (key: 'all' | 'errors' | 'skipped' | 'ready', count: number) =>
    `${t(`team.import.filter.${key}`)} ${number(count)}`;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-3 divide-x divide-line rounded-md border border-line">
        <Figure label={t('team.import.figures.ready')} value={result.ready} />
        <Figure label={t('team.import.figures.skipped')} value={result.skipped} />
        <Figure label={t('team.import.figures.errors')} value={result.failed} tone="critical" />
      </dl>
      {result.ready === 0 ? (
        <Banner tone="warning">{t('team.import.nothingReady')}</Banner>
      ) : (
        result.skipped + result.failed > 0 && <p className="text-sm text-ink-2">{t('team.import.partial')}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-m-1 max-w-[calc(100%+8px)] overflow-x-auto p-1 [scrollbar-width:none]">
          <Segmented<Filter>
            label={t('team.import.filter.label')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: label('all', result.total) },
              { value: 'ERROR', label: label('errors', result.failed) },
              { value: 'SKIPPED', label: label('skipped', result.skipped) },
              { value: 'READY', label: label('ready', result.ready) },
            ]}
          />
        </div>
        {result.skipped + result.failed > 0 && <ReportButton rows={result.rows} />}
      </div>
      <RowsTable rows={rows} />
    </div>
  );
}

/** Step 3: what was sent, and the rows left out. */
export function DoneStep({ result }: { result: ImportResult }) {
  const { t } = useT();
  const tn = usePlural();
  const notSent = result.rows.filter((row) => row.status === 'CREATED' && row.errors.length > 0).length;
  const leftOut = result.rows.filter((row) => row.status === 'SKIPPED' || row.status === 'ERROR');

  return (
    <div className="grid gap-4">
      {result.created > 0 ? (
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-base font-semibold text-ink">{tn('team.import.doneTitle', result.created)}</p>
            <p className="mt-1 text-sm text-ink-2">{t('team.import.doneBody')}</p>
          </div>
        </div>
      ) : (
        <Banner tone="warning" title={t('team.import.noneSentTitle')}>
          {t('team.import.noneSentBody')}
        </Banner>
      )}
      {notSent > 0 && <Banner tone="warning">{tn('team.import.notSent', notSent)}</Banner>}
      {leftOut.length > 0 && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-2">{tn('team.import.leftOut', leftOut.length)}</p>
            <ReportButton rows={result.rows} />
          </div>
          <RowsTable rows={leftOut} />
        </div>
      )}
    </div>
  );
}
