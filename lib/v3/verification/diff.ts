// ============================================================
// Diff — 差异引擎
// ============================================================
// 比较 Input → Output，自动生成 DiffSummary
// 用于 Verification、Explain、History、Version Compare
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { DiffSummary } from './types';

/**
 * 比较输入输出，生成差异摘要
 * 通过行哈希比较精确判断：新增、删除、修改
 */
export function computeDiff(
  inputColumns: ColumnDef[],
  inputRows: RowData[],
  outputColumns: ColumnDef[],
  outputRows: RowData[],
): DiffSummary {
  const inKeySet = buildRowKeySet(inputRows, inputColumns);
  const outKeySet = buildRowKeySet(outputRows, outputColumns);

  // 列差异
  const inColKeys = new Set(inputColumns.map(c => c.key));
  const outColKeys = new Set(outputColumns.map(c => c.key));

  const columnsAdded = outputColumns.filter(c => !inColKeys.has(c.key)).length;
  const columnsRemoved = inputColumns.filter(c => !outColKeys.has(c.key)).length;

  // 重命名检测（key 不同但 title 相似）
  let columnsRenamed = 0;
  for (const outCol of outputColumns) {
    if (!inColKeys.has(outCol.key)) {
      const similar = inputColumns.find(
        c => c.key !== outCol.key && c.title === outCol.title,
      );
      if (similar) columnsRenamed++;
    }
  }

  // 行差异
  let rowsAdded = 0;
  let rowsRemoved = 0;
  let rowsUpdated = 0;

  for (const key of outKeySet) {
    if (!inKeySet.has(key)) rowsAdded++;
    else {
      // 相同 key，检查值是否变化
      // 这里简化处理：精确匹配的 key 都视为 unchanged，仅 key 变化才计为 added
    }
  }

  // 通过值精确比对检测修改
  for (const inKey of inKeySet) {
    if (outKeySet.has(inKey)) {
      const inRow = inputRows.find(r => rowToHash(r, inputColumns) === inKey);
      const outRow = outputRows.find(r => rowToHash(r, outputColumns) === inKey);
      if (inRow && outRow) {
        const fullInKey = JSON.stringify(inRow);
        const fullOutKey = JSON.stringify(outRow);
        if (fullInKey !== fullOutKey) rowsUpdated++;
      }
    }
  }

  for (const key of inKeySet) {
    if (!outKeySet.has(key)) rowsRemoved++;
  }

  return {
    rowsAdded,
    rowsRemoved,
    rowsUpdated,
    columnsAdded,
    columnsRemoved,
    columnsRenamed,
  };
}

/** 为行构建标准哈希（用于比较） */
function buildRowKeySet(rows: RowData[], columns: ColumnDef[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    set.add(rowToHash(row, columns));
  }
  return set;
}

function rowToHash(row: RowData, columns: ColumnDef[]): string {
  return columns.map(c => String(row[c.key] ?? '__null__')).join('|');
}
