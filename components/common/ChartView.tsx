'use client';

import { useState, useMemo, useEffect } from 'react';
import { ColumnDef, RowData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts';

type ChartType = 'bar' | 'line' | 'pie';

interface ChartViewProps {
  columns: ColumnDef[];
  rows: RowData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ChartView({ columns, rows }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [topN, setTopN] = useState(20);

  const categoryCols = useMemo(() => columns.filter(c => c.type !== 'number'), [columns]);
  const numericCols = useMemo(() => columns.filter(c => c.type === 'number'), [columns]);
  const isChartable = numericCols.length > 0 && categoryCols.length > 0;

  const defaultX = categoryCols[0]?.key || '';
  const defaultY = numericCols[0]?.key || '';
  const [xAxis, setXAxis] = useState(defaultX);
  const [yAxis, setYAxis] = useState(defaultY);

  useEffect(() => {
    setXAxis(defaultX);
    setYAxis(defaultY);
    setChartType('bar');
  }, [columns]);

  const chartTypeOptions = useMemo(() => {
    const types: { key: ChartType; label: string }[] = [{ key: 'bar', label: '柱状图' }];
    if (categoryCols.some(c => c.type === 'date')) types.push({ key: 'line', label: '折线图' });
    types.push({ key: 'pie', label: '饼图' });
    return types;
  }, [categoryCols]);

  const validX = columns.find(c => c.key === xAxis) ? xAxis : defaultX;
  const validY = numericCols.find(c => c.key === yAxis) ? yAxis : defaultY;

  const displayData = useMemo(() => {
    if (topN <= 0 || rows.length <= topN) return rows;
    return [...rows].sort((a, b) => (Number(b[validY]) || 0) - (Number(a[validY]) || 0)).slice(0, topN);
  }, [rows, validY, topN]);

  const rowCount = rows.length;

  if (!isChartable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="mx-auto mb-2 text-zinc-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <p className="text-sm text-zinc-400">当前数据不适合图表展示</p>
          <p className="text-xs text-zinc-300 mt-1">需要至少一个文本列和一个数值列</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
          {chartTypeOptions.map(t => (
            <button
              key={t.key}
              onClick={() => setChartType(t.key)}
              className={'text-xs px-2.5 py-1 rounded-md transition-colors ' + (chartType === t.key ? 'bg-white text-zinc-800 shadow-sm font-medium' : 'text-zinc-500 hover:text-zinc-700')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-zinc-300">X</span>
        <select
          value={validX}
          onChange={e => setXAxis(e.target.value)}
          className="text-xs border border-zinc-200 rounded-md px-2 py-1 text-zinc-600 bg-white max-w-[140px]"
        >
          {categoryCols.map(c => (
            <option key={c.key} value={c.key}>{c.title || c.key}</option>
          ))}
        </select>

        <span className="text-[10px] text-zinc-300">Y</span>
        <select
          value={validY}
          onChange={e => setYAxis(e.target.value)}
          className="text-xs border border-zinc-200 rounded-md px-2 py-1 text-zinc-600 bg-white max-w-[140px]"
        >
          {numericCols.map(c => (
            <option key={c.key} value={c.key}>{c.title || c.key}</option>
          ))}
        </select>

        {rowCount > 20 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-zinc-400">显示</span>
            <select
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="text-xs border border-zinc-200 rounded-md px-2 py-1 text-zinc-600 bg-white"
            >
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={0}>全部 ({rowCount})</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie data={displayData} dataKey={validY} nameKey={validX} cx="50%" cy="50%" outerRadius="70%" label={function ({ name, value }: { name?: string; value?: number }) { return (name ?? '') + ': ' + (value ?? 0); }}>
                {displayData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={displayData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={validX} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={validY} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={displayData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={validX} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey={validY} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
