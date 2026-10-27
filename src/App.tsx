import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownToLine, ArrowRight, ArrowUp, ArrowUpDown, BarChart3, Check,
  ChevronLeft, ChevronRight, CircleHelp, Columns3, Database, FileSpreadsheet,
  Filter as FilterIcon, Hash, Leaf, LockKeyhole, Plus, Search, ShieldCheck,
  Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import {
  exportCsv, exportFilename, MAX_FILE_BYTES, numericValue, PAGE_SIZE, parseCsv,
  selectRows, type Dataset, type Filter, type Operator, type Sort,
} from './data';
import { SAMPLE_CSV } from './sample';

const Charts = lazy(() => import('./Charts'));

const operators: { value: Operator; label: string; numeric?: boolean }[] = [
  { value: 'contains', label: 'contains' }, { value: 'equals', label: 'equals' },
  { value: 'not-equals', label: 'does not equal' }, { value: 'empty', label: 'is empty' },
  { value: 'not-empty', label: 'is not empty' }, { value: 'gt', label: 'greater than', numeric: true },
  { value: 'gte', label: 'at least', numeric: true }, { value: 'lt', label: 'less than', numeric: true },
  { value: 'lte', label: 'at most', numeric: true },
];
const count = (value: number) => value.toLocaleString();

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [filename, setFilename] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [datasetId, setDatasetId] = useState(0);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const nextFilterId = useRef(0);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);
  const selected = useMemo(() => dataset ? selectRows(dataset, query, filters, sort) : [], [dataset, query, filters, sort]);
  const totalPages = Math.max(1, Math.ceil(selected.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleRows = selected.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const numericCount = dataset?.columns.filter((column) => column.numeric).length ?? 0;
  const missingCount = dataset?.columns.reduce((sum, column) => sum + column.missing, 0) ?? 0;
  const active = !!query || filters.length > 0;

  function installDataset(next: Dataset, name: string, size: string) {
    setDataset(next);
    setFilename(name);
    setFileSize(size);
    setDatasetId((id) => id + 1);
    setQuery('');
    setFilters([]);
    setSort(null);
    setPage(0);
    setError('');
    setNotice(`Loaded ${name}: ${count(next.rows.length)} rows, ${count(next.columns.length)} columns.`);
  }

  async function loadFile(file: File) {
    if (!/\.csv$/i.test(file.name)) { setError('Please choose a .csv file. Other file formats are not supported.'); return; }
    if (file.size > MAX_FILE_BYTES) { setError('This file is larger than 10 MB. Choose a smaller CSV.'); return; }
    if (!file.size) { setError('This file is empty. Choose a CSV with headers and data rows.'); return; }
    const id = ++requestId.current;
    workerRef.current?.terminate();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const text = await file.text();
      if (id !== requestId.current) return;
      const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ dataset?: Dataset; error?: string }>) => {
        if (id !== requestId.current) return;
        worker.terminate();
        workerRef.current = null;
        setBusy(false);
        if (event.data.dataset) installDataset(event.data.dataset, file.name, file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`);
        else setError(event.data.error ?? 'Could not read this CSV.');
      };
      worker.onerror = () => {
        if (id !== requestId.current) return;
        worker.terminate();
        workerRef.current = null;
        setBusy(false);
        setError('Could not process this CSV in your browser. Try a smaller file or reload the app.');
      };
      worker.postMessage(text);
    } catch {
      if (id === requestId.current) { setBusy(false); setError('This file could not be read. Please choose it again.'); }
    }
  }

  function loadSample() {
    ++requestId.current;
    workerRef.current?.terminate();
    setBusy(false);
    installDataset(parseCsv(SAMPLE_CSV), 'little-goods-sales.csv', 'Sample dataset');
  }

  function clearDataset() {
    ++requestId.current;
    workerRef.current?.terminate();
    workerRef.current = null;
    setDataset(null);
    setBusy(false);
    setQuery('');
    setFilters([]);
    setSort(null);
    setError('');
    setNotice('Dataset cleared from this workspace.');
    setPage(0);
    if (fileInput.current) fileInput.current.value = '';
  }

  function resetFilters() { setQuery(''); setFilters([]); setPage(0); }
  function updateFilter(id: number, change: Partial<Filter>) {
    setFilters((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));
    setPage(0);
  }
  function download() {
    if (!dataset || !selected.length) return;
    const blob = new Blob(['\uFEFF', exportCsv(dataset.columns, selected)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename(filename);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice(`Exported ${count(selected.length)} rows. Formula-like text is escaped for spreadsheet safety.`);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to workspace</a>
      <header className="topbar">
        <a className="brand" href="./" aria-label="CSV Lens home"><span className="brand-mark"><BarChart3 size={23} strokeWidth={2.5} /></span><span>csv<span className="brand-light">lens</span><span className="brand-period">.</span></span></a>
        <span className="topbar-divider" /><span className="topbar-caption">Small tool. Clearer thinking.</span>
        <div className="topbar-right"><span className="privacy-pill"><span className="live-dot" />100% in your browser</span><button className="icon-button help-button" aria-label={help ? 'Close help' : 'About privacy and CSV support'} aria-expanded={help} onClick={() => setHelp(!help)}><CircleHelp size={19} /></button></div>
      </header>
      <main id="main">
        {help && <aside className="help-panel panel"><div className="help-heading"><h2>A small, private workspace</h2><button className="icon-button" aria-label="Close privacy help" onClick={() => setHelp(false)}><X size={17} /></button></div><p>Files are processed in your browser, never uploaded or saved to browser storage. Refreshing or closing this page clears your dataset. A local web server serves the app files, not your CSV.</p><p>Use UTF-8 CSVs with a header row, up to 10 MB and 50,000 data rows. Commas, tabs, and semicolons are detected automatically. Decimal and scientific notation are numeric; currencies and formatted thousands remain text. Blank and duplicate headers get unique names.</p><p>Search and text filters ignore case. Filters combine with AND. Chart totals and exports use all matching rows. Exports escape formula-like text with an apostrophe for spreadsheet safety.</p></aside>}
        <section className="workspace-heading">
          <div><div className="eyebrow"><span className="tiny-line" />YOUR LOCAL DATA WORKSPACE</div><h1>Your data.<br className="mobile-break" /> A little clearer<span className="green">.</span></h1><p>Explore, find patterns, and take only what you need. Nothing leaves your browser.</p></div>
          {dataset && <button className="button button-primary export-top" onClick={download} disabled={!selected.length || busy}><ArrowDownToLine size={16} />Export CSV<span className="button-count">{count(selected.length)}</span></button>}
        </section>
        <input ref={fileInput} className="sr-only" id="csv-upload" type="file" accept=".csv,text/csv" aria-label="Choose CSV file" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; }} />
        <div className="sr-only" role="status" aria-live="polite">{busy ? 'Reading CSV in your browser.' : notice}</div>
        {error && <div className="message error-message" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
        {!dataset ? <>
          <div className="getting-started-grid">
            <section className={`upload-zone ${dragging ? 'dragging' : ''}`} aria-label="CSV upload"
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) { setError('Drop one CSV file at a time.'); return; } void loadFile(event.dataTransfer.files[0]); }}>
              <span className="upload-art"><FileSpreadsheet size={32} strokeWidth={1.5} /><span className="upload-art-badge"><Plus size={12} /></span></span>
              <span className="small-tag">START WITH A FILE</span>
              <h2>{busy ? 'Making sense of your rows…' : dragging ? 'Your next insight lands here.' : 'Drop your CSV. Find your story.'}</h2>
              <p>That spreadsheet has something to say.<br />Let’s make it a little easier to read.</p>
              <button className="button button-primary" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={16} />{busy ? 'Reading your file…' : 'Choose a CSV file'}<ArrowRight size={16} /></button>
              <span className="upload-limit">or drag it anywhere in this box · up to 10 MB / 50,000 rows</span>
            </section>
            <section className="sample-card">
              <span className="sample-label"><Sparkles size={14} />A LITTLE TEST DRIVE</span><h2>No file handy?<br />There’s a dataset for that.</h2><p>Meet Little Goods, a fictional shop with<br className="desktop-only" /> a month of sales to explore.</p>
              <div className="sample-visual" aria-hidden="true"><div className="sample-visual-top"><span>Sales, at a glance</span><span>OCT ’26</span></div><div className="mini-chart">{[32, 47, 39, 68, 55, 83, 73, 95, 84, 100].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><div className="sample-visual-bottom"><span>01 OCT</span><span>24 OCT</span></div></div>
              <button className="sample-button" disabled={busy} onClick={loadSample}>Explore sample data<ArrowRight size={17} /></button><span className="sample-detail">72 rows · 6 columns · zero commitment</span>
            </section>
          </div>
          <section className="feature-strip" aria-label="How it works">
            <div><span className="feature-icon"><Search size={20} /></span><div><h3>Find the useful bits</h3><p>Search, sort, and filter out the noise.</p></div></div>
            <div><span className="feature-icon"><BarChart3 size={20} /></span><div><h3>See a different angle</h3><p>Simple charts. A fresh perspective.</p></div></div>
            <div><span className="feature-icon"><ArrowDownToLine size={20} /></span><div><h3>Take what you need</h3><p>Export just the rows that matter.</p></div></div>
          </section>
        </> : <>
          <div className="file-bar"><span className="file-icon"><FileSpreadsheet size={21} /></span><div className="file-details"><strong title={filename}>{filename}</strong><span>{fileSize}<span className="dot-separator">·</span>Loaded locally<Check size={12} /></span></div><button className="button button-quiet" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={14} /><span>{busy ? 'Reading…' : 'Replace file'}</span></button><button className="icon-button danger-hover" aria-label="Clear dataset" onClick={clearDataset}><Trash2 size={16} /></button></div>
          {!!dataset.warnings.length && <div className="message warning-message" role="status"><span>Some headers needed unique names. {dataset.warnings.slice(0, 4).join(' ')}{dataset.warnings.length > 4 ? ` And ${dataset.warnings.length - 4} more.` : ''}</span></div>}
          <section className="stats-grid" aria-label="Dataset overview">
            <Stat icon={<Database size={17} />} label="TOTAL ROWS" value={count(dataset.rows.length)} detail="A good place to start" />
            <Stat icon={<FilterIcon size={17} />} label="MATCHING ROWS" value={count(selected.length)} detail={active ? `${((selected.length / dataset.rows.length) * 100).toFixed(1)}% of your dataset` : 'All rows, no filters applied'} accent />
            <Stat icon={<Columns3 size={17} />} label="COLUMNS" value={count(dataset.columns.length)} detail={`${count(numericCount)} numeric · ${count(dataset.columns.length - numericCount)} text`} />
            <Stat icon={<Hash size={17} />} label="EMPTY CELLS" value={count(missingCount)} detail={missingCount ? 'Across the original dataset' : 'Looking nice and complete'} />
          </section>
          <Suspense fallback={<div className="panel chart-empty">Loading your chart tools…</div>}><Charts key={datasetId} columns={dataset.columns} rows={selected} /></Suspense>
          <section className="panel data-panel" aria-labelledby="table-heading">
            <div className="panel-heading"><div className="heading-with-icon"><span className="icon-box"><FileSpreadsheet size={18} /></span><div><h2 id="table-heading">A closer look</h2><p>Your rows, without the noise.</p></div></div><span className="subtle-label">{count(selected.length)} rows</span></div>
            <div className="table-toolbar"><label className="search-box"><Search size={17} /><input type="search" aria-label="Search all columns" placeholder="Search anything in your data…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => { setQuery(''); setPage(0); }}><X size={14} /></button>}</label><button className="button button-secondary" onClick={() => { setFilters((items) => [...items, { id: ++nextFilterId.current, column: 0, operator: 'contains', value: '' }]); setPage(0); }}><Plus size={15} />Add filter{filters.length > 0 && <span className="filter-count">{filters.length}</span>}</button>{active && <button className="text-button" onClick={resetFilters}>Reset all</button>}</div>
            {!!filters.length && <div className="filter-list">{filters.map((filter, index) => {
              const needsValue = !['empty', 'not-empty'].includes(filter.operator);
              const numericOperator = ['gt', 'gte', 'lt', 'lte'].includes(filter.operator);
              const invalid = numericOperator && numericValue(filter.value) === null;
              return <div className="filter-row" key={filter.id}>
                <span className="filter-conjunction">{index ? 'AND' : 'WHERE'}</span>
                <select aria-label={`Filter ${index + 1} column`} value={filter.column} onChange={(event) => updateFilter(filter.id, { column: Number(event.target.value), operator: 'contains', value: '' })}>{dataset.columns.map((column, columnIndex) => <option key={columnIndex} value={columnIndex}>{column.name}</option>)}</select>
                <select aria-label={`Filter ${index + 1} operator`} value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value as Operator })}>{operators.filter((operator) => !operator.numeric || dataset.columns[filter.column].numeric).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select>
                {needsValue && <div className="filter-value"><input aria-label={`Filter ${index + 1} value`} aria-invalid={invalid} aria-describedby={invalid ? `filter-error-${filter.id}` : undefined} inputMode={numericOperator ? 'decimal' : 'text'} placeholder={numericOperator ? 'Enter a number' : 'Enter a value…'} value={filter.value} onChange={(event) => updateFilter(filter.id, { value: event.target.value })} />{invalid && <span id={`filter-error-${filter.id}`} className="filter-error">Enter a valid number.</span>}</div>}
                <button className="icon-button" aria-label={`Remove filter ${index + 1}`} onClick={() => { setFilters((items) => items.filter((item) => item.id !== filter.id)); setPage(0); }}><X size={15} /></button>
              </div>;
            })}</div>}
            <div className="table-scroll" tabIndex={0} role="region" aria-label="CSV data table, scroll horizontally for more columns">
              <table><caption className="sr-only">{filename}: {count(selected.length)} matching rows. Select column headers to sort.</caption><thead><tr><th className="row-number" scope="col">#</th>{dataset.columns.map((column, index) => <th key={index} scope="col" aria-sort={sort?.column === index ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => { setSort(sort?.column === index ? (sort.direction === 'asc' ? { column: index, direction: 'desc' } : null) : { column: index, direction: 'asc' }); setPage(0); }} aria-label={`Sort by ${column.name}`}><span className={`column-type ${column.numeric ? 'numeric' : ''}`}>{column.numeric ? '#' : 'Aa'}</span><span title={column.name}>{column.name}</span>{sort?.column === index ? (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown className="sort-hint" size={13} />}</button></th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={`${currentPage}-${index}`}><td className="row-number">{count(currentPage * PAGE_SIZE + index + 1)}</td>{row.map((value, columnIndex) => <td key={columnIndex} className={dataset.columns[columnIndex].numeric ? 'number-cell' : ''}><span className="cell-value" title={value}>{value || <span className="empty-cell">—</span>}</span></td>)}</tr>)}</tbody></table>
              {!selected.length && <div className="no-results"><Search size={28} strokeWidth={1.5} /><h3>No rows found. Still plenty of possibilities.</h3><p>Try a different search or give your filters a little breathing room.</p><button className="button button-secondary" onClick={resetFilters}>Clear search & filters</button></div>}
            </div>
            <div className="table-footer"><span>{selected.length ? `Showing ${count(currentPage * PAGE_SIZE + 1)}–${count(Math.min((currentPage + 1) * PAGE_SIZE, selected.length))} of ${count(selected.length)} rows` : 'No matching rows'}<span className="desktop-only"> · {PAGE_SIZE} per page</span></span><div className="pagination"><button className="icon-button" aria-label="Previous page" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span>Page {currentPage + 1} of {count(totalPages)}</span><button className="icon-button" aria-label="Next page" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></div>
          </section>
          <div className="workspace-note"><ShieldCheck size={14} /><span>Your original file is untouched. Charts and exports follow your filters. Refreshing clears this workspace.</span></div>
        </>}
      </main>
      <footer className="footer"><span><Leaf size={14} />Less spreadsheet. More perspective.</span><span><LockKeyhole size={13} />Private by design. Local by default.</span></footer>
    </div>
  );
}

function Stat({ icon, label, value, detail, accent = false }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`stat-card ${accent ? 'stat-accent' : ''}`}><div className="stat-label">{label}{icon}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
