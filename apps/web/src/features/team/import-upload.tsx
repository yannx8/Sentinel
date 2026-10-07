import { ChevronRight, CircleAlert, Download, FileText, Upload, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Button, IconButton } from '../../components/ui/button';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { downloadCsv, importColumns, requiredColumns, templateCsv, type CsvFile, type ImportColumn } from './csv';
import { usePlural } from './plural';
import { useSites } from './queries';

function TemplateButton() {
  const { t } = useT();
  const sites = useSites();
  const download = () => {
    // A real site code shows the expected format; any code from the Sites page works.
    const siteCode = sites.data?.find((site) => site.isActive)?.code ?? 'HQ';
    const example: Record<ImportColumn, string> = {
      email: 'lea.moreau@example.com',
      first_name: t('team.import.example.firstName'),
      last_name: t('team.import.example.lastName'),
      employee_code: 'EMP-0042',
      job_title: t('team.import.example.jobTitle'),
      department: t('team.import.example.department'),
      home_site_code: siteCode,
    };
    downloadCsv(t('team.import.templateFile'), templateCsv(example));
  };
  return (
    <Button variant="link" icon={<Download className="size-4" aria-hidden />} onClick={download}>
      {t('team.import.template')}
    </Button>
  );
}

/** What each column holds, folded away until asked for. */
function ColumnGuide() {
  const { t } = useT();
  return (
    <details className="group rounded-md border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-medium text-ink select-none hover:bg-subtle [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-ink-3 transition-transform duration-150 group-open:rotate-90"
          aria-hidden
        />
        {t('team.import.columnsTitle')}
      </summary>
      <dl className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-line px-3.5 py-3 text-sm">
        {importColumns.map((column) => (
          <div key={column} className="contents">
            <dt className="font-mono text-xs leading-5 text-ink">{column}</dt>
            <dd className="text-ink-2">
              <span className={cn('font-medium', requiredColumns.includes(column) ? 'text-ink' : 'text-ink-3')}>
                {requiredColumns.includes(column) ? t('common.required') : t('common.optional')}.
              </span>{' '}
              {t(`team.import.columns.${column}`)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/**
 * Step 1: drop or choose a CSV file. The file is read and checked here, and
 * the API reviews every row on Continue.
 */
export function UploadStep({
  file,
  problem,
  reading,
  onPick,
  onRemove,
}: {
  file: CsvFile | null;
  problem: string | null;
  reading: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const tn = usePlural();
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);

  // The file row disappears with its button, so focus moves to the way to choose another file.
  const remove = () => {
    onRemove();
    window.requestAnimationFrame(() => chooseRef.current?.focus());
  };

  const pick = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) onPick(picked);
  };

  const onDrag = (event: DragEvent<HTMLDivElement>, over: boolean) => {
    event.preventDefault();
    if (over) setDragging(true);
    else if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };

  return (
    <div className="grid gap-4">
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-3">
          <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="text-xs text-ink-3 tabular-nums">{tn('team.import.fileRows', file.rows)}</p>
          </div>
          <IconButton label={t('team.import.removeFile')} size="sm" onClick={remove}>
            <X className="size-4" />
          </IconButton>
        </div>
      ) : (
        <div
          onDragEnter={(event) => onDrag(event, true)}
          onDragOver={(event) => onDrag(event, true)}
          onDragLeave={(event) => onDrag(event, false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-150',
            dragging ? 'border-accent bg-accent-subtle' : problem ? 'border-critical' : 'border-line-strong',
          )}
        >
          <Upload className="size-5 text-ink-3" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">{t('team.import.dropTitle')}</p>
            <p className="mt-0.5 text-xs text-ink-3">{t('team.import.dropHint')}</p>
          </div>
          <Button ref={chooseRef} size="sm" loading={reading} onClick={() => inputRef.current?.click()}>
            {t('team.import.choose')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            tabIndex={-1}
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      )}

      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-critical-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problem}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-ink-3">{t('team.import.limits')}</p>
        <TemplateButton />
      </div>
      <ColumnGuide />
    </div>
  );
}
