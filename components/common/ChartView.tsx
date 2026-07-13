'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ColumnDef, RowData } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
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
  operation?: string;
}

const COLORS_ARR = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const CHART_LABELS: Record<ChartType, string> = { bar: '柱状图', line: '折线图', area: '面积图', pie: '饼图', radar: '雷达图', scatter: '散点图' };

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

export default function ChartView({ columns, rows, operation }: ChartViewProps) {
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
  const [xAxisSel, setXAxisSel] = useState(defaultX);
  const [yAxisSel, setYAxisSel] = useState(defaultY);

  const hasTwoNumeric = numericCols.length >= 2;
  const [sx, setSx] = useState(numericCols[0]?.key || '');
  const [sy, setSy] = useState(numericCols[1]?.key || '');

  useEffect(() => {
    setXAxisSel(defaultX); setYAxisSel(defaultY);
    setSx(numericCols[0]?.key || ''); setSy(numericCols[1]?.key || '');
    setChartType('bar');
  }, [columns]);

  const switchChart = (t: ChartType) => {
    setAnimating(false); setChartType(t);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
  };

  const chartOpts = useMemo(() => {
    const t: { key: ChartType; label: string; icon: string }[] = [
      { key: 'bar', label: '柱状图', icon: '▇' }, { key: 'line', label: '折线图', icon: '━' },
      { key: 'area', label: '面积图', icon: '◢' }, { key: 'pie', label: '饼图', icon: '◯' },
      { key: 'radar', label: '雷达图', icon: '⬡' },
    ];
    if (hasTwoNumeric) t.push({ key: 'scatter', label: '散点图', icon: '✦' });
    return t;
  }, [hasTwoNumeric]);

  const xAxis = columns.find(c => c.key === xAxisSel) ? xAxisSel : defaultX;
  const yAxis = numericCols.find(c => c.key === yAxisSel) ? yAxisSel : defaultY;
  const sxAxis = numericCols.find(c => c.key === sx) ? sx : numericCols[0]?.key || '';
  const syAxis = numericCols.find(c => c.key === sy) ? sy : numericCols[1]?.key || '';

  const displayData = useMemo(() => {
    if (topN <= 0 || rows.length <= topN) return rows;
    return [...rows].sort((a, b) => (Number(b[yAxis]) || 0) - (Number(a[yAxis]) || 0)).slice(0, topN);
  }, [rows, yAxis, topN]);

  const stats = useMemo(() => {
    if (!displayData.length) return null;
    const vals = displayData.map(r => Number(r[yAxis]) || 0);
    return { max: Math.max(...vals), min: Math.min(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, total: vals.reduce((a, b) => a + b, 0) };
  }, [displayData, yAxis]);

  const radarData = useMemo(() => {
    if (chartType !== 'radar' || !xAxis || !yAxis) return [];
    const seen = new Set<string>();
    return displayData.filter(r => { const v = String(r[xAxis] ?? ''); if (seen.has(v) || !v) return false; seen.add(v); return true; })
      .map(r => ({ [xAxis]: r[xAxis], [yAxis]: Number(r[yAxis]) || 0 }));
  }, [displayData, xAxis, yAxis, chartType]);

  const chartTitle = CHART_LABELS[chartType] + ' — ' + xAxis + ' × ' + yAxis;
  const yTitle = numericCols.find(c => c.key === yAxis)?.title || yAxis;

  // ── download helper ──
  const download = useCallback((content: Blob | string, name: string) => {
    const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain' }) : content;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── 导出 ──
  const doExport = useCallback(async (fmt: ExportFormat) => {
    setExportLoading(fmt);

    if (fmt === 'html') {
      const json = JSON.stringify(displayData);
      const rj = JSON.stringify(radarData);
      const safeTitle = chartTitle.replace(/[\s\/\\]/g, '_');
      const isPie = chartType === 'pie';
      const isRadar = chartType === 'radar';
      const isScatter = chartType === 'scatter';
      const isLine = chartType === 'line';
      const isArea = chartType === 'area';

      let jsx, comps;
      if (isPie) {
        comps = 'PieChart,Pie,Cell,Tooltip,Legend,ResponsiveContainer';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(PieChart,{},React.createElement(Pie,{data,dataKey:"' + yAxis + '",nameKey:"' + xAxis + '",cx:"50%",cy:"50%",outerRadius:"70%",label:function(e){return e.name+":"+Number(e.value||0).toFixed(2)}},data.map(function(_,i){return React.createElement(Cell,{key:i,fill:["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"][i%8]})})),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}}),React.createElement(Legend,null)))';
      } else if (isRadar) {
        comps = 'RadarChart,Radar,PolarGrid,PolarAngleAxis,PolarRadiusAxis,Tooltip,ResponsiveContainer';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(RadarChart,{data:rd,margin:{top:8,right:16,bottom:8,left:16}},React.createElement(PolarGrid,{stroke:"#e4e4e7"}),React.createElement(PolarAngleAxis,{dataKey:"' + xAxis + '",tick:{fontSize:10,fill:"#71717a"}}),React.createElement(PolarRadiusAxis,{tick:{fontSize:9,fill:"#a1a1aa"}}),React.createElement(Radar,{name:"' + yAxis + '",dataKey:"' + yAxis + '",stroke:"#6366f1",fill:"#6366f1",fillOpacity:0.15,strokeWidth:1.5}),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}})))';
      } else if (isScatter) {
        comps = 'ScatterChart,Scatter,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(ScatterChart,{margin:{top:8,right:16,bottom:8,left:0}},React.createElement(CartesianGrid,{strokeDasharray:"3 3",stroke:"#f0f0f0"}),React.createElement(XAxis,{dataKey:"' + sxAxis + '",tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(YAxis,{dataKey:"' + syAxis + '",tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(Scatter,{data,fill:"#6366f1",fillOpacity:0.7}),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}})))';
      } else if (isLine) {
        comps = 'LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,LabelList';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(LineChart,{data,margin:{top:20,right:16,bottom:8,left:0}},React.createElement(CartesianGrid,{strokeDasharray:"3 3",stroke:"#f0f0f0"}),React.createElement(XAxis,{dataKey:"' + xAxis + '",tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(YAxis,{tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(Line,{type:"monotone",dataKey:"' + yAxis + '",stroke:"#6366f1",strokeWidth:2.5,dot:{r:3}},React.createElement(LabelList,{dataKey:"' + yAxis + '",position:"top",fontSize:10,fill:"#52525b",formatter:function(v){return Number(v||0).toFixed(2)}})),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}}),React.createElement(Legend,null)))';
      } else if (isArea) {
        comps = 'AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(AreaChart,{data,margin:{top:20,right:16,bottom:8,left:0}},React.createElement(CartesianGrid,{strokeDasharray:"3 3",stroke:"#f0f0f0"}),React.createElement(XAxis,{dataKey:"' + xAxis + '",tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(YAxis,{tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(Area,{type:"monotone",dataKey:"' + yAxis + '",stroke:"#6366f1",strokeWidth:2,fill:"#6366f1",fillOpacity:0.1}),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}})))';
      } else {
        comps = 'BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,LabelList';
        jsx = 'React.createElement(ResponsiveContainer,{width:"100%",height:"100%"},React.createElement(BarChart,{data,margin:{top:20,right:16,bottom:8,left:0}},React.createElement(CartesianGrid,{strokeDasharray:"3 3",stroke:"#f0f0f0"}),React.createElement(XAxis,{dataKey:"' + xAxis + '",tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(YAxis,{tick:{fontSize:11,fill:"#a1a1aa"}}),React.createElement(Bar,{dataKey:"' + yAxis + '",fill:"#6366f1",radius:[4,4,0,0]},React.createElement(LabelList,{dataKey:"' + yAxis + '",position:"top",fontSize:10,fill:"#52525b",formatter:function(v){return Number(v||0).toFixed(2)}})),React.createElement(Tooltip,{formatter:function(v){return Number(v||0).toFixed(2)}})))';
      }

      const html =
        '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>' + chartTitle + '</title>\n' +
        '<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>\n' +
        '<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>\n' +
        '<script src="https://unpkg.com/recharts@2/umd/Recharts.min.js"><\/script>\n' +
        '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n' +
        '<style>\n*{margin:0;padding:0;box-sizing:border-box}\n' +
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}\n' +
        '.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:24px;width:100%;max-width:960px;height:80vh;display:flex;flex-direction:column}\n' +
        'h2{font-size:15px;font-weight:600;color:#18181b;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #f0f0f0}\n' +
        '.chart-wrap{flex:1;min-height:0}\n.tip{text-align:center;font-size:11px;color:#a1a1aa;margin-top:12px}\n' +
        '<\/style>\n</head>\n<body>\n' +
        '<div class="card">\n<h2>' + chartTitle + '</h2>\n<div class="chart-wrap" id="chart-container"><\/div>\n<div class="tip">\u{1F4A1} 鼠标悬浮查看数据 · 完全交互<\/div>\n<\/div>\n' +
        '<script type="text/babel">\n' +
        'var{' + comps + '}=Recharts;\n' +
        'var data=' + json + ';\n' +
        'var rd=' + rj + ';\n' +
        'function App(){return ' + jsx + '}\n' +
        'var root=ReactDOM.createRoot(document.getElementById("chart-container"));\n' +
        'root.render(React.createElement(App));\n' +
        '<\/script>\n</body>\n</html>';
      download(html, safeTitle + '.html');
      setExportLoading(null);
      return;
    }

    await new Promise(r => setTimeout(r, 150));
    const el = chartRef.current?.querySelector('.recharts-wrapper') as HTMLElement;
    if (!el) { setExportLoading(null); return; }

    try {
      if (fmt === 'png') {
        const url = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 1 });
        download(await (await fetch(url)).blob(), chartTitle.replace(/[\s\/\\]/g, '_') + '.png');
      } else if (fmt === 'svg') {
        const svg = await toSvg(el, { backgroundColor: '#ffffff' });
        download(svg, chartTitle.replace(/[\s\/\\]/g, '_') + '.svg');
      } else if (fmt === 'pdf') {
        const url = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2, quality: 1 });
        const img = new Image();
        img.src = url;
        await new Promise(r => { img.onload = r; });
        const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const iw = img.width;
        const ih = img.height;
        const r1 = pw / iw;
        const r2 = ph / ih;
        const scale = Math.min(r1, r2) * 0.85; // leave margins
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (pw - dw) / 2;
        const dy = (ph - dh) / 2;
        pdf.addImage(url, 'PNG', dx, dy, dw, dh);
        pdf.save(chartTitle.replace(/[\s\/\\]/g, '_') + '.pdf');
      }
    } catch (e) { console.error('导出失败', e); }
    setExportLoading(null);
  }, [chartTitle, chartType, displayData, radarData, xAxis, yAxis, sxAxis, syAxis, download]);

  if (!isChartable) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
            <svg className="text-zinc-300" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
          </div>
          <p className="text-sm font-medium text-zinc-400">当前数据不适合图表展示</p>
          <p className="text-xs text-zinc-300 mt-1">需要至少一个文本列和一个数值列</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {operation && <span className="text-[11px] font-medium text-zinc-700 bg-zinc-100 px-2 py-1 rounded-md truncate max-w-[200px]" title={operation}>{operation}</span>}
            <span className="text-[11px] text-zinc-400">{CHART_LABELS[chartType]}</span>
            <span className="text-[10px] text-zinc-300 bg-zinc-100 px-1.5 py-0.5 rounded">{displayData.length} 项</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setUseGradient(v => !v)}
              className={'text-[11px] px-2 py-1.5 rounded-lg border transition-all ' + (useGradient ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'text-zinc-400 border-transparent hover:bg-zinc-100')}
            ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fillOpacity={useGradient ? 0.3 : 1} /></svg></button>
            <button onClick={() => setExportDialog(true)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all"
            ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg> 导出</button>
            <button onClick={() => setFullscreen(true)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all"
            ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2 shrink-0 flex-wrap">
          <div className="flex items-center bg-zinc-100/80 rounded-xl p-0.5 gap-0.5 shadow-inner">
            {chartOpts.map(t => (
              <button key={t.key} onClick={() => switchChart(t.key)}
                className={'flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg transition-all duration-200 ' + (chartType === t.key ? 'bg-white text-zinc-800 shadow-sm font-medium scale-105' : 'text-zinc-400 hover:text-zinc-600 hover:bg-white/50')}
              ><span className="text-xs">{t.icon}</span><span className="hidden sm:inline">{t.label}</span></button>
            ))}
          </div>
          {chartType !== 'scatter' && chartType !== 'radar' && (
            <><span className="text-[9px] text-zinc-400 font-mono">X</span>
              <select value={xAxis} onChange={e => setXAxisSel(e.target.value)}
                className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none max-w-[130px]"
              >{categoryCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select></>
          )}
          {chartType !== 'radar' && (
            <><span className="text-[9px] text-zinc-400 font-mono">Y</span>
              {chartType === 'scatter' ? (
                <>
                  <select value={sx} onChange={e => setSx(e.target.value)}
                    className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none max-w-[120px]"
                  >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
                  <span className="text-[9px] text-zinc-400">vs</span>
                  <select value={sy} onChange={e => setSy(e.target.value)}
                    className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none max-w-[120px]"
                  >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
                </>
              ) : (
                <select value={yAxis} onChange={e => setYAxisSel(e.target.value)}
                  className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none max-w-[120px]"
                >{numericCols.map(c => <option key={c.key} value={c.key}>{c.title || c.key}</option>)}</select>
              )}</>
          )}
          <div className="ml-auto flex items-center gap-2">
            {rows.length > 20 && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-zinc-400">显示</span>
                <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                  className="text-[11px] border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none"
                ><option value={20}>Top 20</option><option value={50}>Top 50</option><option value={100}>Top 100</option><option value={0}>全部 ({rows.length})</option></select>
              </div>
            )}
          </div>
        </div>

        {stats && !['scatter', 'radar', 'pie'].includes(chartType) && (
          <div className="flex items-center gap-4 mb-2 shrink-0 text-[11px] text-zinc-400">
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
              <ChartBody chartType={chartType} data={displayData}
                xKey={chartType === 'scatter' ? sxAxis : xAxis}
                yKey={chartType === 'scatter' ? syAxis : yAxis}
                sX={sxAxis} sY={syAxis}
                radar={radarData} numericCols={numericCols}
                gradient={useGradient} animate={animating} />
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 shrink-0">
            <h2 className="text-base font-semibold text-zinc-800">{operation ? operation + ' — ' : ''}{chartTitle}</h2>
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
              <ChartBody chartType={chartType} data={displayData}
                xKey={chartType === 'scatter' ? sxAxis : xAxis}
                yKey={chartType === 'scatter' ? syAxis : yAxis}
                sX={sxAxis} sY={syAxis}
                radar={radarData} numericCols={numericCols}
                gradient={useGradient} animate={animating} />
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {exportDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => { if (!exportLoading) setExportDialog(false); }}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-6 py-5 w-80 max-w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">导出图表</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '交互式 HTML', desc: '动态可交互，浏览器打开', icon: '🌐', fmt: 'html' as ExportFormat },
                { label: 'PNG 图片', desc: '高清位图', icon: '🖼️', fmt: 'png' as ExportFormat },
                { label: 'SVG 矢量', desc: '无限放大不失真', icon: '📐', fmt: 'svg' as ExportFormat },
                { label: 'PDF 文档', desc: '适合打印和汇报', icon: '📄', fmt: 'pdf' as ExportFormat },
              ].map(o => (
                <button key={o.fmt} onClick={() => doExport(o.fmt)} disabled={!!exportLoading}
                  className={'flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border transition-colors text-left ' + (exportLoading === o.fmt ? 'bg-zinc-50 border-zinc-200 cursor-wait' : 'border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50/30')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{exportLoading === o.fmt ? '⏳' : o.icon}</span>
                    <span className="text-xs font-medium text-zinc-700">{o.label}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 ml-7">{o.desc}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setExportDialog(false)} className="mt-3 w-full text-xs text-zinc-400 hover:text-zinc-600 py-2 transition-colors">取消</button>
          </div>
        </div>
      )}
    </>
  );
}

function ChartBody({ chartType, data, xKey, yKey, sX, sY, radar, numericCols, gradient, animate }: {
  chartType: ChartType; data: RowData[]; xKey: string; yKey: string;
  sX: string; sY: string; radar: RowData[]; numericCols: ColumnDef[];
  gradient: boolean; animate: boolean;
}) {
  const g = <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" strokeOpacity={0.6} />;
  const xx = <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false} />;
  const yy = <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
    tickFormatter={(v: any) => { const n = Number(v ?? 0); return Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + 'w' : n.toFixed(0); }} />;
  const tt = <Tooltip content={<CustomTooltip />} />;
  const lg = <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />;
  const anim = animate;
  const gid = 'cg-' + chartType;
  const lf = (v: any) => Number(v ?? 0).toFixed(2);

  switch (chartType) {
    case 'pie':
      return (
        <PieChart>
          <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="68%"
            innerRadius={gradient ? '30%' : 0}
            label={({ name, value }: any) => name + ': ' + Number(value ?? 0).toFixed(2)}
            labelLine={{ stroke: '#d4d4d8', strokeWidth: 1 }}
            isAnimationActive={anim} animationDuration={600} animationEasing="ease-out">
            {data.map((_, i) => <Cell key={i} fill={COLORS_ARR[i % COLORS_ARR.length]} stroke="white" strokeWidth={gradient ? 2 : 0} />)}
          </Pie>
          {tt}{lg}
        </PieChart>
      );
    case 'line':
      return (
        <LineChart data={data} margin={{ top: 20, right: 12, bottom: 4, left: -8 }}>
          {g}{xx}{yy}{tt}{lg}
          <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2.5}
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 1.5, stroke: '#fff' }}
            activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={anim} animationDuration={700} animationEasing="ease-out">
            <LabelList dataKey={yKey} position="top" fontSize={10} fill="#52525b" formatter={lf} />
          </Line>
        </LineChart>
      );
    case 'area':
      return (
        <AreaChart data={data} margin={{ top: 20, right: 12, bottom: 4, left: -8 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs>
          {g}{xx}{yy}{tt}
          <Area type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2}
            fill={gradient ? 'url(#' + gid + ')' : '#6366f1'} fillOpacity={gradient ? 1 : 0.08}
            dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={anim} animationDuration={700} animationEasing="ease-out" />
        </AreaChart>
      );
    case 'radar':
      return (
        <RadarChart data={radar} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <PolarGrid stroke="#e4e4e7" />
          <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#71717a' }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: '#a1a1aa' }} tickFormatter={(v: any) => fmt(Number(v))} />
          {tt}
          <Radar name={numericCols.find(c => c.key === yKey)?.title || yKey} dataKey={yKey}
            stroke="#6366f1" fill="#6366f1" fillOpacity={gradient ? 0.15 : 0.06} strokeWidth={1.5}
            isAnimationActive={anim} animationDuration={600} animationEasing="ease-out" />
        </RadarChart>
      );
    case 'scatter':
      return (
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {g}
          <XAxis dataKey={sX} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={{ stroke: '#e4e4e7' }} tickLine={false}
            name={numericCols.find(c => c.key === sX)?.title || sX} />
          <YAxis dataKey={sY} tick={{ fontSize: 11, fill: '#a1a1aa' }} axisLine={false} tickLine={false}
            name={numericCols.find(c => c.key === sY)?.title || sY} />
          {tt}
          <Scatter data={data} fill="#6366f1" fillOpacity={0.7} stroke="transparent"
            isAnimationActive={anim} animationDuration={700} animationEasing="ease-out"
            shape={({ cx, cy }: any) => <circle cx={cx} cy={cy} r={5} fill="#6366f1" fillOpacity={0.6} stroke="white" strokeWidth={1.5} />} />
        </ScatterChart>
      );
    default:
      return (
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 4, left: -8 }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} /><stop offset="100%" stopColor="#818cf8" stopOpacity={gradient ? 0.4 : 0.85} /></linearGradient></defs>
          {g}{xx}{yy}{tt}
          <Bar dataKey={yKey} fill={gradient ? 'url(#' + gid + ')' : '#6366f1'} radius={[4, 4, 0, 0]} maxBarSize={32}
            isAnimationActive={anim} animationDuration={500} animationEasing="ease-out">
            {data.length <= 30 && <LabelList dataKey={yKey} position="top" fontSize={10} fill="#52525b" formatter={lf} />}
          </Bar>
        </BarChart>
      );
  }
}
