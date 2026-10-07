import { parseCsv, toCsv, type ImportRowResult } from '@sentinel/shared';

/** Same limits as the API: 2,000 employees per file and the schema's size cap. */
export const IMPORT_MAX_ROWS = 2000;
const MAX_CHARS = 2_000_000;

export const importColumns = [
  'email',
  'first_name',
  'last_name',
  'employee_code',
  'job_title',
  'department',
  'home_site_code',
] as const;
export type ImportColumn = (typeof importColumns)[number];
export const requiredColumns: readonly ImportColumn[] = ['email', 'first_name', 'last_name'];

export type CsvFile = { name: string; text: string; rows: number };

export type CsvProblem =
  | { kind: 'type' }
  | { kind: 'size' }
  | { kind: 'empty' }
  | { kind: 'noRows' }
  | { kind: 'tooMany'; rows: number }
  | { kind: 'columns'; missing: string[] };

/** Header cells read the way the API reads them: "First name" counts as first_name. */
function columnName(cell: string) {
  return cell
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Checks a file before anything is sent, with the same rules as the API, so the
 * common mistakes are explained at once. The API checks every row again.
 */
export async function readCsv(file: File): Promise<CsvFile | CsvProblem> {
  const looksCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (!looksCsv) return { kind: 'type' };
  if (file.size > MAX_CHARS * 2) return { kind: 'size' };
  const text = await file.text();
  if (text.length > MAX_CHARS) return { kind: 'size' };
  const [header, ...rows] = parseCsv(text);
  if (!header) return { kind: 'empty' };
  const present = new Set(header.map(columnName));
  const missing = requiredColumns.filter((column) => !present.has(column));
  if (missing.length > 0) return { kind: 'columns', missing };
  if (rows.length === 0) return { kind: 'noRows' };
  if (rows.length > IMPORT_MAX_ROWS) return { kind: 'tooMany', rows: rows.length };
  return { name: file.name, text, rows: rows.length };
}

export function isProblem(value: CsvFile | CsvProblem): value is CsvProblem {
  return 'kind' in value;
}

/** Saves text as a UTF-8 file. The byte order mark lets spreadsheet apps read accents correctly. */
export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function templateCsv(example: Record<ImportColumn, string>) {
  return toCsv(importColumns, [importColumns.map((column) => example[column])]);
}

/** One line per row with what happened to it, to fix the file and import again. */
export function reportCsv(
  header: readonly [line: string, email: string, status: string, messages: string],
  rows: ImportRowResult[],
  status: (row: ImportRowResult) => string,
) {
  return toCsv(
    header,
    rows.map((row) => [row.line, row.email, status(row), row.errors.join(' ')]),
  );
}
