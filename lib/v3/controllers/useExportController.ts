// ============================================================
// useExportController — 导出控制器
// ============================================================
import { useCallback } from 'react';
import type { ColumnDef, RowData, WorkbenchFile } from '@/lib/types';
import type { TableStyle } from '@/lib/tableStyles';
import { exportToExcel } from '@/lib/file-engine';

export function useExportController() {
  const handleExport = useCallback(async (
    displayColumns: ColumnDef[],
    displayRows: RowData[],
    selectedFile: WorkbenchFile | null,
    style?: TableStyle,
  ) => {
    if (displayColumns.length === 0 || displayRows.length === 0) return;
    const name = selectedFile?.name?.replace(/\.xlsx?$/, '') ?? '导出';
    await exportToExcel([{ name: '结果', columns: displayColumns, rows: displayRows }], name + '_处理结果', style);
  }, []);

  return { handleExport };
}
