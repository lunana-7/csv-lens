import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import Papa from 'papaparse';

const fixture = ['Name,Region,Revenue,Note,Code', ...Array.from({ length: 60 }, (_, i) =>
  `Item ${i + 1},${i % 2 ? 'South' : 'North'},${i + 1},${i % 4 ? 'ready' : ''},${String(i + 1).padStart(3, '0')}`,
)].join('\n');

async function upload(page: Page, text: string, name = 'test-sales.csv') {
  await page.getByLabel('Choose CSV file', { exact: true }).setInputFiles({
    name, mimeType: 'text/csv', buffer: Buffer.from(text),
  });
}
async function loaded(page: Page, name = 'test-sales.csv') {
  await expect(page.locator('.file-details strong')).toHaveText(name);
  await expect(page.getByRole('heading', { name: 'The bigger picture' })).toBeVisible();
}
async function downloadedRows(page: Page) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/ }).click();
  const download = await event;
  const path = await download.path();
  const csv = await readFile(path!, 'utf8');
  return { download, rows: Papa.parse<string[]>(csv.replace(/^\uFEFF/, '')).data };
}

test('sample workspace, charts, pagination and screenshots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('artifacts', { recursive: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your data/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/desktop-empty.png', fullPage: true });
  await page.getByRole('button', { name: 'Explore sample data' }).click();
  await loaded(page, 'little-goods-sales.csv');
  await expect(page.locator('.stat-value').nth(0)).toHaveText('72');
  await expect(page.locator('tbody tr')).toHaveCount(25);
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(20);
  await page.getByLabel('Chart label column').selectOption('1');
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(3);
  await page.getByLabel('Chart measure').selectOption('sum');
  await page.getByLabel('Chart value column').selectOption('5');
  await expect(page.locator('.chart-subheading')).toContainText('Total Revenue by Channel');
  await page.screenshot({ path: 'artifacts/desktop-workspace.png', fullPage: true });
  await page.getByRole('button', { name: 'Line', exact: true }).click();
  await expect(page.locator('.recharts-line-curve')).toHaveCount(1);
  await expect(page.locator('.chart-footnote')).toContainText('72 of 72 numeric rows');
  await page.getByRole('button', { name: 'Collapse chart' }).click();
  await expect(page.locator('.chart-body')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand chart' }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.table-footer')).toContainText('Showing 26–50 of 72');
  const { rows } = await downloadedRows(page);
  expect(rows).toHaveLength(73);
  expect(errors).toEqual([]);
});

test('upload, search, combined filters, numeric sorting, charts and filtered export', async ({ page }) => {
  await page.goto('/');
  await upload(page, fixture);
  await loaded(page);
  await page.getByLabel('Search all columns').fill('item 12');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: /Add filter/ }).click();
  await page.getByLabel('Filter 1 column').selectOption('1');
  await page.getByLabel('Filter 1 operator').selectOption('equals');
  await page.getByLabel('Filter 1 value').fill('north');
  await expect(page.locator('.stat-value').nth(1)).toHaveText('30');
  await page.getByRole('button', { name: /Add filter/ }).click();
  await page.getByLabel('Filter 2 column').selectOption('2');
  await page.getByLabel('Filter 2 operator').selectOption('gte');
  await page.getByLabel('Filter 2 value').fill('40');
  await expect(page.locator('.stat-value').nth(1)).toHaveText('10');
  await page.getByRole('button', { name: 'Sort by Revenue', exact: true }).click();
  await expect(page.locator('tbody tr').first().locator('td').nth(3)).toHaveText('41');
  await page.getByRole('button', { name: 'Sort by Revenue', exact: true }).click();
  await expect(page.locator('tbody tr').first().locator('td').nth(3)).toHaveText('59');
  await page.getByLabel('Chart label column').selectOption('1');
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(1);
  const { download, rows } = await downloadedRows(page);
  expect(download.suggestedFilename()).toBe('test-sales-filtered.csv');
  expect(rows).toHaveLength(11);
  expect(rows.slice(1).every((row) => row[1] === 'North' && Number(row[2]) >= 40)).toBe(true);
  expect(rows[1][2]).toBe('59');
  expect(rows[1][4]).toBe('059');
  await page.getByRole('button', { name: 'Remove filter 2' }).click();
  await expect(page.locator('.stat-value').nth(1)).toHaveText('30');
  await page.getByRole('button', { name: 'Reset all' }).click();
  await expect(page.locator('.stat-value').nth(1)).toHaveText('60');
});

test('empty results, blank-cell filters, reset and file replacement', async ({ page }) => {
  await page.goto('/');
  await upload(page, fixture);
  await loaded(page);
  await page.getByRole('button', { name: /Add filter/ }).click();
  await page.getByLabel('Filter 1 column').selectOption('3');
  await page.getByLabel('Filter 1 operator').selectOption('empty');
  await expect(page.locator('.stat-value').nth(1)).toHaveText('15');
  await page.getByLabel('Search all columns').fill('does-not-exist');
  await expect(page.getByRole('heading', { name: /No rows found/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export CSV/ })).toBeDisabled();
  await expect(page.locator('.chart-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search & filters' }).click();
  await expect(page.locator('.stat-value').nth(1)).toHaveText('60');
  await upload(page, 'City,Country\nTokyo,Japan\nParis,France', 'places.csv');
  await loaded(page, 'places.csv');
  await expect(page.locator('.stat-value').nth(0)).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Line', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Search all columns')).toHaveValue('');
  await page.getByRole('button', { name: 'Clear dataset' }).click();
  await expect(page.getByRole('button', { name: 'Explore sample data' })).toBeVisible();
});

