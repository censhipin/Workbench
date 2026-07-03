// ============================================================
// ResultVerifier V2 — 执行结果逐条验证系统
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { ExecutionPlan } from '../execution-plan';

/** 单条验证结果 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/** 整体验证结果 */
export interface VerificationResult {
  passed: boolean;
  checks: VerificationCheck[];
}

/**
 * Verifier 接口
 * 所有验证器必须实现此接口
 *
 * verify(plan, inputRows, outputRows):
 *   - plan: 原始 ExecutionPlan（含操作参数）
 *   - inputRows: 执行前的完整数据行
 *   - outputRows: 执行后的结果数据行
 *   - 返回 VerificationResult（passed + 逐条检查详情）
 */
export interface Verifier {
  readonly type: string;
  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult;
}
