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
    <div className="flex items-center gap-1 flex-wrap">
      {sheets.map((sheet) => {
        const inTask = isInTask(sheet.name);
        return (
          <div key={sheet.name} className="flex items-center gap-0.5 group rounded-md transition-colors">
            <button
              onClick={() => onSelect(sheet.name)}
              className={`px-2 py-0.5 text-[10px] rounded-l-md transition-colors ${
                activeSheet === sheet.name
                  ? 'bg-[#4f6ef7] text-white font-medium'
                  : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
              }`}
            >
              {sheet.name}({rowCount(sheet.rows)})
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTask(fileId, sheet.name); }}
              className={`px-1 py-0.5 text-[10px] rounded-r-md transition-all ${
                inTask
                  ? 'bg-[#4f6ef7] text-white'
                  : 'bg-[#f3f4f6] text-[#9ca3af] hover:text-[#4f6ef7] hover:bg-[#eef1ff] opacity-0 group-hover:opacity-100'
              }`}
              title={inTask ? '移除任务' : '加入任务'}
            >
              {inTask ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
