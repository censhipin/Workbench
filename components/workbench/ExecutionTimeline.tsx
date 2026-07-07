// ============================================================
// Execution Timeline — 执行时间轴
// ============================================================
// 显示每个阶段的开始时间、耗时、状态
// ============================================================

'use client';

interface TimelineEntry {
  stage: string;
  time: string;
  duration: number;
  status: 'ok' | 'failed';
  detail?: string;
}

interface ExecutionTimelineProps {
  entries: TimelineEntry[];
  totalDuration?: number;
}

export default function ExecutionTimeline({ entries, totalDuration }: ExecutionTimelineProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-zinc-400">执行时间轴将在此处展示</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {/* Total time */}
      {totalDuration !== undefined && (
        <div className="flex items-center justify-between text-xs text-zinc-600 mb-3 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100">
          <span className="font-medium">总耗时</span>
          <span className="font-mono font-bold text-zinc-800">{totalDuration}ms</span>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-3 pb-3 relative">
            {/* Timeline connector */}
            {i < entries.length - 1 && (
              <div className="absolute left-2.5 top-5 w-0.5 h-[calc(100%-8px)] bg-zinc-200" />
            )}

            {/* Dot */}
            <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center mt-0.5
              ${entry.status === 'ok' ? 'bg-green-100' : 'bg-red-100'}
            `}>
              <div className={`w-2 h-2 rounded-full ${entry.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-800">{entry.stage}</span>
                <span className="text-[10px] text-zinc-400 font-mono">{entry.time}</span>
                <span className="text-[10px] text-zinc-400 ml-auto">{entry.duration}ms</span>
              </div>
              {entry.detail && (
                <p className="text-[11px] text-zinc-500 mt-0.5">{entry.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
