// ============================================================
// Performance Monitor — 性能监控
// ============================================================
// 统计 NLU / Repair / Execution / Verification / Explain 耗时
// ============================================================

'use client';

interface PerformanceEntry {
  stage: string;
  durationMs: number;
  label: string;
}

interface PerformanceMonitorProps {
  entries: PerformanceEntry[];
  totalDuration?: number;
}

const STAGE_COLORS: Record<string, string> = {
  NLU: 'bg-blue-500',
  Profile: 'bg-purple-500',
  Repair: 'bg-amber-500',
  Execute: 'bg-green-500',
  Verify: 'bg-cyan-500',
  Explain: 'bg-pink-500',
};

export default function PerformanceMonitor({ entries, totalDuration }: PerformanceMonitorProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-[11px] text-zinc-400">暂无性能数据</p>
      </div>
    );
  }

  const maxDuration = Math.max(...entries.map(e => e.durationMs), 1);

  return (
    <div className="p-3 space-y-2">
      {/* Total */}
      {totalDuration !== undefined && (
        <div className="flex items-center justify-between text-xs text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100 mb-2">
          <span className="font-medium">总耗时</span>
          <span className="font-mono font-bold text-zinc-800">{totalDuration}ms</span>
        </div>
      )}

      {/* Per-stage bars */}
      {entries.map((entry, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-600">{entry.label}</span>
            <span className="font-mono text-zinc-500">{entry.durationMs}ms</span>
          </div>
          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${STAGE_COLORS[entry.stage] || 'bg-zinc-400'}`}
              style={{ width: `${(entry.durationMs / maxDuration) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
