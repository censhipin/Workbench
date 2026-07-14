'use client';

import { ReactNode } from 'react';

interface RightPanelProps {
  children: ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function RightPanel({
  children,
  isCollapsed,
  onToggle,
}: RightPanelProps) {
  if (isCollapsed) {
    return (
      <aside className="w-9 shrink-0 flex flex-col items-center py-3" style={{ borderLeft: '1px solid var(--border-color)', background: 'var(--bg-sidebar)' }}>
        <button onClick={onToggle} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--text-tertiary)', background: 'var(--hover-bg)' }} title="展开面板">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[320px] shrink-0 flex flex-col h-full overflow-hidden" style={{ borderLeft: '1px solid var(--border-color)', background: 'var(--bg-sidebar)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>执行计划</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--text-tertiary)', background: 'var(--hover-bg)' }} title="折叠面板">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
