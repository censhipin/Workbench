'use client';

import { ColumnDef, RowData } from '@/lib/types';
import DataTable from '@/components/common/DataTable';
// HistoryItem type is defined locally - no import needed

interface HistoryItemType {
  id: string;
  action: string;
  timestamp: string;
  targetFiles: string[];
  resultData?: { columns: ColumnDef[]; rows: RowData[] } | null;
  resultSummary?: { totalRecords?: number; matchedCount?: number; unmatchedCount?: number; deletedCount?: number; modifiedCount?: number; beforeCount?: number; afterCount?: number; details?: { label: string; before: number; after: number; deleted: number; selected: boolean }[] } | null;
}

interface OperationHistoryModalProps {
  history: HistoryItemType[];
  onClose: () => void;
  onItemClick: (item: HistoryItemType) => void;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
}

export default function OperationHistoryModal({ history, onClose, onItemClick }: OperationHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 className="text-base font-semibold text-zinc-800">操作历史</h2>
            <span className="text-xs text-zinc-400">{history.length} 条记录</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {history.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">暂无操作历史</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  className="flex items-start gap-4 px-4 py-3 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all cursor-pointer group"
                >
                  {/* Time */}
                  <div className="shrink-0 w-20 pt-0.5">
                    <span className="text-[11px] text-zinc-400 font-mono">{formatTime(item.timestamp)}</span>
                  </div>

                  {/* File + action */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-blue-600 font-medium shrink-0">{item.targetFiles.join('、')}</span>
                      <span className="text-zinc-300 text-[10px]">→</span>
                    </div>
                    <p className="text-sm text-zinc-800 mt-0.5">{item.action}</p>
                  </div>

                  {/* Has data indicator */}
                  <div className="shrink-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.resultData && (
                      <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                        {item.resultData.rows.length}行
                      </span>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-300">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-zinc-100 shrink-0">
          <p className="text-[11px] text-zinc-400">点击任意记录查看详情，已删除文件的数据可查看但不可继续操作。</p>
        </div>
      </div>
    </div>
  );
}

// Export for page.tsx usage
export type { HistoryItemType };
