'use client';

import { useState, useMemo, useEffect } from 'react';
import { ColumnDef, RowData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  ResponsiveContainer,
} from 'recharts';

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter';

interface ChartViewProps {
  columns: ColumnDef[];
  rows: RowData[];
}

// ── 现代调色板 ──
const PALETTES: Record<string, string[]> = {
  vivid: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16'],
  pastel: ['#a5b4fc', '#6ee7b7', '#fcd34d', '#fca5a5', '#f9a8d4', '#67e8f9', '#c4b5fd', '#bef264'],
  gradient: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#10b981', '#34d399', '#6ee7b7'],
};
const COLORS = PALETTES.vivid;

// ── 自定义 Tooltip ──
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-zinc-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-semibold text-zinc-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: entry.color }} />
          {entry.name}: <span className="font-medium text-zinc-800">{Number(entry.value ?? 0).toFixed(2)}</span>
        </p>
      ))}
    </div>
  );
}

// ── 格式化数字（短格式） ──
function fmt(n: number): string {
  if (Math.abs(n) >= 1_0000_0000) return (n / 1_0000_0000).toFixed(1) + '亿';
  if (Math.abs(n) >= 1_0000) return (n / 1_0000).toFixed(1) + '万';
  return Number(n).toFixed(2);
}

