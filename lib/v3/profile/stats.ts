// ============================================================
// Stats — 全局统计计算
// ============================================================

import type { RowData } from '../../types';
import type { ColumnProfile, GlobalStats } from './types';

/**
 * 计算全局统计信息
 */
export function computeGlobalStats(
  columns: ColumnProfile[],
  rows: RowData[],
): GlobalStats {
  const totalCells = columns.length * rows.length;
  const totalNullCells = columns.reduce((sum, col) => sum + col.nullCount, 0);
  const nullRate = totalCells > 0 ? totalNullCells / totalCells : 0;

  // 重复行检测
  const signatureSet = new Set<string>();
  let duplicateCount = 0;
  for (const row of rows) {
    const sig = columns
      .map((col) => String(row[col.columnKey] ?? ''))
      .join('||');
    if (signatureSet.has(sig)) {
      duplicateCount++;
    } else {
      signatureSet.add(sig);
    }
  }
  const duplicateRowRate = rows.length > 0 ? duplicateCount / rows.length : 0;

  return {
    totalNullCells,
    nullRate,
    duplicateRowRate,
  };
}
