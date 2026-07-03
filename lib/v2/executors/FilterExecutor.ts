// ============================================================
// FilterExecutor
// ============================================================

import { filterRowsMulti } from '@/lib/data-engine';
import type { ConditionExpr } from '../types';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class FilterExecutor implements OperationExecutor {
  readonly type = 'filter';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'filter') {
      throw new Error(`FilterExecutor 收到错误 type: ${plan.type}`);
    }

    const conditions = plan.conditions.map((c: ConditionExpr) => ({
      column: c.columnKey,
      operator: c.operator,
      value: c.value,
      logic: c.logic,
    }));
    const rows = filterRowsMulti(ctx.mainSheet.rows, conditions);

    return {
      result: { columns: ctx.mainSheet.columns, rows },
      summary: {
        totalRecords: rows.length,
        beforeCount: ctx.mainSheet.rows.length,
        afterCount: rows.length,
      },
    };
  }
}
