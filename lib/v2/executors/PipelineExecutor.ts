// ============================================================
// PipelineExecutor — 管道执行器（重构版）
// ============================================================
// 支持：
//   - 多步顺序执行（上一步输出 = 下一步输入）
//   - 递归执行嵌套 Pipeline（Pipeline 内部可以再套 Pipeline）
//   - 每步的 output 约束（limit、includeColumns 等）
// ============================================================

import { registry } from '../execution-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import { runOutputProcessor } from '../output-processor/run-output';

export class PipelineExecutor implements OperationExecutor {
  readonly type = 'pipeline';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'pipeline') {
      throw new Error(`PipelineExecutor 收到错误 type: ${plan.type}`);
    }

    let currentColumns: ColumnDef[] = ctx.mainSheet.columns;
    let currentRows: RowData[] = ctx.mainSheet.rows;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // 递归执行嵌套 Pipeline
      const executor = registry.get(step.type);
      if (!executor) {
        throw new Error(`Pipeline 第 ${i + 1} 步：不支持的操作 "${step.type}"`);
      }

      const ctxForStep: ExecutionContext = {
        mainSheet: { columns: currentColumns, rows: currentRows },
        taskSheets: ctx.taskSheets,
      };

      const stepResult = executor.execute(step, ctxForStep);

      currentColumns = stepResult.result.columns;
      currentRows = stepResult.result.rows;

      // 应用每步的 output 约束
      const stepOutput = (step as any).output;
      if (stepOutput) {
        const processed = runOutputProcessor(currentRows, currentColumns, stepOutput);
        currentColumns = processed.columns;
        currentRows = processed.rows;
      }
    }

    // 清理临时列（_temp_ 前缀的列仅用于中间计算）
    const tempKeys = currentColumns.filter(c => c.key.startsWith('_temp_')).map(c => c.key);
    if (tempKeys.length > 0) {
      currentColumns = currentColumns.filter(c => !c.key.startsWith('_temp_'));
      currentRows = currentRows.map(r => {
        const clean = { ...r };
        for (const k of tempKeys) delete clean[k];
        return clean;
      });
    }

    return {
      result: { columns: currentColumns, rows: currentRows },
      summary: {
        totalRecords: currentRows.length,
        beforeCount: ctx.mainSheet.rows.length,
        afterCount: currentRows.length,
      },
    };
  }
}
