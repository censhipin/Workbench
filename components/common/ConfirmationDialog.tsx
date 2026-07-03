'use client';

import { useState } from 'react';
import { ColumnDef } from '@/lib/types';
import { AmbiguityReport, ExecutionPlanPreview, ColumnCandidate } from '@/lib/ambiguity-detector';

interface ConfirmationDialogProps {
  ambiguity: AmbiguityReport;
  planPreview: ExecutionPlanPreview;
  availableColumns: ColumnDef[];
  onConfirm: (selections: { selectedColumns: ColumnCandidate[] }) => void;
  onCancel: () => void;
  onModifyPrompt: () => void;
}

export default function ConfirmationDialog({
  ambiguity,
  planPreview,
  availableColumns,
  onConfirm,
  onCancel,
  onModifyPrompt,
}: ConfirmationDialogProps) {
  const [candidates, setCandidates] = useState<ColumnCandidate[]>(
    ambiguity.columnCandidates.map((c) => ({ ...c }))
  );

  const isMultiColumn = ambiguity.type === 'multi_candidate';
  const isLowConfidence = ambiguity.type === 'low_confidence';
  const isNoMatch = ambiguity.type === 'no_match';

  const toggleColumn = (key: string) => {
    if (isMultiColumn) {
      // multi_column: 支持多选
      setCandidates((prev) =>
        prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c))
      );
    } else {
      // low_confidence: 单选
      setCandidates((prev) =>
        prev.map((c) => ({ ...c, selected: c.key === key }))
      );
    }
  };

  const handleConfirm = () => {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) return;
    onConfirm({ selectedColumns: selected });
  };

  const hasSelection = candidates.some((c) => c.selected);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/20" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 w-[400px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* 标题 */}
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86l-8.09 14.02A1.53 1.53 0 003.5 20h17a1.53 1.53 0 001.3-2.12l-8.09-14.02a1.53 1.53 0 00-2.42 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-zinc-800">{ambiguity.title}</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1 ml-[26px]">{ambiguity.description}</p>
          {ambiguity.target && (
            <div className="mt-2 ml-[26px]">
              <span className="text-[11px] text-zinc-400">你输入了: </span>
              <span className="text-[11px] font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                {ambiguity.target}
              </span>
            </div>
          )}
        </div>

        {/* 候选列列表 */}
        <div className="px-5 py-3 overflow-auto flex-1 min-h-0">
          {candidates.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] text-zinc-400 mb-2">
                {isNoMatch ? '当前表中没有匹配列，请修改指令' : isMultiColumn ? '检测到多个匹配列，请选择目标列' : '请从以下列中选择'}
              </p>
              {candidates.map((c) => {
                const isSelected = c.selected;
                const colDef = availableColumns.find((ac) => ac.key === c.key);
                return (
                  <div
                    key={c.key}
                    onClick={() => toggleColumn(c.key)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'border border-transparent hover:bg-zinc-50'
                    }`}
                  >
                    {/* checkbox 或 radio 图标 */}
                    <div
                      className={`shrink-0 w-4 h-4 rounded-sm flex items-center justify-center transition-colors ${
                        isSelected
                          ? isMultiColumn
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'border border-zinc-300'
                      }`}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </div>

                    {/* 列信息 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-zinc-700">{c.title}</span>
                      <span className="ml-2 text-[10px] text-zinc-400">
                        {colDef?.type === 'number' ? '数值' : colDef?.type === 'date' ? '日期' : '文本'}
                      </span>
                    </div>

                    {/* 匹配度 */}
                    <span
                      className={`text-[10px] shrink-0 px-1.5 py-0.5 rounded-full ${
                        c.matchMethod === 'exact'
                          ? 'bg-emerald-50 text-emerald-600'
                          : c.confidence >= 0.7
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {c.matchMethod === 'exact'
                        ? '精确匹配'
                        : `${(c.confidence * 100).toFixed(0)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 执行计划预览 */}
        <div className="mx-5 mb-3 px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
          <p className="text-[10px] text-zinc-400 mb-1.5">执行计划预览</p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600 flex-wrap">
            <span>
              操作: <span className="font-medium text-zinc-700">{planPreview.operationLabel}</span>
            </span>
            {planPreview.target && (
              <span>
                目标: <span className="font-medium text-zinc-700">{planPreview.target}</span>
              </span>
            )}
            {planPreview.targetFiles.length > 0 && (
              <span>
                文件: <span className="font-medium text-zinc-700">{planPreview.targetFiles.join('、')}</span>
              </span>
            )}
            {planPreview.isDangerous && (
              <span className="text-red-500 font-medium">（该操作不可逆）</span>
            )}
          </div>
        </div>

        {/* 按钮 */}
        <div className="px-5 pb-5 pt-2 border-t border-zinc-100 flex items-center justify-between shrink-0">
          <button
            onClick={onModifyPrompt}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 rounded transition-colors"
          >
            修改指令
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!hasSelection}
              className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              确认执行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
