// ============================================================
// Quality Panel — 数据质量面板
// ============================================================
// 展示 Profile 中的质量指标
// ============================================================

'use client';

interface QualityColumn {
  columnKey: string;
  title: string;
  type: string;
  nullRate: number;
  uniqueRate: number;
  nullCount: number;
  min?: number;
  max?: number;
  avg?: number;
}

interface QualityPanelProps {
  rowCount: number;
  columnCount: number;
  nullRate: number;
  duplicateRate: number;
  suggestions: number;
  columns: QualityColumn[];
}

export default function QualityPanel({
  rowCount, columnCount, nullRate, duplicateRate, suggestions, columns,
}: QualityPanelProps) {
  if (!rowCount && !columnCount) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-zinc-50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400">暂无数据质量信息</p>
      </div>
    );
  }

  const qualityScore = computeQualityScore(nullRate, duplicateRate);
  const stars = Math.round(qualityScore / 20);

  return (
    <div className="p-3 space-y-3">
      {/* Quality score */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`text-2xl font-bold ${
          qualityScore >= 80 ? 'text-green-600' : qualityScore >= 60 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {qualityScore}%
        </div>
        <div className="text-lg">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="数据行" value={rowCount} />
        <MetricCard label="数据列" value={columnCount} />
        <MetricCard label="空值率" value={`${(nullRate * 100).toFixed(1)}%`} severity={nullRate > 0.1 ? 'warn' : 'good'} />
        <MetricCard label="重复率" value={`${(duplicateRate * 100).toFixed(1)}%`} severity={duplicateRate > 0.05 ? 'warn' : 'good'} />
        <MetricCard label="建议项" value={suggestions} severity={suggestions > 0 ? 'warn' : 'good'} />
      </div>

      {/* Column details */}
      {columns.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-2">列详情 ({columns.length})</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {columns.map((col, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-zinc-50 rounded px-2 py-1.5 border border-zinc-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TypeBadge type={col.type} />
                  <span className="text-zinc-700 truncate">{col.title}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 shrink-0 ml-2">
                  {col.nullRate > 0 && <span title="空值率">∅ {(col.nullRate * 100).toFixed(0)}%</span>}
                  {col.avg !== undefined && <span title="平均值">μ{col.avg.toFixed(0)}</span>}
                  {col.min !== undefined && <span title="范围">{col.min}~{col.max}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, severity }: { label: string; value: string | number; severity?: 'good' | 'warn' }) {
  return (
    <div className={`rounded-lg p-2.5 border text-center ${
      severity === 'warn' ? 'bg-amber-50 border-amber-200' :
      severity === 'good' ? 'bg-green-50 border-green-200' :
      'bg-zinc-50 border-zinc-100'
    }`}>
      <div className={`text-sm font-bold ${severity === 'warn' ? 'text-amber-700' : 'text-zinc-700'}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    number: 'bg-blue-100 text-blue-700',
    string: 'bg-purple-100 text-purple-700',
    date: 'bg-cyan-100 text-cyan-700',
  };
  const labels: Record<string, string> = {
    number: 'N',
    string: 'S',
    date: 'D',
  };
  return (
    <span className={`text-[10px] px-1 py-0.5 rounded font-mono font-bold ${colors[type] || 'bg-zinc-100 text-zinc-600'}`}>
      {labels[type] || '?'}
    </span>
  );
}

function computeQualityScore(nullRate: number, duplicateRate: number): number {
  const nullScore = Math.max(0, 100 - nullRate * 200);
  const dupScore = Math.max(0, 100 - duplicateRate * 500);
  return Math.round((nullScore + dupScore) / 2);
}
