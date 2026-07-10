'use client';

import { RowData, TaskSheetRef } from '@/lib/types';

interface SheetTabsProps {
  sheets: { name: string; rows: RowData[] }[];
  activeSheet: string;
  onSelect: (name: string) => void;
  fileId: string;
  taskSheets: TaskSheetRef[];
  onAddToTask: (fileId: string, sheetName: string) => void;
}

function rowCount(rows: RowData[]): number {
  return rows.length;
}

export default function SheetTabs({ sheets, activeSheet, onSelect, fileId, taskSheets, onAddToTask }: SheetTabsProps) {
  if (sheets.length <= 1) return null;

  function isInTask(name: string) {
    return taskSheets.some(t => t.fileId === fileId && t.sheetName === name);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sheets.map((sheet) => {
        const inTask = isInTask(sheet.name);
        const isActive = activeSheet === sheet.name;
        return (
          <div
            key={sheet.name}
            className={`group flex items-center rounded-full border transition-all ${
              isActive
                ? 'border-[#4f6ef7] bg-[#4f6ef7]/5'
                : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <button
              onClick={() => onSelect(sheet.name)}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded-l-full transition-colors ${
                isActive
                  ? 'text-[#4f6ef7] font-medium'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <span className="leading-none mt-px">
                {sheet.name}({rowCount(sheet.rows)})
              </span>
            </button>
            <div className="w-px h-3 bg-zinc-200 group-hover:bg-zinc-300 transition-colors" />
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTask(fileId, sheet.name); }}
              className={`flex items-center justify-center px-2 py-1 rounded-r-full transition-all ${
                inTask
                  ? 'text-[#4f6ef7]'
                  : 'text-zinc-300 hover:text-[#4f6ef7] opacity-0 group-hover:opacity-100'
              }`}
              title={inTask ? '移除任务' : '加入任务'}
            >
              {inTask ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="block">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="block">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
