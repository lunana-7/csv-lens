import Papa from 'papaparse';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 50_000;
export const PAGE_SIZE = 25;

export type Column = { name: string; numeric: boolean; missing: number };
export type Dataset = { columns: Column[]; rows: string[][]; warnings: string[] };
export type Operator = 'contains' | 'equals' | 'not-equals' | 'empty' | 'not-empty' | 'gt' | 'gte' | 'lt' | 'lte';
export type Filter = { id: number; column: number; operator: Operator; value: string };
export type Sort = { column: number; direction: 'asc' | 'desc' };
export type ChartPoint = { label: string; value: number };

export function numericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

export function parseCsv(text: string): Dataset {
  if (text.includes('\0')) throw new Error('This looks like a binary file. Choose a UTF-8 CSV text file.');
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
    preview: MAX_ROWS + 2,
    dynamicTyping: false,
  });
  const error = result.errors.find((item) => item.code !== 'UndetectableDelimiter');
  if (error) throw new Error(`Could not read this CSV: ${error.message}`);
  const [headers, ...rows] = result.data;
  if (!headers?.length || headers.every((header) => !header.trim())) {
    throw new Error('This file is empty. Add a header row and at least one data row.');
  }
  if (!rows.length) throw new Error('No data rows found. The first row is used as column headers.');
  if (rows.length > MAX_ROWS) throw new Error('This file has more than 50,000 rows. Split it into smaller files.');
  const invalidRow = rows.findIndex((row) => row.length !== headers.length);
  if (invalidRow >= 0) {
    throw new Error(`Data row ${invalidRow + 1} has ${rows[invalidRow].length} fields; expected ${headers.length}. Check delimiters and quotation marks.`);
  }
  const warnings: string[] = [];
  const used = new Set<string>();
  const reserved = new Set(headers.map((header) => header.trim()).filter(Boolean));
  const columns = headers.map((header, index) => {
    const original = header.trim();
    const base = original || `Column ${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name) || (name !== original && reserved.has(name))) {
      name = `${base} (${suffix++})`;
    }
    used.add(name);
    if (!header.trim() || name !== header.trim()) warnings.push(`Header ${index + 1} was named “${name}”.`);
    let missing = 0;
    let present = 0;
    let numeric = true;
    for (const row of rows) {
      if (!row[index].trim()) missing++;
      else {
        present++;
        if (numericValue(row[index]) === null) numeric = false;
      }
    }
    return { name, numeric: present > 0 && numeric, missing };
  });
  return { columns, rows, warnings };
}

export function matchesFilter(row: string[], filter: Filter): boolean {
  const value = row[filter.column] ?? '';
  const folded = value.toLocaleLowerCase();
  const expected = filter.value.toLocaleLowerCase();
  switch (filter.operator) {
    case 'contains': return folded.includes(expected);
    case 'equals': return folded === expected;
    case 'not-equals': return folded !== expected;
    case 'empty': return !value.trim();
    case 'not-empty': return !!value.trim();
    default: {
      const actual = numericValue(value);
      const target = numericValue(filter.value);
      if (actual === null || target === null) return false;
      switch (filter.operator) {
        case 'gt': return actual > target;
        case 'gte': return actual >= target;
        case 'lt': return actual < target;
        case 'lte': return actual <= target;
      }
    }
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function selectRows(dataset: Dataset, search: string, filters: Filter[], sort: Sort | null): string[][] {
  const query = search.toLocaleLowerCase().trim();
  const rows = dataset.rows.filter((row) =>
    (!query || row.some((cell) => cell.toLocaleLowerCase().includes(query))) &&
    filters.every((filter) => matchesFilter(row, filter)),
  );
  if (sort) {
    const { column, direction } = sort;
    const numeric = dataset.columns[column].numeric;
    rows.sort((a, b) => {
      const left = a[column];
      const right = b[column];
      if (!left.trim() && !right.trim()) return 0;
      if (!left.trim()) return 1;
      if (!right.trim()) return -1;
      const comparison = numeric ? numericValue(left)! - numericValue(right)! : collator.compare(left, right);
      return direction === 'asc' ? comparison : -comparison;
    });
  }
  return rows;
}

export function chartData(
  rows: string[][], labelColumn: number, valueColumn: number, type: 'bar' | 'line', measure: 'count' | 'sum',
): { points: ChartPoint[]; total: number; overflow: boolean } {
  if (type === 'line') {
    const points = rows.flatMap((row) => {
      const value = numericValue(row[valueColumn] ?? '');
      return value === null ? [] : [{ label: row[labelColumn] || '(empty)', value }];
    });
    return { points: points.slice(0, 200), total: points.length, overflow: false };
  }
  const groups = new Map<string, number>();
  for (const row of rows) {
    const label = row[labelColumn] || '(empty)';
    const value = measure === 'count' ? 1 : numericValue(row[valueColumn] ?? '');
    if (value === null) continue;
    groups.set(label, (groups.get(label) ?? 0) + value);
  }
  const points = [...groups].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  return { points: points.slice(0, 20), total: points.length, overflow: points.some((point) => !Number.isFinite(point.value)) };
}

function spreadsheetSafe(value: string): string {
  // CSV quoting does not stop spreadsheet formula execution.
  // eslint-disable-next-line no-control-regex -- leading control characters can hide a formula
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(value) && numericValue(value) === null) return `'${value}`;
  if (/^[\t\r]/.test(value)) return `'${value}`;
  return value;
}

export function exportCsv(columns: Column[], rows: string[][]): string {
  return Papa.unparse({
    fields: columns.map((column) => spreadsheetSafe(column.name)),
    data: rows.map((row) => row.map(spreadsheetSafe)),
  }, { newline: '\r\n' });
}

export function exportFilename(filename: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are invalid in file names
  return `${filename.replace(/\.csv$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'data'}-filtered.csv`;
}
