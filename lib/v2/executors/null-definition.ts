// ============================================================
// NullDefinition — 统一空值定义
// ============================================================
// 所有 Executor 共用此定义，避免判断标准不一致
// ============================================================

/**
 * 判断一个值是否为「空值」
 * 统一覆盖：NULL, undefined, "", " ", "N/A", "-", "NULL", "NaN", 全角空格
 */
export function isNull(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.replace(/[\s　]+/g, '').toLowerCase();
    return trimmed === '' || trimmed === 'n/a' || trimmed === '-' ||
      trimmed === 'null' || trimmed === 'nan' || trimmed === 'none';
  }
  if (typeof value === 'number') return isNaN(value);
  return false;
}

/**
 * 判断一个值是否为非空
 */
export function isNotNull(value: unknown): boolean {
  return !isNull(value);
}

/**
 * 判断一行是否完全为空（所有列均为空值）
 */
export function isEmptyRow(row: Record<string, unknown>): boolean {
  for (const key of Object.keys(row)) {
    if (!isNull(row[key])) return false;
  }
  return true;
}

/**
 * 标准化空值：null 值统一转为 null（不做填充）
 */
export function normalizeNull(value: unknown): unknown {
  return isNull(value) ? null : value;
}
