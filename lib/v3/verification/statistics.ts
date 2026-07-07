// ============================================================
// Statistics — 统一统计引擎
// ============================================================
// 所有 Verifier 共用，避免重复计算
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import { isNull } from '../../v2/executors/null-definition';

export interface ColumnStats {
  columnKey: string;
  title: string;
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  /** 数值列 */
  min?: number;
  max?: number;
  avg?: number;
}

export interface TableStats {
  rowCount: number;
  columnCount: number;
  nullCount: number;
  /** 全空行数 */
  emptyRowCount: number;
  /** 重复行数 */
  duplicateCount: number;
  /** 每列统计 */
  columns: ColumnStats[];
}

/** 计算整表的完整统计 */
export function computeTableStats(rows: RowData[], columns: ColumnDef[]): TableStats {
  let totalNulls = 0;
  let emptyRowCount = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const key = columns.map(c => String(row[c.key] ?? '__null__')).join('|');
    seen.add(key);

    let rowEmpty = true;
    for (const col of columns) {
      if (isNull(row[col.key])) {
        totalNulls++;
      } else {
        rowEmpty = false;
      }
    }
    if (rowEmpty) emptyRowCount++;
  }

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    nullCount: totalNulls,
    emptyRowCount,
    duplicateCount: rows.length - seen.size,
    columns: computeColumnStats(rows, columns),
  };
}

function computeColumnStats(rows: RowData[], columns: ColumnDef[]): ColumnStats[] {
  return columns.map(col => {
    const values = rows.map(r => r[col.key]);
    const nullCount = values.filter(v => isNull(v)).length;
    const validValues = values.filter(v => !isNull(v));
    const uniqueSet = new Set(validValues.map(v => String(v)));

    const stats: ColumnStats = {
      columnKey: col.key,
      title: col.title,
      nullCount,
      nullRate: rows.length > 0 ? nullCount / rows.length : 0,
      uniqueCount: uniqueSet.size,
      uniqueRate: validValues.length > 0 ? uniqueSet.size / validValues.length : 0,
    };

    // 数值统计
    if (col.type === 'number') {
      const nums = validValues.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        stats.min = Math.min(...nums);
        stats.max = Math.max(...nums);
        stats.avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      }
    }

    return stats;
  });
}

/** 计算分组键的哈希集合 */
export function computeGroupKeys(
  rows: RowData[],
  groupByCols: string[],
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    const key = groupByCols.map(c => String(row[c] ?? '')).join('||');
    keys.add(key);
  }
  return keys;
}

/** 计算匹配统计 */
export function computeMatchStats(
  leftRows: RowData[],
  rightRows: RowData[],
  matchKeys: string[],
  outputRows: RowData[],
): { matched: number; unmatched: number; matchRate: number } {
  const leftSet = new Set<string>();
  for (const row of leftRows) {
    leftSet.add(matchKeys.map(c => String(row[c] ?? '')).join('|'));
  }

  let matched = 0;
  for (const row of outputRows.slice(0, leftRows.length)) {
    const key = matchKeys.map(c => String(row[c] ?? '')).join('|');
    // 检查匹配后的行是否有来自右表的值（_lkp_ 前缀）
    const hasRightValues = Object.keys(row).some(k => k.startsWith('_lkp_') && !isNull(row[k]));
    if (hasRightValues) matched++;
  }

  const total = leftRows.length;
  return {
    matched,
    unmatched: total - matched,
    matchRate: total > 0 ? matched / total : 0,
  };
}
