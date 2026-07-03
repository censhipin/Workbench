// ============================================================
// OperationExecutor — 插件化执行器接口
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { ExecutionPlan, OutputSpec } from '../execution-plan';
import type { ExecutionResult } from '@/lib/execution-engine';

/** 执行上下文：传递给每个 Executor 的数据环境 */
export interface ExecutionContext {
  mainSheet: { columns: ColumnDef[]; rows: RowData[] };
  taskSheets?: { columns: ColumnDef[]; rows: RowData[]; name: string }[];
  output?: OutputSpec;
}

/** 执行器内部返回的原始结果 + 摘要（待统一约束处理） */
export interface ExecutorResult {
  result: { columns: ColumnDef[]; rows: RowData[] };
  summary: {
    totalRecords: number;
    beforeCount?: number;
    afterCount?: number;
    deletedCount?: number;
    modifiedCount?: number;
    matchedCount?: number;
    unmatchedCount?: number;
  };
}

/**
 * OperationExecutor 接口
 * 所有 V2 操作执行器必须实现此接口
 *
 * execute() 返回 ExecutorResult（原始执行结果）
 * 由 runExecutionPlan 统一处理 OutputSpec 约束
 */
export interface OperationExecutor {
  /** 唯一标识，与 ExecutionPlan.type 一致 */
  readonly type: string;

  /**
   * 执行操作
   * @param plan  完整 ExecutionPlan（由 registry 确保 type 匹配）
   * @param ctx   执行上下文（数据 + 输出约束）
   * @returns     原始执行结果（OutputProcessor 由外层统一处理）
   */
  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult;
}
