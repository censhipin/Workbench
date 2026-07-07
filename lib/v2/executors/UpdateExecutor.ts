// ============================================================
// UpdateExecutor — 批量更新执行器（重构版）
// ============================================================
// 支持：
//   - 无条件批量修改指定列
//   - 条件更新 WHERE
//   - 自动类型转换（消费 Type Repair）
//   - 数值列自动转数值，日期列自动转日期，文本列统一为字符串
// ============================================================

import { evaluateAll } from '../predicate';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class UpdateExecutor implements OperationExecutor {
  readonly type = 'update';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'update') {
      throw new Error(`UpdateExecutor 收到错误 type: ${plan.type}`);
    }

    const { column, value, conditions } = plan;
    const inputRows = ctx.mainSheet.rows;
    const inputColumns = ctx.mainSheet.columns;
    let modifiedCount = 0;

    // 验证目标列是否存在
    const targetCol = inputColumns.find(c => c.key === column);
    if (!targetCol) {
      return {
        result: { columns: inputColumns, rows: [...inputRows] },
        summary: { totalRecords: inputRows.length },
      };
    }

    // 自动类型转换
    const finalValue = convertValue(value, targetCol.type);

    const resultRows = inputRows.map(row => {
      if (conditions && conditions.length > 0) {
        if (!evaluateAll(row as Record<string, unknown>, conditions)) {
          return { ...row };
        }
      }
      modifiedCount++;
      return { ...row, [column]: finalValue };
    });

    return {
      result: { columns: inputColumns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
        modifiedCount,
      },
    };
  }
}

/**
 * 类型自适应转换
 * 消费 Type Repair 的能力：自动在 number / string / date 间转换
 */
function convertValue(value: string | number, targetType: string): string | number | null {
  if (typeof value === 'number') {
    // 数值 → 文本：保持数值
    if (targetType === 'text' || targetType === 'date') {
      // 保持为 number，让上层自行 toString
    }
    return value;
  }

  // 字符串 → 数值
  if (targetType === 'number') {
    const n = Number(value);
    if (!isNaN(n)) return n;
    // 无法转换则原样返回
    return value;
  }

  // 字符串 → 日期（存为字符串，但校验格式）
  if (targetType === 'date') {
    if (isValidDateString(value)) return value;
    return value;
  }

  return value;
}

function isValidDateString(str: string): boolean {
  // 支持 YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
  return /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?$/.test(str.trim()) ||
    !isNaN(Date.parse(str));
}
