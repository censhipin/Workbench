// ============================================================
// FilterExecutor — 筛选执行器（重构版）
// ============================================================
// 统一使用 NullDefinition
// 支持 IS NULL / IS NOT NULL / EMPTY / NOT EMPTY
// 所有空值判断使用 isNull()
// ============================================================

import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import { isNull } from './null-definition';
import { Operator } from '../types';
import type { ConditionExpr } from '../types';

export class FilterExecutor implements OperationExecutor {
  readonly type = 'filter';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'filter') {
      throw new Error(`FilterExecutor 收到错误 type: ${plan.type}`);
    }

    const conditions = plan.conditions;
    const inputRows = ctx.mainSheet.rows;

    const resultRows = inputRows.filter(row => {
      return evaluateConditions(row, conditions);
    });

    return {
      result: { columns: ctx.mainSheet.columns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
      },
    };
  }
}

/** 用 AND/OR 逻辑求值条件组 */
function evaluateConditions(
  row: Record<string, unknown>,
  conditions: ConditionExpr[],
): boolean {
  if (conditions.length === 0) return true;

  // 默认 AND 连接，除非某个条件标注了 OR
  let result = true;
  let hasOr = false;

  for (const cond of conditions) {
    const cellValue = row[cond.columnKey];
    const compareValue = cond.valueColumn ? row[cond.valueColumn] : cond.value;
    const passed = evaluateCondition(cellValue, cond.operator, compareValue);

    if (cond.logic === 'OR' || hasOr) {
      // OR 模式：只要有一个满足就为 true
      if (!hasOr) {
        hasOr = true;
        result = passed;
      } else {
        result = result || passed;
      }
    } else {
      // AND 模式：全部需要满足
      if (hasOr) {
        // 混合模式：OR 组已确定，后续 AND 在 OR 组为 true 时仍需满足
        result = result && passed;
      } else {
        result = result && passed;
      }
    }
  }

  return result;
}

/** 单条件求值（使用 NullDefinition） */
function evaluateCondition(
  cellValue: unknown,
  operator: Operator,
  targetValue: unknown,
): boolean {
  switch (operator) {
    case Operator.IS_NULL:
      return isNull(cellValue);
    case Operator.NOT_NULL:
      return !isNull(cellValue);
    case Operator.EQ:
      if (isNull(cellValue) && targetValue == null) return true;
      if (isNull(cellValue)) return false;
      return String(cellValue).trim().toLowerCase() === String(targetValue ?? '').trim().toLowerCase();
    case Operator.NE:
      if (isNull(cellValue) && targetValue == null) return false;
      if (isNull(cellValue)) return true;
      return String(cellValue).trim().toLowerCase() !== String(targetValue ?? '').trim().toLowerCase();
    case Operator.GT:
      return compareAsNumber(cellValue, targetValue) > 0;
    case Operator.GTE:
      return compareAsNumber(cellValue, targetValue) >= 0;
    case Operator.LT:
      return compareAsNumber(cellValue, targetValue) < 0;
    case Operator.LTE:
      return compareAsNumber(cellValue, targetValue) <= 0;
    case Operator.STARTS_WITH:
      if (isNull(cellValue)) return false;
      return String(cellValue).toLowerCase().startsWith(String(targetValue ?? '').toLowerCase());
    case Operator.ENDS_WITH:
      if (isNull(cellValue)) return false;
      return String(cellValue).toLowerCase().endsWith(String(targetValue ?? '').toLowerCase());
    case Operator.BETWEEN: {
      const range = targetValue as { start: unknown; end: unknown };
      return compareAsNumber(cellValue, range.start) >= 0 && compareAsNumber(cellValue, range.end) <= 0;
    }
    default:
      return String(cellValue ?? '') === String(targetValue ?? '');
  }
}

function compareAsNumber(a: unknown, b: unknown): number {
  const na = Number(a);
  const nb = Number(b);
  if (isNaN(na) || isNaN(nb)) return String(a ?? '').localeCompare(String(b ?? ''));
  return na - nb;
}
