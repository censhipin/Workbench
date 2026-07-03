// ============================================================
// OutputProcessor V2 — 结果展示格式处理器
// ============================================================
// 职责：只负责字段处理 + 输出格式
// 不做：filter / sort / aggregate / match / 修改数据值 / 调用 DataEngine
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { OutputSpec } from '../execution-plan';

/** 处理后结果 */
export interface ProcessedResult {
  columns: ColumnDef[];
  rows: RowData[];
}

/**
 * OutputProcessor 接口
 * 输入：原始计算结果 + OutputSpec
 * 输出：格式化后的结果（字段筛选/重命名/排序/行数限制）
 */
export interface OutputProcessor {
  process(
    rows: RowData[],
    columns: ColumnDef[],
    output?: OutputSpec | null,
  ): ProcessedResult;
}

/**
 * 默认 OutputProcessor 实现
 *
 * 处理顺序（固定）：
 *   输入结果 → includeColumns → excludeColumns
 *   → renameColumns → reorderColumns → limit → 输出
 */
export class DefaultOutputProcessor implements OutputProcessor {
  process(
    rows: RowData[],
    columns: ColumnDef[],
    output?: OutputSpec | null,
  ): ProcessedResult {
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
        const nr: RowData = {};
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
          const nr: RowData = {};
          for (const c of resultCols) {
            nr[c.key] = r[c.key] ?? null;
          }
          return nr;
        });
      }
    }

    // 3. renameColumns — 重命名列（同时修改 columns.title 和 rows key）
    if (output.renameColumns) {
      for (const [oldName, newName] of Object.entries(output.renameColumns)) {
        const col = resultCols.find(c => c.title === oldName || c.key === oldName);
        if (col) {
          col.title = newName;
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
}
