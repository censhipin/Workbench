'use client';

import { ColumnDef, RowData } from '@/lib/types';
import DataTable from '@/components/common/DataTable';

interface CompareViewProps {
  leftLabel: string;
  rightLabel: string;
  leftColumns: ColumnDef[];
  leftRows: RowData[];
  rightColumns: ColumnDef[];
  rightRows: RowData[];
}

export default function CompareView({ leftLabel, rightLabel, leftColumns, leftRows, rightColumns, rightRows }: CompareViewProps) {
  return (
    <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-zinc-100 shrink-0">
          <span className="text-xs font-medium text-zinc-600">{leftLabel}</span>
          <span className="text-[11px] text-zinc-400">{leftRows.length}行×{leftColumns.length}列</span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <DataTable columns={leftColumns} rows={leftRows} maxHeight="100%" />
        </div>
      </div>
      <div className="flex items-center text-zinc-300 select-none shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </div>
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-blue-50 shrink-0">
          <span className="text-xs font-medium text-blue-700">{rightLabel}</span>
          <span className="text-[11px] text-blue-400">{rightRows.length}行×{rightColumns.length}列</span>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <DataTable columns={rightColumns} rows={rightRows} maxHeight="100%" />
        </div>
      </div>
    </div>
  );
}
