// ============================================================
// CleanExecutor
// ============================================================

import { cleanData } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class CleanExecutor implements OperationExecutor {
  readonly type = 'clean';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'clean') {
      throw new Error(`CleanExecutor 收到错误 type: ${plan.type}`);
    }

    const r = cleanData(ctx.mainSheet.rows, ctx.mainSheet.columns);

    return {
      result: { columns: ctx.mainSheet.columns, rows: r.result },
      summary: {
        totalRecords: r.result.length,
        beforeCount: ctx.mainSheet.rows.length,
        afterCount: r.result.length,
        modifiedCount: r.removedInvalidCells,
        deletedCount: r.removedEmptyRows,
      },
    };
  }
}
