'use client';

import { useState } from 'react';
import { RowData } from '@/lib/types';

interface SheetTabsProps {
  sheets: { name: string; rows: RowData[] }[];
  activeSheet: string;
  onSelect: (name: string) => void;
}

function rowCount(rows: RowData[]): number {
  return rows.length;
}

export default function SheetTabs({ sheets, activeSheet, onSelect }: SheetTabsProps) {
  if (sheets.length <= 1) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sheets.map((sheet) => (
        <button key={sheet.name} onClick={() => onSelect(sheet.name)} className={`px-2 py-0.5 text-[10px] rounded-md transition-colors ${activeSheet===sheet.name?'bg-[#4f6ef7] text-white font-medium':'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'}`}>
          {sheet.name}({rowCount(sheet.rows)})
        </button>
      ))}
    </div>
  );
}
