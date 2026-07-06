// ============================================================
// UpdateExecutor — 批量更新执行器
// ============================================================
// 支持：
//   - 无条件批量修改指定列（region = "成都"）
//   - 条件更新 WHERE（status 为空 → "未完成"）
//   - 空值填充（IS_NULL 条件）
//   - 批量替换（value 替换原有值）
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
    const targetCol = inputColumns.find(function (c) { return c.key === column; });
    if (!targetCol) {
      return {
        result: { columns: inputColumns, rows: [...inputRows] },
        summary: { totalRecords: inputRows.length, beforeCount: inputRows.length, afterCount: inputRows.length },
      };
    }

    const resultRows = inputRows.map(function (row) {
      // 如果有 WHERE 条件，不满足条件的行保持不变
      if (conditions && conditions.length > 0) {
        if (!evaluateAll(row as Record<string, unknown>, conditions)) {
          return { ...row };
        }
      }
      modifiedCount++;
      // 数值列强制转数值，避免字符串拼接
      var finalValue = value;
      if (targetCol.type === 'number' && typeof finalValue !== 'number') {
        var nv = Number(finalValue);
        if (!isNaN(nv)) finalValue = nv;
      }
      return { ...row, [column]: finalValue };
    });

    return {
      result: { columns: ctx.mainSheet.columns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
        modifiedCount,
      },
    };
  }
}
