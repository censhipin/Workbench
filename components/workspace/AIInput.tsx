'use client';

import { QuickAction as QuickActionType } from '@/lib/types';
import QuickActionButton from '@/components/common/QuickAction';
import { promptExamples } from '@/lib/mock-data';

interface AIInputProps {
  promptText: string;
  onPromptChange: (text: string) => void;
  onSubmit: () => void;
  quickActions: QuickActionType[];
  activeQuickAction: string | null;
  onQuickAction: (action: QuickActionType) => void;
  taskFiles: { id: string; name: string; icon: string }[];
  onRemoveTaskFile: (id: string) => void;
  onClearTaskFiles: () => void;
}

export default function AIInput({ promptText, onPromptChange, onSubmit, quickActions, activeQuickAction, onQuickAction, taskFiles, onRemoveTaskFile, onClearTaskFiles }: AIInputProps) {
  return (
    <div className="border-t border-b border-zinc-200 bg-white px-4 py-3 shrink-0">
      {taskFiles.length > 0 && (
        <div className="mb-2.5 flex items-center gap-1.5 flex-wrap min-h-[28px]">
          <span className="text-[11px] text-zinc-400 shrink-0">当前任务文件</span>
          {taskFiles.map((file) => (
            <span key={file.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {file.name}
              <button onClick={() => onRemoveTaskFile(file.id)} className="text-blue-400 hover:text-blue-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
          <button onClick={onClearTaskFiles} className="text-[10px] text-zinc-400 hover:text-zinc-600 ml-1 shrink-0">清空全部</button>
        </div>
      )}
      {!promptText && (
        <div className="mb-3">
          <span className="text-[11px] text-zinc-400 mb-1.5 block">你可以这样说</span>
          <div className="flex flex-wrap gap-1.5">
            {promptExamples.map((example) => (
              <button key={example} onClick={() => onPromptChange(example)} className="text-xs px-2.5 py-1 rounded-lg bg-zinc-50 text-zinc-500 hover:bg-blue-50 hover:text-blue-600 border border-zinc-100 hover:border-blue-200 transition-colors text-left">{example}</button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div className="flex-1 relative">
          <textarea value={promptText} onChange={(e) => onPromptChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (promptText.trim()) onSubmit(); } }} placeholder="用自然语言描述你的数据处理需求..." rows={2} className="w-full resize-none rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-shadow" />
        </div>
        <button onClick={onSubmit} disabled={!promptText.trim()} className="flex items-center justify-center shrink-0 w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="text-[11px] text-zinc-400 shrink-0">快捷操作：</span>
        {quickActions.map((action) => (
          <QuickActionButton key={action.id} icon={action.icon} label={action.label} prompt={action.prompt} isActive={activeQuickAction === action.id} onClick={() => onQuickAction(action)} />
        ))}
      </div>
    </div>
  );
}
