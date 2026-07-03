// ============================================================
// ProjectionExecutor — 字段选择/删除/重命名/排序
// ============================================================
// 职责：读取 ProjectionPlan，委托 OutputProcessor 处理字段
// 不自行编写字段处理逻辑
// ============================================================

import { runOutputProcessor } from '../output-processor/run-output';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class ProjectionExecutor implements OperationExecutor {
  readonly type = 'projection';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'projection') {
      throw new Error(`ProjectionExecutor 收到错误 type: ${plan.type}`);
    }

    const processed = runOutputProcessor(
      ctx.mainSheet.rows,
      ctx.mainSheet.columns,
      {
        includeColumns: plan.includeColumns,
        excludeColumns: plan.excludeColumns,
        renameColumns: plan.renameColumns,
        reorderColumns: plan.reorderColumns,
      },
    );

    return {
      result: { columns: processed.columns, rows: processed.rows },
      summary: { totalRecords: processed.rows.length },
    };
  }
}
