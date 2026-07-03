'use client';

import { DataTab } from '@/lib/types';

interface DataTabsProps {
  activeTab: DataTab;
  onTabChange: (tab: DataTab) => void;
  hasResult: boolean;
}

const TABS: { key: DataTab; label: string; icon: string }[] = [
  { key: 'original', label: '原始数据', icon: '📄' },
  { key: 'result', label: '执行结果', icon: '📊' },
  { key: 'compare', label: '对比', icon: '📉' },
];

export default function DataTabs({ activeTab, onTabChange, hasResult }: DataTabsProps) {
  return (
    <div className="flex items-center gap-0 px-4 shrink-0 bg-white border-b border-[#e9ecef] h-9">
      {TABS.map((tab) => {
        const isDisabled = (tab.key === 'result' || tab.key === 'compare') && !hasResult;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => !isDisabled && onTabChange(tab.key)}
            disabled={isDisabled}
            className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium border-b-2 transition-all relative ${
              isActive
                ? 'border-b-[#4f6ef7] text-[#1a1a2e]'
                : isDisabled
                ? 'border-b-transparent text-[#d1d5db] cursor-not-allowed'
                : 'border-b-transparent text-[#9ca3af] hover:text-[#6b7280] hover:border-b-[#d1d5db]'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
