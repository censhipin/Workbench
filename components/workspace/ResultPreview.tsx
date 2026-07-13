'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ColumnDef, RowData, ResultSummary } from '@/lib/types';
import { TABLE_STYLES } from '@/lib/tableStyles';
import { exportData } from '@/lib/file-engine';
import type { ExportFormat } from '@/lib/file-engine';
import DataTable from '@/components/common/DataTable';
import ChartView from '@/components/common/ChartView';
import EmptyState from '@/components/common/EmptyState';
import Badge from '@/components/common/Badge';

interface ResultPreviewProps {
  columns: ColumnDef[];
  rows: RowData[];
  summary: ResultSummary | null;
  showDiff: boolean;
  onToggleDiff: () => void;
  beforeData?: { columns: ColumnDef[]; rows: RowData[] } | null;
  flexBasis?: string;
  resetKey?: string | number;
  error?: string | null;
  isRunning?: boolean;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onRowReorder?: (fromIndex: number, toIndex: number) => void;
  arrangeMode?: boolean;
  onToggleArrange?: () => void;
  fileName?: string;
  sheetName?: string;
  operation?: string;
  exportFileName?: string;
}

export default function ResultPreview({ columns, rows, summary, beforeData, flexBasis = '1', resetKey, error, isRunning, onColumnReorder: externalColReorder, onRowReorder, arrangeMode, onToggleArrange, fileName, sheetName, operation, exportFileName }: ResultPreviewProps) {
  const hasResult = rows.length > 0;
  const [fullscreen, setFullscreen] = useState(false);
  const [localColumns, setLocalColumns] = useState<ColumnDef[] | null>(null);
  const [localRows, setLocalRows] = useState<RowData[] | null>(null);
  const [styleIndex, setStyleIndex] = useState(-1);
  const [styleOpen, setStyleOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const styleRef = useRef<HTMLDivElement>(null);
  const displayColumns = localColumns || columns;
  const displayRows = localRows || rows;

  useEffect(function () {
    function onClick(e: MouseEvent) {
      if (styleRef.current && !styleRef.current.contains(e.target as Node)) setStyleOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return function () { document.removeEventListener('mousedown', onClick); };
  }, []);

  const handleColumnReorder = useCallback(function (fromIndex: number, toIndex: number) {
    var cols = (localColumns || columns).slice();
    var moved = cols.splice(fromIndex, 1)[0];
    cols.splice(toIndex, 0, moved);
    setLocalColumns(cols);
    if (externalColReorder) externalColReorder(fromIndex, toIndex);
  }, [localColumns, columns, externalColReorder]);

  const handleRowReorder = useCallback(function (fromIndex: number, toIndex: number) {
    var rs = (localRows || rows).slice();
    var moved = rs.splice(fromIndex, 1)[0];
    rs.splice(toIndex, 0, moved);
    setLocalRows(rs);
    if (onRowReorder) onRowReorder(fromIndex, toIndex);
  }, [localRows, rows, onRowReorder]);

  const handleExportWithFormat = useCallback(function (format: ExportFormat) {
    var baseName = (exportFileName || '导出数据').replace(/\.(xlsx|csv|json)$/, '');
    var name = baseName + '.' + format;
    var style = styleIndex >= 0 ? TABLE_STYLES[styleIndex] : undefined;
    exportData([{ name: 'Sheet1', columns: displayColumns, rows: displayRows }], name, format, style);
  }, [exportFileName, displayColumns, displayRows, styleIndex]);

  return (
    <>
      <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: flexBasis }}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">结果预览</span>
            {hasResult && <span className="text-[11px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{rows.length} 行 x {columns.length} 列</span>}
          </div>
          {hasResult && (
            <div className="flex items-center gap-1.5">
              {onToggleArrange && (
                <button
                  onClick={onToggleArrange}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors shrink-0 ${arrangeMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-zinc-500 border-transparent hover:bg-zinc-100'}`}
                  title={arrangeMode ? '退出排列模式' : '排列模式 — 拖动行列'}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                  </svg>
                  排列
                </button>
              )}
              <button onClick={() => setShowChart(v => !v)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors shrink-0 ${showChart ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-zinc-500 border-transparent hover:bg-zinc-100'}`} title={showChart ? '切换到表格' : '图表展示'}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
                {showChart ? '表格' : '图表'}
              </button>
              <button onClick={() => setFullscreen(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md text-zinc-500 hover:bg-zinc-100 border border-transparent transition-colors" title="全屏查看">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>
                全屏
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-4 pt-2 pb-3">
          {isRunning ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg className="animate-spin text-blue-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2a10 10 0 1010 10" />
              </svg>
              <span className="text-sm text-zinc-500">处理中...</span>
            </div>
          ) : hasResult ? (
            showChart ? (
              <div className="h-full"><ChartView columns={displayColumns} rows={displayRows} /></div>
            ) : (
              <div className="h-full"><DataTable columns={displayColumns} rows={displayRows} maxHeight="100%" resetKey={resetKey} onColumnReorder={handleColumnReorder} onRowReorder={handleRowReorder} resizable={true} editMode={arrangeMode ? 'editing' : 'locked'} /></div>
            )
          ) : error ? (
              <EmptyState icon="⚠️" title="执行失败" description={error} />
            ) : (
            <EmptyState icon="✨" title="暂无结果" description="输入数据处理指令后，结果将在此展示" />
          )}
        </div>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-zinc-800 truncate max-w-[500px]" title={(fileName ? fileName + ' — ' : '') + (operation || '数据查看')}>
                {fileName}{sheetName ? ' / ' + sheetName : ''}{operation ? ' — ' + operation : ''}
              </h2>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">{rows.length} 行 x {columns.length} 列</span>
              {summary && (
                <div className="flex items-center gap-1.5 ml-2">
                  {summary.deletedCount !== undefined && <span className="text-[10px] text-red-500">删除 {summary.deletedCount}</span>}
                  {summary.matchedCount !== undefined && <span className="text-[10px] text-emerald-500">匹配 {summary.matchedCount}</span>}
                  {summary.modifiedCount !== undefined && summary.modifiedCount > 0 && <span className="text-[10px] text-blue-500">修改 {summary.modifiedCount}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={styleRef}>
                <button
                  onClick={() => setStyleOpen(!styleOpen)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                  title="表格样式"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  样式
                  {styleIndex >= 0 && (
                    <span className="w-3 h-3 rounded inline-block" style={{ background: TABLE_STYLES[styleIndex].headerBg }} />
                  )}
                </button>
                {styleOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 w-52 max-h-80 overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] text-zinc-400 font-medium">表格样式</div>
                    {TABLE_STYLES.map(function (s, i) {
                      return (
                        <button
                          key={i}
                          onClick={() => { setStyleIndex(i); setStyleOpen(false); }}
                          className={'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ' + (styleIndex === i ? 'bg-blue-50 text-blue-700' : 'text-zinc-600 hover:bg-zinc-50')}
                        >
                          <div className="flex items-center gap-0.5 rounded overflow-hidden border shrink-0" style={{ borderColor: s.borderColor }}>
                            <div className="w-4 h-4 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: s.headerBg }}>A</div>
                            <div className="w-4 h-4" style={{ background: s.rowEvenBg }} />
                            <div className="w-4 h-4" style={{ background: s.rowOddBg }} />
                          </div>
                          {s.name}
                        </button>
                      );
                    })}
                    {styleIndex >= 0 && (
                      <button
                        onClick={() => { setStyleIndex(-1); setStyleOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 border-t border-zinc-100 mt-1 pt-1.5"
                      >
                        清除样式
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setExportDialog(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                导出
              </button>
              <button onClick={() => setFullscreen(false)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                关闭
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-6">
            <DataTable columns={displayColumns} rows={rows} maxHeight="100%" onColumnReorder={handleColumnReorder} onRowReorder={onRowReorder} resizable={true} stylePreset={styleIndex >= 0 ? TABLE_STYLES[styleIndex] : undefined} />
          </div>
          <div className="flex items-center gap-4 px-6 py-2.5 border-t border-zinc-200 shrink-0 text-xs text-zinc-400">
            <span>总行数：{rows.length}</span>
            <span>总列数：{columns.length}</span>
            {summary?.beforeCount !== undefined && <span>处理前：{summary.beforeCount} 行</span>}
            {summary?.afterCount !== undefined && <span>处理后：{summary.afterCount} 行</span>}
          </div>
        </div>
      )}

      {exportDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setExportDialog(false)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-6 py-5 w-72 max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-zinc-800 mb-3">导出数据</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setExportDialog(false); handleExportWithFormat('xlsx'); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-200 hover:border-blue-200 hover:bg-blue-50/30 transition-colors text-left"
              >
                <span className="text-lg shrink-0">📗</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-700">Excel (.xlsx) <span className="text-[10px] text-blue-500 font-normal">推荐</span></div>
                  <div className="text-[10px] text-zinc-400">用于日常办公</div>
                </div>
              </button>
              <button
                onClick={() => { setExportDialog(false); handleExportWithFormat('csv'); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-200 hover:border-green-200 hover:bg-green-50/30 transition-colors text-left"
              >
                <span className="text-lg shrink-0">📄</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-700">CSV (.csv)</div>
                  <div className="text-[10px] text-zinc-400">用于数据分析和系统导入</div>
                </div>
              </button>
              <button
                onClick={() => { setExportDialog(false); handleExportWithFormat('json'); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-200 hover:border-amber-200 hover:bg-amber-50/30 transition-colors text-left"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-amber-500" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-700">JSON (.json)</div>
                  <div className="text-[10px] text-zinc-400">用于开发和接口调用</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
