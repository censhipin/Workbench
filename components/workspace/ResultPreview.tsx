'use client';

import { useState } from 'react';
import { ColumnDef, RowData, ResultSummary } from '@/lib/types';
import DataTable from '@/components/common/DataTable';
import EmptyState from '@/components/common/EmptyState';
import Badge from '@/components/common/Badge';

interface ResultPreviewProps {
  columns: ColumnDef[];
  rows: RowData[];
  summary: ResultSummary | null;
  showDiff: boolean;
  onToggleDiff: () => void;
  beforeData?: { columns: ColumnDef[]; rows: RowData[] } | null;
  onExport?: () => void;
  flexBasis?: string;
  resetKey?: string | number;
  error?: string | null;
  isRunning?: boolean;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onRowReorder?: (fromIndex: number, toIndex: number) => void;
}

export default function ResultPreview({ columns, rows, summary, beforeData, onExport, flexBasis = '1', resetKey, error, isRunning, onColumnReorder, onRowReorder }: ResultPreviewProps) {
  const hasResult = rows.length > 0;
  const [fullscreen, setFullscreen] = useState(false);

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
            <div className="h-full"><DataTable columns={columns} rows={rows} maxHeight="100%" resetKey={resetKey} onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} /></div>
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
              <h2 className="text-base font-semibold text-zinc-800">数据查看器</h2>
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
              <button onClick={onExport} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">
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
            <DataTable columns={columns} rows={rows} maxHeight="100%" onColumnReorder={onColumnReorder} onRowReorder={onRowReorder} />
          </div>
          <div className="flex items-center gap-4 px-6 py-2.5 border-t border-zinc-200 shrink-0 text-xs text-zinc-400">
            <span>总行数：{rows.length}</span>
            <span>总列数：{columns.length}</span>
            {summary?.beforeCount !== undefined && <span>处理前：{summary.beforeCount} 行</span>}
            {summary?.afterCount !== undefined && <span>处理后：{summary.afterCount} 行</span>}
          </div>
        </div>
      )}
    </>
  );
}