export default function ChartView({ columns, rows }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [topN, setTopN] = useState(20);
  const [useGradient, setUseGradient] = useState(true);
  const [animating, setAnimating] = useState(false);

  const categoryCols = useMemo(() => columns.filter(c => c.type !== 'number'), [columns]);
  const numericCols = useMemo(() => columns.filter(c => c.type === 'number'), [columns]);
  const isChartable = numericCols.length > 0 && categoryCols.length > 0;

  const defaultX = categoryCols[0]?.key || '';
  const defaultY = numericCols[0]?.key || '';
  const [xAxis, setXAxis] = useState(defaultX);
  const [yAxis, setYAxis] = useState(defaultY);

  // 散点图需要两个数值列
  const hasTwoNumeric = numericCols.length >= 2;
  const [scatterX, setScatterX] = useState(numericCols[0]?.key || '');
  const [scatterY, setScatterY] = useState(numericCols[1]?.key || '');

  useEffect(() => {
    setXAxis(defaultX);
    setYAxis(defaultY);
    setScatterX(numericCols[0]?.key || '');
    setScatterY(numericCols[1]?.key || '');
    setChartType('bar');
  }, [columns]);

  // 切换图表时触发动画
  const switchChart = (t: ChartType) => {
    setAnimating(false);
    setChartType(t);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
  };

  const chartTypeOptions = useMemo(() => {
    const types: { key: ChartType; label: string; icon: string }[] = [
      { key: 'bar', label: '柱状图', icon: '▇' },
      { key: 'line', label: '折线图', icon: '━' },
      { key: 'area', label: '面积图', icon: '◢' },
      { key: 'pie', label: '饼图', icon: '◯' },
      { key: 'radar', label: '雷达图', icon: '⬡' },
    ];
    if (hasTwoNumeric) types.push({ key: 'scatter', label: '散点图', icon: '✦' });
    return types;
  }, [hasTwoNumeric]);

  const validX = columns.find(c => c.key === xAxis) ? xAxis : defaultX;
  const validY = numericCols.find(c => c.key === yAxis) ? yAxis : defaultY;
  const validScatterX = numericCols.find(c => c.key === scatterX) ? scatterX : numericCols[0]?.key || '';
  const validScatterY = numericCols.find(c => c.key === scatterY) ? scatterY : numericCols[1]?.key || '';

  const displayData = useMemo(() => {
    if (topN <= 0 || rows.length <= topN) return rows;
    return [...rows].sort((a, b) => (Number(b[validY]) || 0) - (Number(a[validY]) || 0)).slice(0, topN);
  }, [rows, validY, topN]);

  const rowCount = rows.length;

  // 摘要统计
  const stats = useMemo(() => {
    if (!displayData.length) return null;
    const vals = displayData.map(r => Number(r[validY]) || 0);
    return {
      max: Math.max(...vals),
      min: Math.min(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      total: vals.reduce((a, b) => a + b, 0),
    };
  }, [displayData, validY]);

  // 雷达图：用当前选中的 X 列作为辐条（取唯一值），Y 列作为数值
  const radarData = useMemo(() => {
    if (chartType !== 'radar' || !validX || !validY) return [];
    const seen = new Set<string>();
    return displayData.filter(r => {
      const v = String(r[validX] ?? '');
      if (seen.has(v) || !v) return false;
      seen.add(v);
      return true;
    }).map(r => ({
      [validX]: r[validX],
      [validY]: Number(r[validY]) || 0,
    }));
  }, [displayData, validX, validY, chartType]);

  // 雷达图的 X/Y 选择开关：与普通图表一致
  const isPolar = chartType === 'radar';

  if (!isChartable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
            <svg className="text-zinc-300" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-400">当前数据不适合图表展示</p>
          <p className="text-xs text-zinc-300 mt-1">需要至少一个文本列和一个数值列</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── 顶部工具栏 ── */}
      <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
        {/* 图表类型切换 */}
        <div className="flex items-center bg-zinc-100/80 rounded-xl p-0.5 gap-0.5 shadow-inner">
          {chartTypeOptions.map(t => (
            <button
              key={t.key}
              onClick={() => switchChart(t.key)}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                chartType === t.key
                  ? 'bg-white text-zinc-800 shadow-sm font-medium scale-105'
                  : 'text-zinc-400 hover:text-zinc-600 hover:bg-white/50'
              }`}
              title={t.label}
            >
              <span className="text-xs">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* X 轴选择（非雷达非散点） */}
        {chartType !== 'scatter' && chartType !== 'radar' && (
          <>
            <span className="text-[9px] text-zinc-400 font-mono">X</span>
            <select
              value={validX}
              onChange={e => setXAxis(e.target.value)}
              className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors max-w-[130px] outline-none"
            >
              {categoryCols.map(c => (
                <option key={c.key} value={c.key}>{c.title || c.key}</option>
              ))}
            </select>
          </>
        )}

        {/* Y 轴选择 */}
        {chartType !== 'radar' && (
          <>
            <span className="text-[9px] text-zinc-400 font-mono">Y</span>
            {chartType === 'scatter' ? (
              <>
                <select
                  value={validScatterX}
                  onChange={e => setScatterX(e.target.value)}
                  className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors max-w-[120px] outline-none"
                >
                  {numericCols.map(c => (
                    <option key={c.key} value={c.key}>{c.title || c.key}</option>
                  ))}
                </select>
                <span className="text-[9px] text-zinc-400">vs</span>
                <select
                  value={validScatterY}
                  onChange={e => setScatterY(e.target.value)}
                  className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors max-w-[120px] outline-none"
                >
                  {numericCols.map(c => (
                    <option key={c.key} value={c.key}>{c.title || c.key}</option>
                  ))}
                </select>
              </>
            ) : (
              <select
                value={validY}
                onChange={e => setYAxis(e.target.value)}
                className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors max-w-[120px] outline-none"
              >
                {numericCols.map(c => (
                  <option key={c.key} value={c.key}>{c.title || c.key}</option>
                ))}
              </select>
            )}
          </>
        )}

        {/* 渐变开关 */}
        <button
          onClick={() => setUseGradient(v => !v)}
          className={`text-[11px] px-2 py-1.5 rounded-lg border transition-all ${
            useGradient ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-zinc-400 border-transparent hover:bg-zinc-100'
          }`}
          title={useGradient ? '渐变色' : '纯色'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" /><stop offset="100%" stopColor="currentColor" stopOpacity="0.3" /></linearGradient></defs>
            <rect x="3" y="3" width="18" height="18" rx="2" fill="url(#gg)" />
          </svg>
        </button>

        {rowCount > 20 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[9px] text-zinc-400">显示</span>
            <select
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none"
            >
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={0}>全部 ({rowCount})</option>
            </select>
          </div>
        )}
      </div>

      {/* ── 统计摘要 ── */}
      {stats && chartType !== 'scatter' && chartType !== 'radar' && chartType !== 'pie' && (
        <div className="flex items-center gap-4 mb-2.5 shrink-0 text-[11px] text-zinc-400">
          <span>合计: <strong className="text-zinc-700">{fmt(stats.total)}</strong></span>
          <span>平均: <strong className="text-zinc-700">{fmt(stats.avg)}</strong></span>
          <span>最高: <strong className="text-zinc-700">{fmt(stats.max)}</strong></span>
          <span>最低: <strong className="text-zinc-700">{fmt(stats.min)}</strong></span>
        </div>
      )}

      {/* ── 图表区 ── */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-zinc-100 p-3 shadow-sm">
        {!displayData.length ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-zinc-400">暂无数据</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" className="transition-opacity duration-300">
            <ChartContent
              chartType={chartType}
              displayData={displayData}
              validX={chartType === 'scatter' ? validScatterX : validX}
              validY={chartType === 'scatter' ? validScatterY : validY}
              validScatterX={validScatterX}
              validScatterY={validScatterY}
              radarData={radarData}
              numericCols={numericCols}
              categoryCols={categoryCols}
              useGradient={useGradient}
              animating={animating}
            />
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── 图表渲染子组件 ──
function ChartContent({
  chartType, displayData, validX, validY, validScatterX, validScatterY,
  radarData, numericCols, categoryCols, useGradient, animating,
}: {
  chartType: ChartType; displayData: RowData[]; validX: string; validY: string;
  validScatterX: string; validScatterY: string;
  radarData: RowData[]; numericCols: ColumnDef[]; categoryCols: ColumnDef[];
  useGradient: boolean; animating: boolean;
}) {
  const commonGrid = <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" strokeOpacity={0.6} />;
  const commonX = <XAxis dataKey={validX} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />;
  const commonY = (
    <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
      tickFormatter={(v: any) => {
        const n = Number(v ?? 0);
        if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + 'w';
        return n.toFixed(0);
      }}
    />
  );
  const commonTooltip = <Tooltip content={<CustomTooltip />} />;
  const commonLegend = <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />;
  const isAnimated = animating;

  const gradientId = `chart-grad-${chartType}`;

  switch (chartType) {
    case 'pie':
      return (
        <PieChart>
          <Pie
            data={displayData} dataKey={validY} nameKey={validX}
            cx="50%" cy="50%" outerRadius="68%"
            innerRadius={useGradient ? '30%' : 0}
            label={({ name, value }: any) => `${name}`}
            labelLine={{ stroke: '#d4d4d8', strokeWidth: 1 }}
            isAnimationActive={isAnimated} animationDuration={600} animationEasing="ease-out"
          >
            {displayData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]}
                stroke="white" strokeWidth={useGradient ? 2 : 0}
              />
            ))}
          </Pie>
          {commonTooltip}
          <Legend />
        </PieChart>
      );

    case 'line':
      return (
        <LineChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {commonGrid}
          {commonX}
          {commonY}
          {commonTooltip}
          {commonLegend}
          <Line
            type="monotone" dataKey={validY} stroke="#6366f1" strokeWidth={2.5}
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 1.5, stroke: '#fff' }}
            activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out"
          />
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {commonGrid}
          {commonX}
          {commonY}
          {commonTooltip}
          <Area
            type="monotone" dataKey={validY} stroke="#6366f1" strokeWidth={2}
            fill={useGradient ? `url(#${gradientId})` : '#6366f1'}
            fillOpacity={useGradient ? 1 : 0.08}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out"
          />
        </AreaChart>
      );

    case 'radar':
      return (
        <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis dataKey={validX} tick={{ fontSize: 10, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: '#a1a1aa' }} tickFormatter={(v: any) => fmt(Number(v))} />
          {commonTooltip}
          <Radar
            name={numericCols.find(c => c.key === validY)?.title || validY}
            dataKey={validY}
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={useGradient ? 0.15 : 0.06}
            strokeWidth={1.5}
            isAnimationActive={isAnimated} animationDuration={600} animationEasing="ease-out"
          />
        </RadarChart>
      );

    case 'scatter':
      return (
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {commonGrid}
          <XAxis dataKey={validScatterX} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false}
            name={numericCols.find(c => c.key === validScatterX)?.title || validScatterX}
          />
          <YAxis dataKey={validScatterY} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
            name={numericCols.find(c => c.key === validScatterY)?.title || validScatterY}
          />
          {commonTooltip}
          <Scatter
            data={displayData}
            fill="#6366f1" fillOpacity={0.7}
            stroke="transparent"
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out"
            shape={({ cx, cy }: any) => (
              <circle cx={cx} cy={cy} r={5} fill="#6366f1" fillOpacity={0.6} stroke="white" strokeWidth={1.5} />
            )}
          />
        </ScatterChart>
      );

    // bar — 默认
    default:
      return (
        <BarChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={useGradient ? 0.4 : 0.85} />
            </linearGradient>
          </defs>
          {commonGrid}
          {commonX}
          {commonY}
          {commonTooltip}
          <Bar
            dataKey={validY} fill={useGradient ? `url(#${gradientId})` : '#6366f1'}
            radius={[6, 6, 0, 0]} maxBarSize={48}
            isAnimationActive={isAnimated} animationDuration={500} animationEasing="ease-out"
          />
        </BarChart>
      );
  }
}
