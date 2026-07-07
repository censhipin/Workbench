// ============================================================
// Workbench Panel — 统一面板容器
// ============================================================
// 所有工作台面板使用统一容器，保持视觉一致性
// ============================================================

'use client';

import { ReactNode } from 'react';

interface WorkbenchPanelProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export default function WorkbenchPanel({ title, icon, children }: WorkbenchPanelProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        <h3 className="text-xs font-semibold text-zinc-700">{title}</h3>
      </div>
      {/* Content */}
      {children}
    </div>
  );
}
