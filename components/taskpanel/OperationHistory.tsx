'use client';

import { HistoryItem } from '@/lib/types';

interface OperationHistoryProps {
  history: HistoryItem[];
  onItemClick?: (item: HistoryItem) => void;
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  const h = Math.floor(min / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  return d + ' 天前';
}

export default function OperationHistory({
  history,
  onItemClick,
}: OperationHistoryProps) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span className="text-sm font-semibold text-zinc-800">操作记录</span>
        <span className="text-[11px] text-zinc-400 ml-auto">{history.length}</span>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-zinc-400 py-6 text-center">暂无操作记录</p>
      ) : (
        <div className="space-y-1.5">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={function () { if (onItemClick) onItemClick(item); }}
              className={'rounded-lg bg-white px-3 py-2.5 transition-all duration-150 border border-transparent ' + ((item.resultData || item.resultSummary) ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm' : 'cursor-default')}
            >
              {/* 任务名称 */}
              <p className="text-xs font-medium text-zinc-800 leading-relaxed">{item.action}</p>
              {/* 文件 + 时间 */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-zinc-400 truncate max-w-[140px]">
                  {item.targetFiles.join('、')}
                </span>
                <span className="text-[10px] text-zinc-300 shrink-0 ml-1">
                  {formatTimeAgo(item.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
