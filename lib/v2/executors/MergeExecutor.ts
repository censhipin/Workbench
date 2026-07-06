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

    // 如果有指定源表名，按名过滤；否则合并所有 task sheets
    const sheetsToMerge = plan.sourceTables && plan.sourceTables.length > 0
      ? ctx.taskSheets.filter(ts => plan.sourceTables!.some(st => ts.name.includes(st) || st.includes(ts.name)))
      : ctx.taskSheets;

    if (sheetsToMerge.length < 2) {
      throw new Error('找不到需要合并的源表');
    }

    const r = mergeTables(sheetsToMerge);

    return {
      result: { columns: r.columns, rows: r.rows },
      summary: { totalRecords: r.rows.length },
    };
  }
}