test('clear errors for invalid, malformed, empty, oversized and over-limit files', async ({ page }) => {
  await page.goto('/');
  await upload(page, '', 'empty.csv');
  await expect(page.getByRole('alert')).toContainText('empty');
  await upload(page, 'Name,Value', 'headers.csv');
  await expect(page.getByRole('alert')).toContainText('No data rows');
  await upload(page, 'Name,Value\n"broken,2', 'broken.csv');
  await expect(page.getByRole('alert')).toContainText('Could not read');
  await upload(page, 'Name,Value\nA,1,extra', 'mismatched.csv');
  await expect(page.getByRole('alert')).toContainText('expected 2');
  await upload(page, 'A\n1', 'not-a-csv.txt');
  await expect(page.getByRole('alert')).toContainText('.csv file');
  await page.getByLabel('Choose CSV file', { exact: true }).setInputFiles({ name: 'big.csv', mimeType: 'text/csv', buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 'x') });
  await expect(page.getByRole('alert')).toContainText('larger than 10 MB');
  await upload(page, 'A\n' + Array.from({ length: 50_001 }, (_, i) => i).join('\n'), 'too-many.csv');
  await expect(page.getByRole('alert')).toContainText('more than 50,000');
  await upload(page, fixture);
  await loaded(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await upload(page, 'A,B\n1,2,3', 'bad-replacement.csv');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.file-details strong')).toHaveText('test-sales.csv');
  await expect(page.locator('.stat-value').nth(0)).toHaveText('60');
});

test('no external requests or persistence, refresh clears data, loaded app works offline', async ({ page, context }) => {
  const external: string[] = [];
  const writes: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== 'http://127.0.0.1:4178') external.push(request.url());
    if (request.method() !== 'GET') writes.push(request.method());
  });
  await page.goto('/');
  await upload(page, fixture);
  await loaded(page);
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage),
    databases: await indexedDB.databases(), serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  expect(storage).toEqual({ local: [], session: [], databases: [], serviceWorkers: 0 });
  await context.setOffline(true);
  await page.getByLabel('Search all columns').fill('item 12');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const { rows } = await downloadedRows(page);
  expect(rows).toHaveLength(2);
  await page.getByRole('button', { name: 'Line', exact: true }).click();
  // One filtered row is a point, not a connecting line.
  await expect(page.locator('.recharts-line-dot')).toHaveCount(1);
  await expect(page.locator('.chart-footnote')).toContainText('1 of 1 numeric rows');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Explore sample data' })).toBeVisible();
  expect(external).toEqual([]);
  expect(writes).toEqual([]);
});

test('mobile layout supports upload, charting, filters and export without page overflow', async ({ page }) => {
  await mkdir('artifacts', { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/mobile-empty.png', fullPage: true });
  await upload(page, fixture);
  await loaded(page);
  await page.getByRole('button', { name: /Add filter/ }).click();
  await page.getByLabel('Filter 1 column').selectOption('1');
  await page.getByLabel('Filter 1 value').fill('north');
  await expect(page.locator('.stat-value').nth(1)).toHaveText('30');
  await page.getByLabel('Chart label column').selectOption('1');
  await expect(page.locator('.recharts-bar-rectangle')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile-workspace.png', fullPage: true });
  const { rows } = await downloadedRows(page);
  expect(rows).toHaveLength(31);
});

test('drag-and-drop imports a file and rejects multiple files', async ({ page }) => {
  await page.goto('/');
  await page.locator('.upload-zone').evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['Name,Value\nDropped,12'], 'dropped.csv', { type: 'text/csv' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await loaded(page, 'dropped.csv');
  await expect(page.locator('tbody')).toContainText('Dropped');
  await page.getByRole('button', { name: 'Clear dataset' }).click();
  await page.locator('.upload-zone').evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['A\n1'], 'first.csv'));
    transfer.items.add(new File(['A\n2'], 'second.csv'));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.getByRole('alert')).toContainText('one CSV file');
});

test('untrusted text renders as text and exported formulas are neutralized', async ({ page }) => {
  await page.goto('/');
  const payload = Papa.unparse([
    ['Name', 'Note', 'Amount'],
    ['<img src=x onerror=alert(1)>', '=HYPERLINK("https://example.com")', '-12.5'],
    ['Chloé, 東京', 'A "quoted"\nmultiline note', '001'],
  ]);
  await upload(page, payload);
  await loaded(page);
  await expect(page.locator('tbody img')).toHaveCount(0);
  await expect(page.locator('tbody')).toContainText('<img src=x onerror=alert(1)>');
  const { rows } = await downloadedRows(page);
  expect(rows[1][1]).toBe('\'=HYPERLINK("https://example.com")');
  expect(rows[1][2]).toBe('-12.5');
  expect(rows[2]).toEqual(['Chloé, 東京', 'A "quoted"\nmultiline note', '001']);
});

test('50,000-row file can be searched, sorted and exported', async ({ page }) => {
  await page.goto('/');
  const large = 'Name,Value\n' + Array.from({ length: 50_000 }, (_, i) => `row-${i},${i}`).join('\n');
  await upload(page, large, 'large.csv');
  await loaded(page, 'large.csv');
  await expect(page.locator('.stat-value').nth(0)).toHaveText('50,000');
  await page.getByRole('button', { name: 'Sort by Value', exact: true }).click();
  await page.getByRole('button', { name: 'Sort by Value', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('49999');
  await page.getByLabel('Search all columns').fill('row-49999');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const { rows } = await downloadedRows(page);
  expect(rows).toEqual([['Name', 'Value'], ['row-49999', '49999']]);
});
