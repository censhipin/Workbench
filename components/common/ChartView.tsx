'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ColumnDef, RowData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  ResponsiveContainer,
} from 'recharts';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'radar' | 'scatter';
type ExportFormat = 'html' | 'png' | 'svg' | 'pdf';

interface ChartViewProps {
  columns: ColumnDef[];
  rows: RowData[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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

function fmt(n: number): string {
  if (Math.abs(n) >= 1_0000_0000) return (n / 1_0000_0000).toFixed(1) + '亿';
  if (Math.abs(n) >= 1_0000) return (n / 1_0000).toFixed(1) + '万';
  return Number(n).toFixed(2);
}

export default function ChartView({ columns, rows }: ChartViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [topN, setTopN] = useState(20);
  const [useGradient, setUseGradient] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportLoading, setExportLoading] = useState<ExportFormat | null>(null);

  const categoryCols = useMemo(() => columns.filter(c => c.type !== 'number'), [columns]);
  const numericCols = useMemo(() => columns.filter(c => c.type === 'number'), [columns]);
  const isChartable = numericCols.length > 0 && categoryCols.length > 0;

  const defaultX = categoryCols[0]?.key || '';
  const defaultY = numericCols[0]?.key || '';
  const [xAxis, setXAxis] = useState(defaultX);
  const [yAxis, setYAxis] = useState(defaultY);

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

  const stats = useMemo(() => {
    if (!displayData.length) return null;
    const vals = displayData.map(r => Number(r[validY]) || 0);
    return { max: Math.max(...vals), min: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, total: vals.reduce((a, b) => a + b, 0) };
  }, [displayData, validY]);

  const radarData = useMemo(() => {
    if (chartType !== 'radar' || !validX || !validY) return [];
    const seen = new Set<string>();
    return displayData.filter(r => {
      const v = String(r[validX] ?? '');
      if (seen.has(v) || !v) return false;
      seen.add(v);
      return true;
    }).map(r => ({ [validX]: r[validX], [validY]: Number(r[validY]) || 0 }));
  }, [displayData, validX, validY, chartType]);

  const chartTitle = `${chartTypeOptions.find(t => t.key === chartType)?.label || chartType} — ${validX} × ${validY}`;

  // ── 生成 HTML ──
  const buildHtml = useCallback(() => {
    const dataJson = JSON.stringify(displayData);
    const rdJson = JSON.stringify(radarData);
    const isPie = chartType === 'pie';
    const isRadar = chartType === 'radar';
    const isScatter = chartType === 'scatter';
    const isLine = chartType === 'line';
    const isArea = chartType === 'area';

    let chartJsx = '';
    if (isPie) {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(PieChart,{},
    React.createElement(Pie,{data,dataKey:'${validY}',nameKey:'${validX}',cx:'50%',cy:'50%',outerRadius:'70%',label:e=>e.name},
      data.map((_,i)=>React.createElement(Cell,{key:i,fill:['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'][i%8]})),
    ),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
    React.createElement(Legend,null),
  )
)`;
    } else if (isRadar) {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(RadarChart,{data:rd,margin:{top:8,right:16,bottom:8,left:16}},
    React.createElement(PolarGrid,{stroke:'#e4e4e7'}),
    React.createElement(PolarAngleAxis,{dataKey:'${validX}',tick:{fontSize:10,fill:'#71717a'}}),
    React.createElement(PolarRadiusAxis,{tick:{fontSize:9,fill:'#a1a1aa'}}),
    React.createElement(Radar,{name:'${validY}',dataKey:'${validY}',stroke:'#6366f1',fill:'#6366f1',fillOpacity:.15,strokeWidth:1.5}),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
  )
)`;
    } else if (isScatter) {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(ScatterChart,{margin:{top:8,right:16,bottom:8,left:0}},
    React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:'#f0f0f0'}),
    React.createElement(XAxis,{dataKey:'${validScatterX}',tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(YAxis,{dataKey:'${validScatterY}',tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(Scatter,{data,fill:'#6366f1',fillOpacity:.7}),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
  )
)`;
    } else if (isLine) {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(LineChart,{data,margin:{top:8,right:16,bottom:8,left:0}},
    React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:'#f0f0f0'}),
    React.createElement(XAxis,{dataKey:'${validX}',tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(YAxis,{tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(Line,{type:'monotone',dataKey:'${validY}',stroke:'#6366f1',strokeWidth:2.5,dot:{r:3}}),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
    React.createElement(Legend,null),
  )
)`;
    } else if (isArea) {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(AreaChart,{data,margin:{top:8,right:16,bottom:8,left:0}},
    React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:'#f0f0f0'}),
    React.createElement(XAxis,{dataKey:'${validX}',tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(YAxis,{tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(Area,{type:'monotone',dataKey:'${validY}',stroke:'#6366f1',strokeWidth:2,fill:'#6366f1',fillOpacity:.1}),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
  )
)`;
    } else {
      chartJsx = `React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
  React.createElement(BarChart,{data,margin:{top:8,right:16,bottom:8,left:0}},
    React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:'#f0f0f0'}),
    React.createElement(XAxis,{dataKey:'${validX}',tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(YAxis,{tick:{fontSize:11,fill:'#a1a1aa'}}),
    React.createElement(Bar,{dataKey:'${validY}',fill:'#6366f1',radius:[6,6,0,0]}),
    React.createElement(Tooltip,{formatter:v=>Number(v??0).toFixed(2)}),
    React.createElement(Legend,null),
  )
)`;
    }

    const rechartsImports = isPie ? 'PieChart,Pie,Cell,Tooltip,Legend,ResponsiveContainer'
      : isRadar ? 'RadarChart,Radar,PolarGrid,PolarAngleAxis,PolarRadiusAxis,Tooltip,ResponsiveContainer'
      : isScatter ? 'ScatterChart,Scatter,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer'
      : isLine ? 'LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer'
      : isArea ? 'AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer'
      : 'BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${chartTitle}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/recharts@2/umd/Recharts.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:24px;width:100%;max-width:960px;height:80vh;display:flex;flex-direction:column}
h2{font-size:15px;font-weight:600;color:#18181b;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0f0f0}
.chart-wrap{flex:1;min-height:0}
.tip{text-align:center;font-size:11px;color:#a1a1aa;margin-top:12px}
</style>
</head><body>
<div class="card"><h2>${chartTitle}</h2><div class="chart-wrap" id="chart-container"></div><div class="tip">💡 鼠标悬浮查看数据 · 完全交互</div></div>
<script type="text/babel">
const{${rechartsImports}}=Recharts;
const data=${dataJson};
const rd=${rdJson};
function App(){return ${chartJsx}}
const root=ReactDOM.createRoot(document.getElementById('chart-container'));
root.render(React.createElement(App));
</script>
</body></html>`;
  }, [chartType, displayData, validX, validY, validScatterX, validScatterY, radarData, chartTitle]);

  // ── 导出 ──
  const doExport = useCallback(async (format: ExportFormat) => {
    setExportLoading(format);

    if (format === 'html') {
      const html = buildHtml();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chartTitle.replace(/[\s\/\\]/g, '_')}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setExportLoading(null);
      return;
    }

    // 等待一帧让渲染完成
    await new Promise(r => setTimeout(r, 100));
    const el = chartRef.current?.querySelector('.recharts-wrapper') as HTMLElement;
    if (!el) { setExportLoading(null); return; }

    try {
      if (format === 'png') {
        const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 1 });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${chartTitle.replace(/[\s\/\\]/g, '_')}.png`;
        a.click();
      } else if (format === 'svg') {
        const dataUrl = await toSvg(el, { backgroundColor: '#ffffff' });
        const blob = new Blob([dataUrl], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chartTitle.replace(/[\s\/\\]/g, '_')}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === 'pdf') {
        const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 1 });
        const pdf = new jsPDF({ orientation: el.offsetWidth > el.offsetHeight ? 'landscape' : 'portrait' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const imgW = el.offsetWidth;
        const imgH = el.offsetHeight;
        const ratio = imgH / imgW;
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfW * ratio);
        pdf.save(`${chartTitle.replace(/[\s\/\\]/g, '_')}.pdf`);
      }
    } catch (e) {
      console.error('导出失败', e);
    }
    setExportLoading(null);
  }, [chartTitle, buildHtml]);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
          <div className="flex items-center bg-zinc-100/80 rounded-xl p-0.5 gap-0.5 shadow-inner">
            {chartTypeOptions.map(t => (
              <button key={t.key} onClick={() => switchChart(t.key)}
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 ${chartType === t.key ? 'bg-white text-zinc-800 shadow-sm font-medium scale-105' : 'text-zinc-400 hover:text-zinc-600 hover:bg-white/50'}`}
                title={t.label}
              ><span className="text-xs">{t.icon}</span><span className="hidden sm:inline">{t.label}</span></button>
            ))}
          </div>

          {chartType !== 'scatter' && chartType !== 'radar' && (
            <><span className="text-[9px] text-zinc-400 font-mono">X</span>
              <select value={validX} onChange={e => setXAxis(e.target.value)}
                className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-colors max-w-[130px] outline-none"
              >{categoryCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select></>
          )}

          {chartType !== 'radar' && (
            <><span className="text-[9px] text-zinc-400 font-mono">Y</span>
              {chartType === 'scatter' ? (
                <>
                  <select value={validScatterX} onChange={e => setScatterX(e.target.value)}
                    className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white max-w-[120px] outline-none"
                  >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
                  <span className="text-[9px] text-zinc-400">vs</span>
                  <select value={validScatterY} onChange={e => setScatterY(e.target.value)}
                    className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white max-w-[120px] outline-none"
                  >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
                </>
              ) : (
                <select value={validY} onChange={e => setYAxis(e.target.value)}
                  className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white hover:border-zinc-300 max-w-[120px] outline-none"
                >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
              )}</>
          )}

          <button onClick={() => setUseGradient(v => !v)}
            className={`text-[11px] px-2 py-1.5 rounded-lg border transition-all ${useGradient ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-zinc-400 border-transparent hover:bg-zinc-100'}`}
            title={useGradient ? '渐变色' : '纯色'}
          ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity={useGradient ? 0.3 : 1} /></svg></button>

          {/* 导出按钮 */}
          <button onClick={() => setExportDialog(true)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all"
            title="导出图表"
          ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg> 导出</button>

          {/* 全屏按钮 */}
          <button onClick={() => setFullscreen(true)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
            title="全屏查看"
          ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg></button>

          {rowCount > 20 && (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[9px] text-zinc-400">显示</span>
              <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none"
              ><option value={20}>Top 20</option><option value={50}>Top 50</option><option value={100}>Top 100</option><option value={0}>全部 ({rowCount})</option></select>
            </div>
          )}
        </div>

        {stats && chartType !== 'scatter' && chartType !== 'radar' && chartType !== 'pie' && (
          <div className="flex items-center gap-4 mb-2.5 shrink-0 text-[11px] text-zinc-400">
            <span>合计: <strong className="text-zinc-700">{fmt(stats.total)}</strong></span>
            <span>平均: <strong className="text-zinc-700">{fmt(stats.avg)}</strong></span>
            <span>最高: <strong className="text-zinc-700">{fmt(stats.max)}</strong></span>
            <span>最低: <strong className="text-zinc-700">{fmt(stats.min)}</strong></span>
          </div>
        )}

        <div ref={chartRef} className="flex-1 min-h-0 bg-white rounded-2xl border border-zinc-100 p-3 shadow-sm">
          {!displayData.length ? (
            <div className="flex items-center justify-center h-full"><p className="text-xs text-zinc-400">暂无数据</p></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" className="transition-opacity duration-300">
              <ChartContent chartType={chartType} displayData={displayData}
                validX={chartType === 'scatter' ? validScatterX : validX}
                validY={chartType === 'scatter' ? validScatterY : validY}
                validScatterX={validScatterX} validScatterY={validScatterY}
                radarData={radarData} numericCols={numericCols}
                useGradient={useGradient} animating={animating} />
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 全屏模式 ── */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 shrink-0">
            <h2 className="text-base font-semibold text-zinc-800">{chartTitle}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => { setFullscreen(false); setExportDialog(true); }}
                className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">导出</button>
              <button onClick={() => setFullscreen(false)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>关闭</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-8">
            <ResponsiveContainer width="100%" height="100%">
              <ChartContent chartType={chartType} displayData={displayData}
                validX={chartType === 'scatter' ? validScatterX : validX}
                validY={chartType === 'scatter' ? validScatterY : validY}
                validScatterX={validScatterX} validScatterY={validScatterY}
                radarData={radarData} numericCols={numericCols}
                useGradient={useGradient} animating={animating} />
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 导出弹窗 ── */}
      {exportDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => { if (!exportLoading) setExportDialog(false); }}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-6 py-5 w-80 max-w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">导出图表</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <ExportOption label="交互式 HTML" desc="动态可交互，浏览器打开" icon="🌐" format="html" loading={exportLoading} onClick={doExport} />
              <ExportOption label="PNG 图片" desc="高清位图" icon="🖼️" format="png" loading={exportLoading} onClick={doExport} />
              <ExportOption label="SVG 矢量" desc="无限放大不失真" icon="📐" format="svg" loading={exportLoading} onClick={doExport} />
              <ExportOption label="PDF 文档" desc="适合打印和汇报" icon="📄" format="pdf" loading={exportLoading} onClick={doExport} />
            </div>
            <button onClick={() => setExportDialog(false)}
              className="mt-3 w-full text-xs text-zinc-400 hover:text-zinc-600 py-2 transition-colors">取消</button>
          </div>
        </div>
      )}
    </>
  );
}

