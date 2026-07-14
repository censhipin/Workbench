'use client';

import { ReactNode } from 'react';
import DataTabs from '@/components/workspace/DataTabs';
import { DataTab } from '@/lib/types';

interface MainPanelProps {
  children: ReactNode;
  bottomBar?: ReactNode;
  activeTab: DataTab;
  onTabChange: (tab: DataTab) => void;
  hasResult: boolean;
  statusBar?: string;
}

export default function MainPanel({ children, bottomBar, activeTab, onTabChange, hasResult, statusBar }: MainPanelProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
      <DataTabs activeTab={activeTab} onTabChange={onTabChange} hasResult={hasResult} />
      {statusBar && (
        <div className="flex items-center gap-3 px-4 py-2 shrink-0" style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{statusBar}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
        {bottomBar && (
          <div className="shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
            {bottomBar}
          </div>
        )}
      </div>
    </main>
  );
}
