// ============================================================
// Verification Panel — 验证结果面板
// ============================================================
// 展示 PASS/FAIL、Confidence、每条检查详情
// ============================================================

'use client';

interface VerificationCheckDisplay {
  name: string;
  passed: boolean;
  detail: string;
  confidence?: number;
}

interface VerificationPanelProps {
  passed: boolean;
  confidence: number;
  checks: VerificationCheckDisplay[];
  stats?: Record<string, unknown>;
  operationLabel?: string;
}

export default function VerificationPanel({ passed, confidence, checks, stats, operationLabel }: VerificationPanelProps) {
  if (!checks || checks.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-zinc-50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400">暂无验证信息</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
          passed ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{passed ? '✓' : '✗'}</span>
          <span>{passed ? '验证通过' : '验证失败'}</span>
        </div>
        <div className="text-xs text-zinc-500">
          置信度 <span className="font-semibold text-zinc-700">{(confidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Stats section */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          {renderStat(stats, 'matchRate', '匹配率', '%')}
          {renderStat(stats, 'removedCount', '删除行', '')}
          {renderStat(stats, 'groupCount', '分组数', '')}
          {renderStat(stats, 'dedupRemoved', '去重行', '')}
          {renderStat(stats, 'modifiedCount', '修改行', '')}
          {renderStat(stats, 'matchCount', '匹配行', '')}
          {renderStat(stats, 'unmatchedCount', '未匹配', '')}
        </div>
      )}

      {/* Check details */}
      <div className="space-y-1.5">
        {checks.map((check, i) => (
          <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
            check.passed ? 'bg-green-50/50 text-green-800' : 'bg-red-50/50 text-red-800'
          }`}>
            <span className="shrink-0 mt-0.5">{check.passed ? '✓' : '✗'}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{check.name}</p>
              <p className="text-zinc-500 mt-0.5">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStat(stats: Record<string, unknown>, key: string, label: string, suffix: string) {
  const val = stats[key];
  if (val === undefined || val === null) return null;
  const display = typeof val === 'number' && key === 'matchRate'
    ? ((val as number) * 100).toFixed(0)
    : String(val);
  return (
    <div key={key} className="bg-zinc-50 rounded-lg p-2 text-center border border-zinc-100">
      <div className="text-sm font-bold text-zinc-700">{display}{suffix}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}