function ExportOption({ label, desc, icon, format, loading, onClick }: {
  label: string; desc: string; icon: string; format: ExportFormat; loading: ExportFormat | null; onClick: (f: ExportFormat) => void;
}) {
  const isBusy = loading === format;
  return (
    <button onClick={() => onClick(format)} disabled={!!loading}
      className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border transition-colors text-left ${isBusy ? 'bg-zinc-50 border-zinc-200 cursor-wait' : 'border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{isBusy ? '⏳' : icon}</span>
        <span className="text-xs font-medium text-zinc-700">{label}</span>
      </div>
      <span className="text-[10px] text-zinc-400 ml-7">{desc}</span>
    </button>
  );
}

// ── 图表渲染子组件 ──
function ChartContent({ chartType, displayData, validX, validY, validScatterX, validScatterY, radarData, numericCols, useGradient, animating }: {
  chartType: ChartType; displayData: RowData[]; validX: string; validY: string;
  validScatterX: string; validScatterY: string; radarData: RowData[];
  numericCols: ColumnDef[]; useGradient: boolean; animating: boolean;
}) {
  const commonGrid = <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" strokeOpacity={0.6} />;
  const commonX = <XAxis dataKey={validX} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />;
  const commonY = <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => { const n = Number(v ?? 0); return Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + 'w' : n.toFixed(0); }} />;
  const commonTooltip = <Tooltip content={<CustomTooltip />} />;
  const commonLegend = <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />;
  const isAnimated = animating;
  const gid = `cg-${chartType}`;

  switch (chartType) {
    case 'pie':
      return (
        <PieChart>
          <Pie data={displayData} dataKey={validY} nameKey={validX} cx="50%" cy="50%" outerRadius="68%"
            innerRadius={useGradient ? '30%' : 0} label={({ name }: any) => name} labelLine={{ stroke: '#d4d4d8', strokeWidth: 1 }}
            isAnimationActive={isAnimated} animationDuration={600} animationEasing="ease-out">
            {displayData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={useGradient ? 2 : 0} />)}
          </Pie>
          {commonTooltip}<Legend />
        </PieChart>
      );
    case 'line':
      return (
        <LineChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {commonGrid}{commonX}{commonY}{commonTooltip}{commonLegend}
          <Line type="monotone" dataKey={validY} stroke="#6366f1" strokeWidth={2.5}
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 1.5, stroke: '#fff' }}
            activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out" />
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs>
          {commonGrid}{commonX}{commonY}{commonTooltip}
          <Area type="monotone" dataKey={validY} stroke="#6366f1" strokeWidth={2}
            fill={useGradient ? `url(#${gid})` : '#6366f1'} fillOpacity={useGradient ? 1 : 0.08}
            dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out" />
        </AreaChart>
      );
    case 'radar':
      return (
        <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis dataKey={validX} tick={{ fontSize: 10, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: '#a1a1aa' }} tickFormatter={(v: any) => fmt(Number(v))} />
          {commonTooltip}
          <Radar name={numericCols.find(c => c.key === validY)?.title || validY} dataKey={validY}
            stroke="#6366f1" fill="#6366f1" fillOpacity={useGradient ? 0.15 : 0.06} strokeWidth={1.5}
            isAnimationActive={isAnimated} animationDuration={600} animationEasing="ease-out" />
        </RadarChart>
      );
    case 'scatter':
      return (
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {commonGrid}
          <XAxis dataKey={validScatterX} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} name={numericCols.find(c => c.key === validScatterX)?.title || validScatterX} />
          <YAxis dataKey={validScatterY} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false} name={numericCols.find(c => c.key === validScatterY)?.title || validScatterY} />
          {commonTooltip}
          <Scatter data={displayData} fill="#6366f1" fillOpacity={0.7} stroke="transparent"
            isAnimationActive={isAnimated} animationDuration={700} animationEasing="ease-out"
            shape={({ cx, cy }: any) => <circle cx={cx} cy={cy} r={5} fill="#6366f1" fillOpacity={0.6} stroke="white" strokeWidth={1.5} />} />
        </ScatterChart>
      );
    default:
      return (
        <BarChart data={displayData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} /><stop offset="100%" stopColor="#818cf8" stopOpacity={useGradient ? 0.4 : 0.85} /></linearGradient></defs>
          {commonGrid}{commonX}{commonY}{commonTooltip}
          <Bar dataKey={validY} fill={useGradient ? `url(#${gid})` : '#6366f1'} radius={[6, 6, 0, 0]} maxBarSize={48}
            isAnimationActive={isAnimated} animationDuration={500} animationEasing="ease-out" />
        </BarChart>
      );
  }
}
