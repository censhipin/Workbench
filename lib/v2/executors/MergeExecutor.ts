// ============================================================
// MergeExecutor
// ============================================================

import { mergeTables } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class MergeExecutor implements OperationExecutor {
  readonly type = 'merge';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'merge') {
      throw new Error(`MergeExecutor 收到错误 type: ${plan.type}`);
    }

    if (!ctx.taskSheets || ctx.taskSheets.length < 2) {
      throw new Error('合并需要至少 2 个表');
    }

    const r = mergeTables(ctx.taskSheets);

    return {
      result: { columns: r.columns, rows: r.rows },
      summary: { totalRecords: r.rows.length },
    };
  }
}
