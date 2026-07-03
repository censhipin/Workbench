// ============================================================
// DedupExecutor
// ============================================================

import { dedupRows } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class DedupExecutor implements OperationExecutor {
  readonly type = 'dedup';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'dedup') {
      throw new Error(`DedupExecutor 收到错误 type: ${plan.type}`);
    }

    const r = dedupRows(ctx.mainSheet.rows, plan.columns);

    return {
      result: { columns: ctx.mainSheet.columns, rows: r.result },
      summary: {
        totalRecords: r.result.length,
        beforeCount: ctx.mainSheet.rows.length,
        afterCount: r.result.length,
        deletedCount: r.deleted,
      },
    };
  }
}
