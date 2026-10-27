import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { chartData, exportCsv, exportFilename, matchesFilter, MAX_ROWS, numericValue, parseCsv, selectRows, type Filter } from './data';
import { SAMPLE_CSV } from './sample';

describe('CSV parsing', () => {
  it('preserves strings, leading zeros, whitespace, Unicode and large integers', () => {
    const data = parseCsv('\uFEFFName,Code,Amount\r\n" Chloé ",001,9007199254740993\r\n東京,002,12');
    expect(data.rows[0]).toEqual([' Chloé ', '001', '9007199254740993']);
    expect(data.rows[1][0]).toBe('東京');
    expect(data.columns.map((column) => column.numeric)).toEqual([false, true, true]);
  });
  it('handles quoted commas, quotes and multiline fields', () => {
    expect(parseCsv('Name,Note\n"Smith, Jo","Said ""hello""\nand left"').rows).toEqual([['Smith, Jo', 'Said "hello"\nand left']]);
  });
  it.each([';', '\t'])('detects %j delimiters', (delimiter) => {
    expect(parseCsv(`Name${delimiter}Value\nA${delimiter}1\nB${delimiter}2`).rows).toEqual([['A', '1'], ['B', '2']]);
  });
  it('accepts a single-column CSV and skips blank lines', () => {
    expect(parseCsv('Name\n\nAlice\nBob\n').rows).toEqual([['Alice'], ['Bob']]);
  });
  it('gives duplicate and blank headers unique names without stealing later names', () => {
    const data = parseCsv('A,A,A (2),,Column 4,__proto__\n1,2,3,4,5,6');
    expect(data.columns.map((column) => column.name)).toEqual(['A', 'A (3)', 'A (2)', 'Column 4 (2)', 'Column 4', '__proto__']);
    expect(data.warnings).toHaveLength(2);
  });
  it('counts blank cells and does not classify all-empty or mixed columns as numeric', () => {
    const data = parseCsv('Name,Value,Empty,Mixed\nA,3,,2\nB, ,,oops\nC,-1,,3');
    expect(data.columns.map((column) => [column.numeric, column.missing])).toEqual([[false, 0], [true, 1], [false, 3], [false, 0]]);
  });
  it.each(['', ' \n\n', ',,\n,,'])('rejects empty data %j', (text) => {
    expect(() => parseCsv(text)).toThrow(/empty/i);
  });
  it('rejects a header-only file', () => { expect(() => parseCsv('A,B')).toThrow(/No data rows/); });
  it('rejects malformed quoted fields', () => { expect(() => parseCsv('A,B\n"unclosed,2')).toThrow(/Could not read/); });
  it.each(['A,B\n1,2,3', 'A,B\n1'])('rejects inconsistent field counts %j', (text) => {
    expect(() => parseCsv(text)).toThrow(/Data row 1/);
  });
  it('rejects binary content', () => { expect(() => parseCsv('A\n\0')).toThrow(/binary/); });
  it('accepts exactly the row limit and rejects one more', () => {
    const text = 'A\n' + Array.from({ length: MAX_ROWS }, (_, i) => String(i)).join('\n');
    expect(parseCsv(text).rows).toHaveLength(MAX_ROWS);
    expect(() => parseCsv(text + '\nextra')).toThrow(/50,000/);
  });
});

describe('numeric conversion', () => {
  it.each([['0', 0], [' -2.5 ', -2.5], ['.5', .5], ['1e3', 1000], ['001', 1]])('converts %s', (value, expected) => {
    expect(numericValue(value)).toBe(expected);
  });
  it.each(['', ' ', '0x10', 'Infinity', 'NaN', '1,000', '$5', '1e309', '12abc'])('rejects %j', (value) => {
    expect(numericValue(value)).toBeNull();
  });
});

