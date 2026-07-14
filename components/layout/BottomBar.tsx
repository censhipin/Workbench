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
  onRemoveTaskFile?: (fileId: string, sheetName: string) => void;
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
    <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }} className="shrink-0">
      {/* Row 1: Context info */}
      {contextInfo && (
        <div className="flex items-center gap-3 px-5 py-1.5" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
          <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{contextInfo}</span>
          {hasVersions && (
            <button onClick={onReset} className="text-[11px] transition-colors ml-auto" style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              重置到原始数据
            </button>
          )}
        </div>
      )}

      {/* Row 1.5: Task file tags */}
      {taskFileItems.length > 0 && (
        <div className="flex items-center gap-1.5 px-5 py-1.5 flex-wrap">
          <span className="text-[11px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>任务文件：</span>
          {taskFileItems.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
              <span className="text-xs">{item.icon}</span>
              {item.sheet ? `${item.name}—${item.sheet}` : item.name}
              {onRemoveTaskFile && (
                <button onClick={() => onRemoveTaskFile(item.id, item.sheet || '')} style={{ color: 'color-mix(in srgb, var(--primary) 60%, transparent)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'color-mix(in srgb, var(--primary) 60%, transparent)')}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </span>
          ))}
          {onClearTaskFiles && taskFileItems.length > 1 && (
            <button onClick={onClearTaskFiles} className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >清空</button>
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
              className="w-full resize-none rounded-lg px-4 py-2.5 text-sm transition-all"
              style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-card)' }}
              onFocus={e => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onSubmit}
              disabled={!promptText.trim() || isRunning}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              style={{ background: 'var(--primary)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--primary-hover)'; }}
              onMouseLeave={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--primary)'; }}
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
              className="flex items-center justify-center w-9 h-9 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'var(--hover-bg)' }}
              title="撤销"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
            </button>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[11px] shrink-0 mr-1" style={{ color: 'var(--text-tertiary)' }}>快捷操作：</span>
          {quickActions.map((action) => {
            const isActive = activeQuickAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => onQuickAction(action)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border transition-all shrink-0"
                style={{
                  background: isActive ? 'var(--primary-light)' : 'var(--bg-card)',
                  borderColor: isActive ? 'var(--primary)' : 'var(--border-color)',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                <span className="text-xs">{action.icon}</span>
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
