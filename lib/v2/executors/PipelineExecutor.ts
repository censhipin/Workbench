// ============================================================
// PipelineExecutor — 管道执行器（多步顺序执行）
// ============================================================
// 职责：将一个 PipelinePlan 中的多个 ExecutionPlan 顺序执行
// 上一步的输出作为下一步的输入
// ============================================================

import { registry } from '../execution-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan, OutputSpec } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import { runOutputProcessor } from '../output-processor/run-output';

export class PipelineExecutor implements OperationExecutor {
  readonly type = 'pipeline';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'pipeline') {
      throw new Error(`PipelineExecutor 收到错误 type: ${plan.type}`);
    }

    var currentColumns: ColumnDef[] = ctx.mainSheet.columns;
    var currentRows: RowData[] = ctx.mainSheet.rows;

    for (var i = 0; i < plan.steps.length; i++) {
      var step = plan.steps[i];
      var executor = registry.get(step.type);
      if (!executor) {
        throw new Error('Pipeline 第 ' + (i + 1) + ' 步：不支持的操作 "' + step.type + '"');
      }

      var ctxForStep: ExecutionContext = {
        mainSheet: { columns: currentColumns, rows: currentRows },
        taskSheets: ctx.taskSheets,
      };

      var stepResult = executor.execute(step, ctxForStep);

      currentColumns = stepResult.result.columns;
      currentRows = stepResult.result.rows;

      // 应用子步骤的 output 约束（如 limit、includeColumns 等）
      var stepOutput: OutputSpec | undefined | null = (step as any).output;
      if (stepOutput) {
        var processed = runOutputProcessor(currentRows, currentColumns, stepOutput);
        currentColumns = processed.columns;
        currentRows = processed.rows;
      }
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
