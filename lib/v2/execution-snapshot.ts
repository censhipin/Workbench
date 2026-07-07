// ============================================================
// Execution Context Snapshot
// 职责：在 executeIntent 入口处对数据做一次 deep clone
// 保证执行端完全隔离于 UI state
// ============================================================

import type { ColumnDef, RowData } from '../types';

export interface ExecutionSnapshot {
  columns: ColumnDef[];
  rows: RowData[];
}

/**
 * 对执行数据做深拷贝快照
 * structuredClone 是原生 API，比 JSON.parse/stringify 快 2-5x
 * 适用于纯 JSON 数据（无 Date/Map/Set/Function）
 * 特殊处理：structuredClone 能保留 Infinity，无需手动恢复
 */
export function createSnapshot(columns: ColumnDef[], rows: RowData[]): ExecutionSnapshot {
  return structuredClone({ columns, rows });
}

/**
 * 对执行结果做深拷贝
 * 确保 output dataset 完全不引用 input dataset
 */
export function cloneResult<T>(data: T): T {
  return structuredClone(data);
}
