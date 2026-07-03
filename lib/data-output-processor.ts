// ============================================================
// OutputProcessor — 统一输出约束处理器
// ============================================================
// 职责：在所有操作执行完后，统一处理输出约束：
//   includeColumns / excludeColumns / renameColumns
//   reorderColumns / limit
// 不与任何具体操作耦合，所有操作共用同一个处理器。
// ============================================================

import { ColumnDef } from './types';
import type { OutputOptions } from './nlu/taskplan-types';

export type DataRow = Record<string, string | number | null>;

export interface ProcessResult {
  columns: ColumnDef[];
  rows: DataRow[];
}

/**
 * 统一处理输出约束
 * @param columns 原始列定义
 * @param rows 原始数据行
 * @param output 输出约束配置
 * @returns 处理后的列和行
 */
export function processOutput(
  columns: ColumnDef[],
  rows: DataRow[],
  output?: OutputOptions | null
): ProcessResult {
  if (!output) {
    return { columns, rows };
  }

  let resultCols = [...columns];
  let resultRows = rows.map(r => ({ ...r }));

  // 1. includeColumns — 只保留指定列
  if (output.includeColumns && output.includeColumns.length > 0) {
    const includeSet = new Set(output.includeColumns);
    resultCols = resultCols.filter(c => includeSet.has(c.title) || includeSet.has(c.key));
    resultRows = resultRows.map(r => {
      const nr: DataRow = {};
      for (const c of resultCols) {
        nr[c.key] = r[c.key] ?? null;
      }
      return nr;
    });
  }

  // 2. excludeColumns — 删除指定列
  if (output.excludeColumns && output.excludeColumns.length > 0) {
    const excludeSet = new Set(output.excludeColumns.map(n => n.toLowerCase()));
    const keysToRemove = new Set<string>();
    for (const c of resultCols) {
      if (excludeSet.has(c.title.toLowerCase()) || excludeSet.has(c.key.toLowerCase())) {
        keysToRemove.add(c.key);
      }
    }
    if (keysToRemove.size > 0) {
      resultCols = resultCols.filter(c => !keysToRemove.has(c.key));
      resultRows = resultRows.map(r => {
        const nr: DataRow = {};
        for (const c of resultCols) {
          nr[c.key] = r[c.key] ?? null;
        }
        return nr;
      });
    }
  }

  // 3. renameColumns — 重命名列
  if (output.renameColumns) {
    for (const [oldName, newName] of Object.entries(output.renameColumns)) {
      const col = resultCols.find(c => c.title === oldName || c.key === oldName);
      if (col) {
        // 列定义重命名
        col.title = newName;
        // 数据行：旧 key 的数据迁移到新 key
        const oldKey = col.key;
        const newKey = newName;
        if (oldKey !== newKey) {
          col.key = newKey;
          for (const row of resultRows) {
            if (oldKey in row) {
              row[newKey] = row[oldKey];
              delete row[oldKey];
            }
          }
        }
      }
    }
  }

  // 4. reorderColumns — 调整列顺序
  if (output.reorderColumns && output.reorderColumns.length > 0) {
    const orderMap = new Map<string, number>();
    output.reorderColumns.forEach((name, idx) => {
      const col = columns.find(c => c.title === name || c.key === name);
      if (col) orderMap.set(col.key, idx);
    });
    if (orderMap.size > 0) {
      const ordered: ColumnDef[] = [];
      const remaining: ColumnDef[] = [];
      for (const c of resultCols) {
        if (orderMap.has(c.key)) {
          ordered.push(c);
        } else {
          remaining.push(c);
        }
      }
      ordered.sort((a, b) => (orderMap.get(a.key) ?? 999) - (orderMap.get(b.key) ?? 999));
      resultCols = [...ordered, ...remaining];
    }
  }

  // 5. limit — 限制行数
  if (output.limit && output.limit > 0 && output.limit < resultRows.length) {
    resultRows = resultRows.slice(0, output.limit);
  }

  return { columns: resultCols, rows: resultRows };
}
