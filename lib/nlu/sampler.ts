// ============================================================
// Sampler — 提取列样本数据
// ============================================================
// 职责：从数据行中提取每列的前 N 个非空样本
// 用于 DeepSeek system prompt 中的列描述
// ============================================================

import { ColumnDef } from '../types';

/**
 * 提取每列前 N 个非空样本值（去重后）
 * 返回 { [columnKey]: [sample1, sample2, ...] }
 */
export function getSampleRows(
  columns: ColumnDef[],
  rows: Record<string, string | number | null>[],
  maxSamples: number = 10
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const seen: Record<string, Set<string>> = {};

  for (const col of columns) {
    result[col.key] = [];
    seen[col.key] = new Set();
  }

  for (const row of rows) {
    for (const col of columns) {
      if (result[col.key].length >= maxSamples) continue;
      const val = row[col.key];
      if (val == null || val === '') continue;
      const strVal = String(val).trim();
      if (!strVal) continue;
      if (seen[col.key].has(strVal)) continue;
      seen[col.key].add(strVal);
      result[col.key].push(strVal);
    }
  }

  return result;
}
