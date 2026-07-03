'use client';

import { ReactNode } from 'react';
import { PlanViewMode } from '@/lib/types';

interface RightPanelProps {
  children: ReactNode;
  planMode: PlanViewMode;
  onPlanModeChange: (mode: PlanViewMode) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function RightPanel({
  children,
  planMode,
  onPlanModeChange,
  isCollapsed,
  onToggle,
}: RightPanelProps) {
  if (isCollapsed) {
    return (
      <aside className="w-9 shrink-0 border-l border-[#e9ecef] bg-[#f8f9fa] flex flex-col items-center py-3">
        <button onClick={onToggle} className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-[#9ca3af] transition-colors" title="展开面板">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] shrink-0 border-l border-[#e9ecef] bg-[#f8f9fa] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9ecef] shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f6ef7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <span className="text-sm font-semibold text-[#1a1a2e]">AI 执行计划</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className="w-7 h-7 rounded-lg hover:bg-[#f3f4f6] flex items-center justify-center text-[#9ca3af] transition-colors" title="折叠面板">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-4 py-2.5 border-b border-[#e9ecef] shrink-0 bg-white">
        <div className="flex items-center bg-[#f3f4f6] rounded-lg p-0.5">
          <button onClick={() => onPlanModeChange('human')} className={`flex-1 text-[11px] px-3 py-1.5 rounded-md font-medium transition-all ${planMode === 'human' ? 'bg-white text-[#1a1a2e] shadow-sm border border-[#e9ecef]' : 'text-[#6b7280] hover:text-[#1a1a2e]'}`}>
            人类可读
          </button>
          <button onClick={() => onPlanModeChange('developer')} className={`flex-1 text-[11px] px-3 py-1.5 rounded-md font-medium transition-all ${planMode === 'developer' ? 'bg-white text-[#1a1a2e] shadow-sm border border-[#e9ecef]' : 'text-[#6b7280] hover:text-[#1a1a2e]'}`}>
            {'< >'} 开发者
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
