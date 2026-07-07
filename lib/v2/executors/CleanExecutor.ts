// ============================================================
// CleanExecutor — 数据清洗执行器（重构版）
// ============================================================
// 统一使用 NullDefinition
//  - isNull() 统一空值判断
//  - isEmptyRow() 统一空行判断
//  - normalizeNull() 统一空值标准化
// ============================================================

import { cleanData } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import { isNull, isEmptyRow } from './null-definition';

export class CleanExecutor implements OperationExecutor {
  readonly type = 'clean';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'clean') {
      throw new Error(`CleanExecutor 收到错误 type: ${plan.type}`);
    }

    const inputRows = ctx.mainSheet.rows;
    const inputColumns = ctx.mainSheet.columns;

    // 使用 data-engine 的 cleanData 进行清洗
    const r = cleanData(inputRows, inputColumns);

    // 额外一步：使用 isEmptyRow 确保空行判断一致
    const filteredRows = r.result.filter(row => !isEmptyRow(row));

    const removedRows = inputRows.length - filteredRows.length;

    return {
      result: { columns: inputColumns, rows: filteredRows },
      summary: {
        totalRecords: filteredRows.length,
        beforeCount: inputRows.length,
        afterCount: filteredRows.length,
        modifiedCount: r.removedInvalidCells,
        deletedCount: removedRows,
      },
    };
  }
}
