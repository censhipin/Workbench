// ============================================================
// SortExecutor
// ============================================================

import { sortRowsMulti } from '@/lib/data-engine';
import { SortOrder } from '../execution-plan';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class SortExecutor implements OperationExecutor {
  readonly type = 'sort';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'sort') {
      throw new Error(`SortExecutor 收到错误 type: ${plan.type}`);
    }

    const sorters = plan.sorts.map((s) => ({
      key: s.columnKey,
      asc: s.order === SortOrder.ASC,
    }));
    const rows = sortRowsMulti(ctx.mainSheet.rows, sorters);

    return {
      result: { columns: ctx.mainSheet.columns, rows },
      summary: { totalRecords: rows.length },
    };
  }
}
