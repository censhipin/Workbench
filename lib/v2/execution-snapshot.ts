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
 * JSON.parse/stringify 是最可靠的 deep clone 方式
 * 适用于纯 JSON 数据（无 Date/Map/Set/Function）
 * 特殊处理：JSON 无法保留 Infinity，手动恢复
 */
export function createSnapshot(columns: ColumnDef[], rows: RowData[]): ExecutionSnapshot {
  const raw = JSON.parse(JSON.stringify({ columns, rows }));
  return restoreSpecialValues(raw, rows);
}

/**
 * 对执行结果做深拷贝
 * 确保 output dataset 完全不引用 input dataset
 */
export function cloneResult<T>(data: T): T {
  const raw = JSON.parse(JSON.stringify(data));
  return restoreSpecialValues(raw, data);
}

/** 恢复 JSON.parse 丢失的特殊值（Infinity, -Infinity） */
function restoreSpecialValues<T>(cloned: T, original: T): T {
  if (Array.isArray(cloned) && Array.isArray(original)) {
    for (let i = 0; i < Math.min(cloned.length, original.length); i++) {
      if (typeof original[i] === 'object' && original[i] !== null && typeof cloned[i] === 'object' && cloned[i] !== null) {
        cloned[i] = restoreSpecialValues(cloned[i], original[i]);
      }
    }
  } else if (typeof cloned === 'object' && cloned !== null && typeof original === 'object' && original !== null) {
    for (const key of Object.keys(cloned as object)) {
      const ov = (original as any)[key];
      const cv = (cloned as any)[key];
      if (ov === Infinity || ov === -Infinity) {
        (cloned as any)[key] = ov;
      } else if (typeof ov === 'object' && ov !== null && typeof cv === 'object' && cv !== null) {
        (cloned as any)[key] = restoreSpecialValues(cv, ov);
      }
    }
  }
  return cloned;
}
