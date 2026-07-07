// ============================================================
// Explanation Panel — 智能解释面板（替代弹窗）
// ============================================================
// 展示：Title / Summary / Detail / Warnings / Suggestions / AutoFix
// ============================================================

'use client';

import type { ExecutionExplanation } from '@/lib/v3/explain';

interface ExplanationPanelProps {
  explanation: ExecutionExplanation | null;
}

export default function ExplanationPanel({ explanation }: ExplanationPanelProps) {
  if (!explanation) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-zinc-50 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
        </div>
        <p className="text-xs text-zinc-400">执行后，此处将展示详细解释</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 max-h-[50vh] overflow-y-auto">
      {/* Title */}
      <div className="flex items-center gap-2">
        <TitleIcon title={explanation.title} />
        <h3 className="text-sm font-semibold text-zinc-800">{explanation.title}</h3>
      </div>

      {/* Summary */}
      <p className="text-xs text-zinc-600 leading-relaxed">{explanation.summary}</p>

      {/* Detail */}
      {explanation.detail.length > 0 && (
        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 space-y-1">
          <p className="text-[11px] font-semibold text-zinc-600 mb-1">详细过程</p>
          {explanation.detail.map((line, i) => (
            <p key={i} className="text-[11px] text-zinc-600 leading-relaxed">{line}</p>
          ))}
        </div>
      )}

      {/* Auto-fix */}
      {explanation.autoFixSummary.length > 0 && (
        <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-1">
          <p className="text-[11px] font-semibold text-green-700 mb-1">自动修复</p>
          {explanation.autoFixSummary.map((line, i) => (
            <p key={i} className="text-[11px] text-green-700 leading-relaxed">{line}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {explanation.warnings.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 space-y-1">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">警告</p>
          {explanation.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-700 leading-relaxed">{w}</p>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {explanation.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-zinc-600">建议</p>
          {explanation.suggestions.map((s, i) => (
            <p key={i} className="text-[11px] text-zinc-500 leading-relaxed flex items-start gap-1.5">
              <span className="text-zinc-400 mt-0.5">•</span>
              <span>{s}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function TitleIcon({ title }: { title: string }) {
  if (title.includes('失败')) return <span className="text-red-500">✗</span>;
  return <span className="text-green-500">✓</span>;
}
