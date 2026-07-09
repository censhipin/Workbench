// ============================================================
// Predicate Engine — 统一条件求值引擎
// ============================================================
// 职责：根据 Operator 枚举和条件值，对单元格值进行求值
// 不关心列名、不关心数据类型推断、不关心 fallback
// ============================================================

import { Operator, type ConditionExpr } from './types';

/**
 * 对单个单元格求值
 * @param cellValue 单元格原始值（string | number | null）
 * @param operator  操作符枚举
 * @param compareValue 比较值（类型因 operator 而异）
 */
export function evaluateCondition(
  cellValue: unknown,
  operator: Operator,
  compareValue: unknown,
): boolean {
  // null/undefined 处理：IS_NULL/NOT_NULL 走自己的逻辑
  if (operator !== Operator.IS_NULL && operator !== Operator.NOT_NULL) {
    if (cellValue == null) return false;
  }

  switch (operator) {
    // ---- 相等/不等 ----
    case Operator.EQ:
      return String(cellValue).toLowerCase() === String(compareValue).toLowerCase();

    case Operator.NE:
      return String(cellValue).toLowerCase() !== String(compareValue).toLowerCase();

    // ---- 大小比较（数值优先） ----
    case Operator.GT:
      return compareNumeric(cellValue, compareValue) > 0;

    case Operator.GTE:
      return compareNumeric(cellValue, compareValue) >= 0;

    case Operator.LT:
      return compareNumeric(cellValue, compareValue) < 0;

    case Operator.LTE:
      return compareNumeric(cellValue, compareValue) <= 0;

    // ---- 字符串包含 ----
    case Operator.CONTAINS:
      return String(cellValue).toLowerCase().includes(String(compareValue).toLowerCase());

    case Operator.STARTS_WITH:
      return String(cellValue).toLowerCase().startsWith(String(compareValue).toLowerCase());

    case Operator.ENDS_WITH:
      return String(cellValue).toLowerCase().endsWith(String(compareValue).toLowerCase());

    // ---- 范围 ----
    case Operator.BETWEEN: {
      const range = compareValue as { start: unknown; end: unknown };
      return (
        compareNumeric(cellValue, range.start) >= 0 &&
        compareNumeric(cellValue, range.end) <= 0
      );
    }

    // ---- 集合 ----
    case Operator.IN: {
      const arr = compareValue as unknown[];
      return arr.some((item) => String(cellValue).toLowerCase() === String(item).toLowerCase());
    }

    case Operator.NOT_IN: {
      const arr2 = compareValue as unknown[];
      return !arr2.some((item) => String(cellValue).toLowerCase() === String(item).toLowerCase());
    }

    // ---- 空值 ----
    case Operator.IS_NULL:
      return cellValue == null || String(cellValue).trim() === '';

    case Operator.NOT_NULL:
      return cellValue != null && String(cellValue).trim() !== '';

    default:
      return true;
  }
}

/**
 * 对 EvaluationPlan 中所有 conditions 做 AND/OR 组合求值
 * 默认 AND 连接，当条件标注 logic='OR' 时进入 OR 模式。
 * 支持混合 AND + OR。
 */
export function evaluateAll(row: Record<string, unknown>, conditions: ConditionExpr[]): boolean {
  return evaluateConditions(row, conditions);
}

/**
 * AND/OR 混合条件求值（与 FilterExecutor 共享同一实现）
 * 默认 AND 连接，当某个条件标注 logic='OR' 时进入 OR 模式。
 */
export function evaluateConditions(
  row: Record<string, unknown>,
  conditions: ConditionExpr[],
): boolean {
  if (conditions.length === 0) return true;

  let result = true;
  let hasOr = false;

  for (const cond of conditions) {
    const compareValue = cond.valueColumn ? row[cond.valueColumn] : cond.value;
    const passed = evaluateCondition(row[cond.columnKey], cond.operator, compareValue);

    if (cond.logic === 'OR' || hasOr) {
      if (!hasOr) {
        hasOr = true;
        result = passed;
      } else {
        result = result || passed;
      }
    } else {
      result = hasOr ? result && passed : result && passed;
    }
  }

  return result;
}

// ---- 内部 ----

/**
 * 数值优先比较：
 * 1. 如果能转为数值 → 数值比较
 * 2. 否则 → 字符串比较
 * 返回负数/0/正数（与 Intl.compare 一致）
 */
function compareNumeric(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  const na = Number(a);
  const nb = Number(b);
  if (!isNaN(na) && !isNaN(nb)) {
    return na - nb;
  }
  return String(a).localeCompare(String(b));
}
