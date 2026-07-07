// ============================================================
// ExecutionEngine V2 — ExecutionPlan 执行入口
// ============================================================
// 职责：只认 ExecutionPlan，不碰 TaskIntent
//   - 通过 OperationExecutor Registry 分发
//   - type switch 已移除，改为 registry.get(plan.type)
//   - 统一处理 OutputSpec 输出约束
// ============================================================

import { type ColumnDef, type RowData } from '../types';
import type { ExecutionPlan } from './execution-plan';
import type { ExecutionResult } from '../execution-engine';
import { runOutputProcessor } from './output-processor/run-output';
import { runVerification, registerAllVerifiers, verifierRegistry } from './verifier';
import { ExecutorRegistry } from './executors/registry';
import { FilterExecutor } from './executors/FilterExecutor';
import { SortExecutor } from './executors/SortExecutor';
import { AggregateExecutor } from './executors/AggregateExecutor';
import { DedupExecutor } from './executors/DedupExecutor';
import { MatchExecutor } from './executors/MatchExecutor';
import { MergeExecutor } from './executors/MergeExecutor';
import { CleanExecutor } from './executors/CleanExecutor';
import { ProjectionExecutor } from './executors/ProjectionExecutor';
import { UpdateExecutor } from './executors/UpdateExecutor';
import { FormulaExecutor } from './executors/FormulaExecutor';
import { PipelineExecutor } from './executors/PipelineExecutor';
import { validatePlan } from './plan-validator';
import { createSnapshot, cloneResult } from './execution-snapshot';
import type { DataProfile } from '../v3/profile/types';

/** 全局单例 registry */
export const registry = new ExecutorRegistry();

// 应用启动时自动注册所有内置执行器
registry.registerAll(
  new FilterExecutor(),
  new SortExecutor(),
  new AggregateExecutor(),
  new DedupExecutor(),
  new MatchExecutor(),
  new MergeExecutor(),
  new CleanExecutor(),
  new ProjectionExecutor(),
  new UpdateExecutor(),
  new FormulaExecutor(),
  new PipelineExecutor(),
);

// 注册所有内置 Verifier
registerAllVerifiers();

/**
 * 执行 V2 ExecutionPlan
 *
 * 输入：已编译好的 ExecutionPlan + 数据
 * 输出：ExecutionResult（与旧 runExecutionEngine 同类型）
 *
 * 通过 registry 根据 plan.type 查找对应 OperationExecutor，
 * 委托执行后再统一处理 OutputSpec 约束。
 */
export function runExecutionPlan(
  plan: ExecutionPlan,
  mainSheet: { columns: ColumnDef[]; rows: RowData[] },
  taskSheets?: { columns: ColumnDef[]; rows: RowData[]; name: string }[],
  profile?: DataProfile,
): ExecutionResult {
  try {
    // Step 1: 校验 plan（纯函数，返回已标准化的副本，不修改输入）
    const validation = validatePlan(plan, mainSheet.columns, profile);
    if (!validation.valid) {
      return {
        success: false,
        confidence: 0,
        warnings: [],
        error: `计划校验失败: ${validation.issues.filter(i => i.severity === 'error').map(i => i.message).join('；')}`,
      };
    }

    // 使用标准化后的 plan（validator 纯函数返回的可能已规范化值类型）
    const validatedPlan = validation.plan;

    // Step 2: 快照化输入数据（深度隔离 UI state）
    const snapshot = createSnapshot(mainSheet.columns, mainSheet.rows);
    const snapMainSheet = { columns: snapshot.columns, rows: snapshot.rows };
    const snapTaskSheets = taskSheets?.map(ts => ({
      ...ts,
      columns: createSnapshot(ts.columns, ts.rows).columns,
      rows: createSnapshot(ts.columns, ts.rows).rows,
    }));

    const executor = registry.get(validatedPlan.type);
    if (!executor) {
      return {
        success: false,
        confidence: 0,
        warnings: [],
        error: `不支持的 V2 操作: "${plan.type}"`,
      };
    }

    const inputRows = snapMainSheet.rows;
    const inputColumns = snapMainSheet.columns;

    const { result, summary } = executor.execute(validatedPlan, { mainSheet: snapMainSheet, taskSheets: snapTaskSheets, output: validatedPlan.output });

    // === OutputProcessor V2 — 统一输出格式处理 ===
    const processed = runOutputProcessor(result.rows, result.columns, validatedPlan.output);

    // === V2 ResultVerifier — 执行结果逐条验证 ===
    const verification = runVerification(validatedPlan, inputColumns, inputRows, processed.rows);
    if (!verification.passed) {
      const detail = verification.checks.map(c => c.detail).join('；');
      return {
        success: false,
        confidence: 0,
        warnings: verification.checks.filter(c => !c.passed).map(c => c.detail),
        error: `结果验证失败: ${detail}`,
      };
    }

    // Step 3: 输出深拷贝（确保输出不引用输入）
    const outputData = cloneResult({ columns: processed.columns, rows: processed.rows });

    return {
      success: true,
      confidence: 1,
      warnings: [],
      data: outputData,
      summary: cloneResult(summary) as any,
    };
  } catch (err) {
    return {
      success: false,
      confidence: 0,
      warnings: [],
      error: `V2 执行出错: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
