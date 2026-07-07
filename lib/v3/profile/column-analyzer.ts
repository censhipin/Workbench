// ============================================================
// Column Analyzer — 列分析
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import { inferColumnType } from './type-infer';
import type { ColumnProfile } from './types';

/**
 * 分析单列数据
 *
 * 输出:
 *  - nullCount / nullRate
 *  - uniqueCount / uniqueRate
 *  - 类型推断
 *  - min / max / avg（数值列）
 *  - sampleValues（最多 5 个）
 *  - confidence
 */
export function analyzeColumn(
  column: ColumnDef,
  rows: RowData[],
): ColumnProfile {
  const values = rows.map((r) => r[column.key] ?? null);
  const totalRows = rows.length;

  // 空值统计
  const nonNullValues = values.filter((v) => v != null && v !== '');
  const nullCount = totalRows - nonNullValues.length;
  const nullRate = totalRows > 0 ? nullCount / totalRows : 0;

  // 类型推断（仅在非空值上做）
  const { type, confidence } = inferColumnType(nonNullValues);

  // 唯一值统计
  const uniqueSet = new Set<string>();
  for (const v of nonNullValues) {
    uniqueSet.add(String(v));
  }
  const uniqueCount = uniqueSet.size;
  const uniqueRate = totalRows > 0 ? uniqueCount / totalRows : 0;

  // 样本值（前 5 个非空非重复）
  const samples: unknown[] = [];
  const seen = new Set<string>();
  for (const v of nonNullValues) {
    const key = String(v);
    if (!seen.has(key) && samples.length < 5) {
      seen.add(key);
      samples.push(v);
    }
  }

  // 数值列统计
  let min: number | undefined;
  let max: number | undefined;
  let sum = 0;
  let numCount = 0;

  if (type === 'number') {
    for (const v of nonNullValues) {
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!isNaN(n)) {
        if (min === undefined || n < min) min = n;
        if (max === undefined || n > max) max = n;
        sum += n;
        numCount++;
      }
    }
  }

  return {
    columnKey: column.key,
    title: column.title,
    type,
    declaredType: column.type,
    nullCount,
    nullRate,
    uniqueCount,
    uniqueRate,
    min,
    max,
    avg: numCount > 0 ? Math.round((sum / numCount) * 100) / 100 : undefined,
    sampleValues: samples,
    confidence,
  };
}
