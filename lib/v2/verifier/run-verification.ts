// ============================================================
// runVerification — V2 验证入口
// ============================================================
// 职责：根据 ExecutionPlan 查找对应 Verifier，执行验证
// 输入：plan（原始执行计划）、inputRows（执行前）、outputRows（执行后）
// 输出：VerificationResult
// ============================================================

import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '../../types';
import { verifierRegistry } from '../verifier/registry';
import type { VerificationResult } from '../verifier/types';

/**
 * 对 V2 ExecutionPlan 的执行结果进行验证
 *
 * @param plan        原始 ExecutionPlan
 * @param inputColumns 输入列定义
 * @param inputRows   执行前的完整数据行
 * @param outputRows  执行后的结果数据行
 * @returns           验证结果（passed + checks）
 */
export function runVerification(
  plan: ExecutionPlan,
  inputColumns: ColumnDef[],
  inputRows: RowData[],
  outputRows: RowData[],
): VerificationResult {
  const verifier = verifierRegistry.get(plan.type);
  if (!verifier) {
    return {
      passed: true, // 无验证器时默认通过
      checks: [{ name: '结果验证', passed: true, detail: `"${plan.type}" 无需验证` }],
    };
  }

  return verifier.verify(plan, inputColumns, inputRows, outputRows);
}
