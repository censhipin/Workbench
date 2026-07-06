'use client';

import { useState } from 'react';
import { QuickAction as QuickActionType } from '@/lib/types';
import { promptExamples } from '@/lib/mock-data';

interface BottomBarProps {
  promptText: string;
  onPromptChange: (text: string) => void;
  onSubmit: () => void;
  isRunning: boolean;
  onUndo: () => void;
  onReset: () => void;
  quickActions: QuickActionType[];
  activeQuickAction: string | null;
  onQuickAction: (action: QuickActionType) => void;
  contextInfo?: string;
  canUndo: boolean;
  hasVersions: boolean;
  taskFileItems?: { id: string; name: string; icon: string; sheet?: string }[];
  onRemoveTaskFile?: (id: string) => void;
  onClearTaskFiles?: () => void;
}

export default function BottomBar({
  promptText,
  onPromptChange,
  onSubmit,
  isRunning,
  onUndo,
  onReset,
  quickActions,
  activeQuickAction,
  onQuickAction,
  contextInfo,
  canUndo,
  hasVersions,
  taskFileItems = [],
  onRemoveTaskFile,
  onClearTaskFiles,
}: BottomBarProps) {
  return (
    <div className="border-t border-[#e9ecef] bg-white shrink-0">
      {/* Row 1: Context info */}
      {contextInfo && (
        <div className="flex items-center gap-3 px-5 py-1.5 bg-[#f8f9fa] border-b border-[#e9ecef]">
          <span className="text-[11px] text-[#6b7280] font-mono">{contextInfo}</span>
          {hasVersions && (
            <button onClick={onReset} className="text-[11px] text-[#9ca3af] hover:text-[#4f6ef7] transition-colors ml-auto">
              重置到原始数据
            </button>
          )}
        </div>
      )}

      {/* Row 1.5: Task file tags */}
      {taskFileItems.length > 0 && (
        <div className="flex items-center gap-1.5 px-5 py-1.5 flex-wrap">
          <span className="text-[11px] text-[#9ca3af] shrink-0">任务文件：</span>
          {taskFileItems.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-[#eef1ff] text-[#4f6ef7] border border-[#4f6ef7]/20">
              <span className="text-xs">{item.icon}</span>
              {item.sheet ? `${item.name}—${item.sheet}` : item.name}
              {onRemoveTaskFile && (
                <button onClick={() => onRemoveTaskFile(item.id)} className="text-[#4f6ef7]/60 hover:text-[#4f6ef7]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </span>
          ))}
          {onClearTaskFiles && taskFileItems.length > 1 && (
            <button onClick={onClearTaskFiles} className="text-[10px] text-[#9ca3af] hover:text-[#6b7280] shrink-0">清空</button>
          )}
        </div>
      )}

      {/* Row 2: Input + Actions */}
      <div className="px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <textarea
              value={promptText}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (promptText.trim() && !isRunning) onSubmit(); } }}
              placeholder="请输入指令，例如：筛选部门为技术部的数据"
              rows={1}
              className="w-full resize-none rounded-lg border border-[#e9ecef] px-4 py-2.5 text-sm text-[#1a1a2e] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#4f6ef7]/20 focus:border-[#4f6ef7] transition-all"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onSubmit}
              disabled={!promptText.trim() || isRunning}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#4f6ef7] text-white hover:bg-[#3b5ce5] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              title="执行中..."
            >
              {isRunning ? (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              )}
            </button>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-[#e9ecef] text-[#6b7280] hover:bg-[#f3f4f6] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="撤销"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[11px] text-[#9ca3af] shrink-0 mr-1">快捷操作：</span>
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onQuickAction(action)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-all shrink-0 ${
                activeQuickAction === action.id
                  ? 'bg-[#eef1ff] border-[#4f6ef7] text-[#4f6ef7] font-medium'
                  : 'bg-white border-[#e9ecef] text-[#6b7280] hover:border-[#d1d5db] hover:text-[#1a1a2e]'
              }`}
            >
              <span className="text-xs">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
