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
    <main className="flex-1 flex flex-col min-w-0 bg-white h-full overflow-hidden">
      <DataTabs activeTab={activeTab} onTabChange={onTabChange} hasResult={hasResult} />
      {statusBar && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#f8f9fa] border-b border-[#e9ecef] shrink-0">
          <span className="text-[11px] text-[#6b7280]">{statusBar}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </div>
        {bottomBar && (
          <div className="shrink-0 border-t border-[#e9ecef]">
            {bottomBar}
          </div>
        )}
      </div>
    </main>
  );
}
