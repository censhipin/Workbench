// ============================================================
// MatchExecutor
// ============================================================

import { matchMultiTables } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class MatchExecutor implements OperationExecutor {
  readonly type = 'match';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'match') {
      throw new Error(`MatchExecutor 收到错误 type: ${plan.type}`);
    }

    if (!ctx.taskSheets || ctx.taskSheets.length < 2) {
      throw new Error('匹配需要至少 2 个表');
    }

    const r = matchMultiTables(ctx.taskSheets);

    return {
      result: { columns: r.columns, rows: r.rows },
      summary: {
        totalRecords: r.rows.length,
        matchedCount: r.summary.matchedCount || 0,
        unmatchedCount: r.summary.unmatchedCount || 0,
      },
    };
  }
}
