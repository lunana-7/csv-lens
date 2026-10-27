import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, LineChart as LineChartIcon } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { chartData, type Column } from './data';

const numberFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export default function Charts({ columns, rows }: { columns: Column[]; rows: string[][] }) {
  const numericColumns = columns.flatMap((column, index) => column.numeric ? [index] : []);
  const [open, setOpen] = useState(true);
  const [type, setType] = useState<'bar' | 'line'>('bar');
  const [labelColumn, setLabelColumn] = useState(() => Math.max(0, columns.findIndex((column) => !column.numeric)));
  const [valueColumn, setValueColumn] = useState(numericColumns[0] ?? 0);
  const [measure, setMeasure] = useState<'count' | 'sum'>('count');
  const data = useMemo(() => chartData(rows, labelColumn, valueColumn, type, measure), [rows, labelColumn, valueColumn, type, measure]);
  const needsNumeric = type === 'line' || measure === 'sum';
  const chartTitle = type === 'line'
    ? `${columns[valueColumn].name} by ${columns[labelColumn].name}`
    : `${measure === 'count' ? 'Row count' : `Total ${columns[valueColumn].name}`} by ${columns[labelColumn].name}`;
  const noData = !rows.length || !data.points.length || data.overflow || (needsNumeric && !numericColumns.length);
  const xAxis = <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#737b72' }} axisLine={false} tickLine={false} tickMargin={12} minTickGap={30} tickFormatter={(label: string) => label.length > 17 ? `${label.slice(0, 16)}…` : label} />;
  const yAxis = <YAxis width={55} tick={{ fontSize: 11, fill: '#737b72' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => numberFormat.format(value)} />;

  return (
    <section className="panel chart-panel" aria-labelledby="chart-heading">
      <div className="panel-heading">
        <div className="heading-with-icon"><span className="icon-box"><BarChart3 size={18} /></span><div><h2 id="chart-heading">The bigger picture</h2><p>Turn the rows into a little perspective.</p></div></div>
        <button className="icon-button" aria-label={open ? 'Collapse chart' : 'Expand chart'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
      </div>
      {open && <>
        <div className="chart-controls">
          <div className="segmented" role="group" aria-label="Chart type">
            <button className={type === 'bar' ? 'active' : ''} aria-pressed={type === 'bar'} onClick={() => setType('bar')}><BarChart3 size={15} />Bar</button>
            <button className={type === 'line' ? 'active' : ''} aria-pressed={type === 'line'} disabled={!numericColumns.length} onClick={() => setType('line')}><LineChartIcon size={15} />Line</button>
          </div>
          <label className="inline-control"><span>{type === 'bar' ? 'Group by' : 'Labels'}</span><select aria-label="Chart label column" value={labelColumn} onChange={(event) => setLabelColumn(Number(event.target.value))}>{columns.map((column, index) => <option key={index} value={index}>{column.name}</option>)}</select></label>
          {type === 'bar' && <label className="inline-control"><span>Measure</span><select aria-label="Chart measure" value={measure} onChange={(event) => setMeasure(event.target.value as 'count' | 'sum')}><option value="count">Row count</option><option value="sum" disabled={!numericColumns.length}>Sum of values</option></select></label>}
          {needsNumeric && <label className="inline-control"><span>Values</span><select aria-label="Chart value column" value={valueColumn} onChange={(event) => setValueColumn(Number(event.target.value))}>{numericColumns.map((index) => <option key={index} value={index}>{columns[index].name}</option>)}</select></label>}
        </div>
        <div className="chart-body" role="img" aria-label={chartTitle}>
          <div className="chart-subheading"><span>{chartTitle}</span><span className="chart-key"><i />{type === 'bar' && measure === 'count' ? 'Rows' : columns[valueColumn].name}</span></div>
          {noData ? <div className="chart-empty">{data.overflow ? 'These totals are too large to chart. Try a narrower filter.' : 'No values to chart. Adjust your filters or select another column.'}</div> :
            <ResponsiveContainer width="100%" height={225} minWidth={0}>
              {type === 'bar' ? <BarChart data={data.points} margin={{ top: 12, right: 14, bottom: 8, left: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="#e9ede5" strokeDasharray="3 4" />{xAxis}{yAxis}
                <Tooltip cursor={{ fill: '#f1f4ec' }} contentStyle={{ border: '1px solid #dfe5d9', borderRadius: 10, fontSize: 12 }} />
                <Bar name={measure === 'count' ? 'Rows' : columns[valueColumn].name} dataKey="value" fill="#7fa58a" radius={[5, 5, 0, 0]} maxBarSize={70} isAnimationActive={false} />
              </BarChart> : <LineChart data={data.points} margin={{ top: 12, right: 14, bottom: 8, left: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="#e9ede5" strokeDasharray="3 4" />{xAxis}{yAxis}
                <Tooltip contentStyle={{ border: '1px solid #dfe5d9', borderRadius: 10, fontSize: 12 }} />
                <Line name={columns[valueColumn].name} dataKey="value" type="linear" stroke="#397756" strokeWidth={2.5} dot={data.points.length < 40 ? { r: 3, fill: '#397756' } : false} isAnimationActive={false} />
              </LineChart>}
            </ResponsiveContainer>}
        </div>
        <div className="chart-footnote"><span className="live-dot" />Follows your current search and filters.{type === 'bar' && data.total > 20 ? ` Showing the top 20 of ${data.total.toLocaleString()} categories.` : ''}{type === 'line' ? ` First ${Math.min(data.total, 200).toLocaleString()} of ${data.total.toLocaleString()} numeric rows, in table sort order. Blank values are skipped.` : ''}</div>
      </>}
    </section>
  );
}
