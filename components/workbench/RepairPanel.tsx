// ============================================================
// Repair Panel — 修复详情面板
// ============================================================
// 展示系统自动修复了什么，置信度多高
// ============================================================

'use client';

interface RepairRecordDisplay {
  action: string;
  target: string;
  original: unknown;
  repaired: unknown;
  confidence: number;
  category: 'auto' | 'suggest';
  detail: string;
}

interface RepairPanelProps {
  repairs: RepairRecordDisplay[];
  successCount: number;
  failCount: number;
  summary: string;
}

const ACTION_LABELS: Record<string, string> = {
  COLUMN_FUZZY_MATCH: '列名模糊匹配',
  VALUE_TO_COLUMN: '值→列反推',
  VALUE_NORMALIZE: '值规范化',
  TYPE_CONVERT: '类型转换',
  JOIN_KEY_MAP: 'Join 映射',
  FORMULA_PARSE: '公式解析',
  NULL_HANDLE: '空值处理',
  COLUMN_INFER: '列推断',
};

export default function RepairPanel({ repairs, successCount, failCount, summary }: RepairPanelProps) {
  if (!repairs || repairs.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <p className="text-xs text-zinc-500">无需修复</p>
      </div>
    );
  }

  const autoRepairs = repairs.filter(r => r.category === 'auto');
  const suggestRepairs = repairs.filter(r => r.category === 'suggest');

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
        <span className="font-medium">修复摘要：</span>
        {summary}
      </div>

      {/* Stats */}
      <div className="flex gap-2">
        <div className="flex-1 bg-green-50 rounded-lg p-2.5 border border-green-100 text-center">
          <div className="text-lg font-bold text-green-700">{successCount}</div>
          <div className="text-[10px] text-green-600">自动修复</div>
        </div>
        {failCount > 0 && (
          <div className="flex-1 bg-amber-50 rounded-lg p-2.5 border border-amber-100 text-center">
            <div className="text-lg font-bold text-amber-700">{failCount}</div>
            <div className="text-[10px] text-amber-600">待确认</div>
          </div>
        )}
      </div>

      {/* Auto repairs */}
      {autoRepairs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-2">自动修复 ({autoRepairs.length})</p>
          <div className="space-y-2">
            {autoRepairs.map((r, i) => (
              <RepairCard key={i} repair={r} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested repairs */}
      {suggestRepairs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 mb-2">建议修复 ({suggestRepairs.length})</p>
          <div className="space-y-2">
            {suggestRepairs.map((r, i) => (
              <RepairCard key={i} repair={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RepairCard({ repair }: { repair: RepairRecordDisplay }) {
  const actionLabel = ACTION_LABELS[repair.action] || repair.action;
  const confidence = (repair.confidence * 100).toFixed(0);
  const isAuto = repair.category === 'auto';

  return (
    <div className={`rounded-lg border p-2.5 ${
      isAuto ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          isAuto ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isAuto ? '自动' : '建议'}
        </span>
        <span className="text-[11px] text-zinc-500">{actionLabel}</span>
        <span className="text-[10px] text-zinc-400 ml-auto">置信度 {confidence}%</span>
      </div>

      {repair.original !== repair.repaired && (
        <div className="flex items-center gap-2 text-xs mt-1">
          <span className="text-zinc-500 line-through">{String(repair.original)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isAuto ? '#059669' : '#d97706'} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span className="text-zinc-800 font-medium">{String(repair.repaired)}</span>
        </div>
      )}

      {repair.detail && (
        <p className="text-[11px] text-zinc-500 mt-1">{repair.detail}</p>
      )}
    </div>
  );
}
