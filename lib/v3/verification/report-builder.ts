// ============================================================
// Report Builder — 验证报告生成器
// ============================================================
// 将 VerificationResult 转换成 Explaintion 可直接消费的格式
// ============================================================

import type { VerificationResult, VerificationCheck } from './types';

export interface FormattedReport {
  title: string;
  summary: string;
  details: string[];
  warnings: string[];
  confidence: number;
}

/**
 * 生成人类可读的验证报告
 */
export function buildVerificationReport(
  result: VerificationResult,
  operationLabel: string,
): FormattedReport {
  const details: string[] = [];
  const warnings: string[] = [];

  for (const check of result.checks) {
    if (check.passed) {
      details.push(`✓ ${check.detail}`);
    } else {
      const prefix = check.confidence !== undefined && check.confidence < 0.5 ? '⚠ ' : '✗ ';
      warnings.push(`${prefix}${check.detail}`);
    }
  }

  // 统计信息
  if (result.stats) {
    const s = result.stats;
    if (s.matchRate !== undefined) {
      details.push(`匹配率：${(s.matchRate * 100).toFixed(1)}%`);
    }
    if (s.removedCount !== undefined) {
      details.push(`删除 ${s.removedCount} 行`);
    }
    if (s.groupCount !== undefined) {
      details.push(`分组数：${s.groupCount}`);
    }
    if (s.dedupRemoved !== undefined) {
      details.push(`去重删除 ${s.dedupRemoved} 行`);
    }
  }

  const title = result.passed
    ? `${operationLabel}验证通过`
    : `${operationLabel}验证失败`;

  const summary = result.passed
    ? `验证通过（置信度 ${(result.confidence * 100).toFixed(0)}%）`
    : `验证未通过：${result.checks.filter(c => !c.passed).map(c => c.detail).join('；')}`;

  return {
    title,
    summary,
    details,
    warnings,
    confidence: result.confidence,
  };
}
