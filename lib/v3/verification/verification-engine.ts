// ============================================================
// Verification Engine — 验证引擎
// ============================================================
// 对每种 Operation 分派对应 Verifier
// 形成：Execution → Verification → Report 流水线
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { VerificationResult, Verifier, VerificationEngineConfig } from './types';
import { DEFAULT_VERIFICATION_CONFIG } from './types';
import { FilterVerifier } from './filter-verifier';
import { AggregateVerifier } from './aggregate-verifier';
import { MatchVerifier } from './match-verifier';
import { FormulaVerifier } from './formula-verifier';
import { ProjectionVerifier } from './projection-verifier';
import { UpdateVerifier } from './update-verifier';
import { DedupVerifier } from './dedup-verifier';
import { CleanVerifier } from './clean-verifier';
import { PipelineVerifier } from './pipeline-verifier';
import { computeDiff } from './diff';

/** Verifier 注册表 */
const verifierMap = new Map<string, Verifier>();

/** 注册所有内置 Verifier */
export function registerAllVerifiers(): void {
  const verifiers: Verifier[] = [
    new FilterVerifier(),
    new AggregateVerifier(),
    new MatchVerifier(),
    new FormulaVerifier(),
    new ProjectionVerifier(),
    new UpdateVerifier(),
    new DedupVerifier(),
    new CleanVerifier(),
    new PipelineVerifier(),
  ];
  for (const v of verifiers) {
    verifierMap.set(v.type, v);
  }
}

/** 获取指定操作的 Verifier */
export function getVerifier(type: string): Verifier | undefined {
  return verifierMap.get(type);
}

/**
 * 执行验证
 *
 * @param plan 执行计划
 * @param inputColumns 输入列
 * @param inputRows 输入行
 * @param outputColumns 输出列
 * @param outputRows 输出行
 * @param config 可选配置
 * @returns VerificationResult
 */
export function runVerification(
  plan: ExecutionPlan,
  inputColumns: ColumnDef[],
  inputRows: RowData[],
  outputColumns: ColumnDef[],
  outputRows: RowData[],
  config: VerificationEngineConfig = DEFAULT_VERIFICATION_CONFIG,
): VerificationResult {
  const verifier = verifierMap.get(plan.type);

  if (!verifier) {
    return {
      passed: true,
      confidence: 0.5,
      checks: [{ name: '验证器', passed: true, detail: `"${plan.type}" 无专用验证器，跳过验证` }],
    };
  }

  return verifier.verify(plan, inputColumns, inputRows, outputColumns, outputRows);
}

/** 简化接口：直接传 ExecutionPlan 和输入输出 */
export function verifyExecution(
  plan: ExecutionPlan,
  inputColumns: ColumnDef[],
  inputRows: RowData[],
  outputColumns: ColumnDef[],
  outputRows: RowData[],
): VerificationResult {
  // 自动注册（幂等）
  if (verifierMap.size === 0) {
    registerAllVerifiers();
  }

  const result = runVerification(plan, inputColumns, inputRows, outputColumns, outputRows);

  // 附加 Diff
  if (!result.diff) {
    const diff = computeDiff(inputColumns, inputRows, outputColumns, outputRows);
    result.diff = diff;
  }

  return result;
}
