// ============================================================
// Data Profile Panel — 数据画像面板
// ============================================================
// 执行前展示：行数、列数、类型分布、每列详情
// ============================================================

'use client';

interface ProfileColumnDisplay {
  title: string;
  type: string;
  nullRate: number;
  uniqueRate: number;
  sampleValues: unknown[];
  min?: number;
  max?: number;
  avg?: number;
}

interface DataProfilePanelProps {
  rowCount: number;
  columnCount: number;
  columns: ProfileColumnDisplay[];
  typeDistribution: Record<string, number>;
}

export default function DataProfilePanel({ rowCount, columnCount, columns, typeDistribution }: DataProfilePanelProps) {
  if (!rowCount && !columnCount) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-zinc-50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" /><path d="M9 21V9" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400">选择数据后，此处将展示数据画像</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="数据行" value={rowCount} icon="📊" />
        <SummaryCard label="数据列" value={columnCount} icon="📋" />
      </div>

      {/* Type distribution */}
      {Object.keys(typeDistribution).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-2">类型分布</p>
          <div className="flex gap-2">
            {Object.entries(typeDistribution).map(([type, count]) => (
              <TypeDistributionCard key={type} type={type} count={count} total={columnCount} />
            ))}
          </div>
        </div>
      )}

      {/* Column details */}
      {columns.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-2">列详情</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {columns.map((col, i) => (
              <ColumnDetailCard key={i} col={col} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-lg font-bold text-zinc-800">{value.toLocaleString()}</div>
        <div className="text-[10px] text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

function TypeDistributionCard({ type, count, total }: { type: string; count: number; total: number }) {
  const colors: Record<string, string> = {
    number: 'bg-blue-500',
    string: 'bg-purple-500',
    date: 'bg-cyan-500',
  };
  const labels: Record<string, string> = {
    number: '数值列',
    string: '文本列',
    date: '日期列',
  };
  return (
    <div className="flex-1 bg-zinc-50 rounded-lg p-2.5 border border-zinc-100 text-center">
      <div className={`text-sm font-bold ${colors[type] ? 'text-zinc-800' : 'text-zinc-800'}`}>{count}</div>
      <div className="text-[10px] text-zinc-500">{labels[type] || type}</div>
      <div className="mt-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[type] || 'bg-zinc-400'}`}
          style={{ width: `${(count / Math.max(total, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ColumnDetailCard({ col }: { col: ProfileColumnDisplay }) {
  const typeColors: Record<string, string> = {
    number: 'bg-blue-100 text-blue-700',
    string: 'bg-purple-100 text-purple-700',
    date: 'bg-cyan-100 text-cyan-700',
    unknown: 'bg-zinc-100 text-zinc-600',
  };
  const typeLabels: Record<string, string> = {
    number: 'N',
    string: 'S',
    date: 'D',
    unknown: '?',
  };

  return (
    <div className="bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] px-1 py-0.5 rounded font-mono font-bold ${typeColors[col.type] || typeColors.unknown}`}>
          {typeLabels[col.type] || '?'}
        </span>
        <span className="text-xs font-medium text-zinc-800">{col.title}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
        {col.nullRate > 0 && <span>空值 {(col.nullRate * 100).toFixed(0)}%</span>}
        <span>唯一 {(col.uniqueRate * 100).toFixed(0)}%</span>
        {col.avg !== undefined && <span>均值 {col.avg.toFixed(1)}</span>}
        {col.min !== undefined && <span>最小 {col.min}</span>}
        {col.max !== undefined && <span>最大 {col.max}</span>}
      </div>

      {col.sampleValues.length > 0 && (
        <div className="mt-1 flex gap-1 flex-wrap">
          {col.sampleValues.map((v, j) => (
            <span key={j} className="text-[10px] bg-white rounded px-1.5 py-0.5 border border-zinc-200 text-zinc-600">
              {String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
