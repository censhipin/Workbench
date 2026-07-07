// ============================================================
// Error Dialog V3 — 结构化错误弹窗
// ============================================================
// 不再显示原始错误字符串，而是结构化展示：
//   错误标题 / 原因 / 影响 / 建议 / 自动修复 / 详情
// ============================================================

'use client';

import type { ExecutionExplanation } from '@/lib/v3/explain';

interface ErrorDialogV3Props {
  explanation: ExecutionExplanation;
  onDismiss: () => void;
  onShowDetail?: () => void;
}

export default function ErrorDialogV3({ explanation, onDismiss }: ErrorDialogV3Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh]" onClick={onDismiss}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 w-[520px] max-w-[90vw] max-h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3">

          {/* 错误标题 */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-800">{explanation.title}</h3>
          </div>

          {/* 摘要 */}
          <p className="text-xs text-zinc-600 mt-3 ml-10 leading-relaxed">{explanation.summary}</p>

          {/* 错误详情 */}
          {explanation.detail.length > 0 && (
            <div className="mt-3 ml-10 p-3 rounded-lg bg-red-50 border border-red-100 space-y-1">
              {explanation.detail.map((line, i) => (
                <p key={i} className="text-xs text-red-700 leading-relaxed">{line}</p>
              ))}
            </div>
          )}

          {/* 自动修复 */}
          {explanation.autoFixSummary.length > 0 && (
            <div className="mt-3 ml-10 p-3 rounded-lg bg-green-50 border border-green-200 space-y-1">
              <p className="text-[11px] font-semibold text-green-700">自动修复</p>
              {explanation.autoFixSummary.map((line, i) => (
                <p key={i} className="text-xs text-green-700 leading-relaxed">{line}</p>
              ))}
            </div>
          )}

          {/* 警告 */}
          {explanation.warnings.length > 0 && (
            <div className="mt-3 ml-10 p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
              <p className="text-[11px] font-semibold text-amber-800">警告</p>
              {explanation.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 leading-relaxed">{w}</p>
              ))}
            </div>
          )}

          {/* 建议 */}
          {explanation.suggestions.length > 0 && (
            <div className="mt-3 ml-10 space-y-1">
              <p className="text-[11px] font-semibold text-zinc-600">建议</p>
              {explanation.suggestions.map((s, i) => (
                <p key={i} className="text-xs text-zinc-500 leading-relaxed flex items-start gap-1.5">
                  <span className="text-zinc-400">•</span>
                  <span>{s}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-4 pt-2 border-t border-zinc-100 flex justify-end gap-2">
          <button
            onClick={onDismiss}
            className="text-xs px-4 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