describe('search, filters and sorting', () => {
  const data = parseCsv('Name,Region,Amount\nAlice,North,10\nBob,South,2\nCAROL,North,30\nDee,West,');
  const filter = (column: number, operator: Filter['operator'], value = ''): Filter => ({ id: 1, column, operator, value });
  it('searches all columns without case sensitivity', () => {
    expect(selectRows(data, '  north ', [], null).map((row) => row[0])).toEqual(['Alice', 'CAROL']);
    expect(selectRows(data, 'bob', [], null)).toHaveLength(1);
  });
  it('combines search and multiple filters with AND', () => {
    expect(selectRows(data, 'north', [filter(2, 'gte', '20'), filter(0, 'contains', 'car')], null).map((row) => row[0])).toEqual(['CAROL']);
  });
  it.each([
    ['contains', 'LIC', 'Alice', true], ['equals', 'alice', 'Alice', true],
    ['not-equals', 'alice', 'Alice', false], ['empty', '', '  ', true],
    ['not-empty', '', '0', true], ['gt', '2', '3', true],
    ['gte', '2', '2', true], ['lt', '2', '1', true], ['lte', '2', '2', true],
    ['gt', '', '3', false], ['lt', '2', '', false],
  ] as const)('%s matches expected behavior', (operator, value, actual, expected) => {
    expect(matchesFilter([actual], filter(0, operator, value))).toBe(expected);
  });
  it('sorts numeric columns numerically and keeps empty cells last in both directions', () => {
    expect(selectRows(data, '', [], { column: 2, direction: 'asc' }).map((row) => row[2])).toEqual(['2', '10', '30', '']);
    expect(selectRows(data, '', [], { column: 2, direction: 'desc' }).map((row) => row[2])).toEqual(['30', '10', '2', '']);
    expect(data.rows[0][0]).toBe('Alice');
  });
  it('sorts text columns', () => {
    expect(selectRows(data, '', [], { column: 0, direction: 'asc' }).map((row) => row[0])).toEqual(['Alice', 'Bob', 'CAROL', 'Dee']);
  });
  it('returns zero results when nothing matches', () => { expect(selectRows(data, 'nobody', [], null)).toEqual([]); });
});

describe('charts', () => {
  const rows = [['A', '10'], ['B', '2'], ['A', '20'], ['B', ''], ['C', '-3']];
  it('counts categories', () => { expect(chartData(rows, 0, 1, 'bar', 'count').points).toEqual([{ label: 'A', value: 2 }, { label: 'B', value: 2 }, { label: 'C', value: 1 }]); });
  it('sums numeric values and skips empty cells', () => { expect(chartData(rows, 0, 1, 'bar', 'sum').points).toEqual([{ label: 'A', value: 30 }, { label: 'B', value: 2 }, { label: 'C', value: -3 }]); });
  it('keeps row order for lines and skips blank values', () => { expect(chartData(rows, 0, 1, 'line', 'sum').points.map((point) => point.value)).toEqual([10, 2, 20, -3]); });
  it('caps charts without altering the source rows', () => {
    const many = Array.from({ length: 250 }, (_, i) => [String(i), String(i)]);
    const line = chartData(many, 0, 1, 'line', 'sum');
    const bar = chartData(many, 0, 1, 'bar', 'count');
    expect(line.total).toBe(250);
    expect(line.points).toHaveLength(200);
    expect(bar.total).toBe(250);
    expect(bar.points).toHaveLength(20);
    expect(many).toHaveLength(250);
  });
  it('handles prototype-like category names safely', () => {
    expect(chartData([['__proto__', '1']], 0, 1, 'bar', 'count').points).toEqual([{ label: '__proto__', value: 1 }]);
  });
  it('flags overflowing totals', () => { expect(chartData([['A', '1e308'], ['A', '1e308']], 0, 1, 'bar', 'sum').overflow).toBe(true); });
});

describe('CSV export', () => {
  it('exports all filtered rows in sort order, independent of pagination', () => {
    const data = parseCsv(SAMPLE_CSV);
    const rows = selectRows(data, '', [], { column: 5, direction: 'desc' });
    const exported = Papa.parse<string[]>(exportCsv(data.columns, rows));
    expect(exported.data).toHaveLength(73);
    expect(exported.data[1][5]).toBe(rows[0][5]);
  });
  it('round-trips quoting, Unicode and multiline fields', () => {
    const data = parseCsv('Name,Note\nChloé,"Hello, ""world""\nagain"');
    expect(parseCsv(exportCsv(data.columns, data.rows)).rows).toEqual(data.rows);
  });
  it('neutralizes formulas, including dangerous headers, without altering safe numbers', () => {
    const values = ['=2+2', '+SUM(A1:A2)', '-1+2', '@SUM(1)', '  =1+1', '\tformula', '-12.5', '001'];
    const output = Papa.parse<string[]>(exportCsv([{ name: '=bad', numeric: false, missing: 0 }], values.map((value) => [value]))).data;
    expect(output[0][0]).toBe("'=bad");
    expect(output.slice(1, 7).every((row) => row[0].startsWith("'"))).toBe(true);
    expect(output.slice(7).map((row) => row[0])).toEqual(['-12.5', '001']);
  });
  it('creates a safe export filename', () => { expect(exportFilename('file.CSV')).toBe('file-filtered.csv'); expect(exportFilename('../a.csv')).toBe('.._a-filtered.csv'); });
});
