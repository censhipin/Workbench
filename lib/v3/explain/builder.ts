// ============================================================
// Explain Builder — 构建统一的 ExecutionExplanation
// ============================================================
// 输入整个执行链路上下文，输出人类可读的解释
// ============================================================

import type { ExecutionExplanation, ExplainInput } from './types';
import { buildSummary } from './summary';
import { buildWarnings } from './warning';
import { buildSuggestions } from './suggestion';
import { buildRepairSummary } from './repair-summary';
import { buildProfileDetails } from './profile-summary';
import { buildExecutionDetails } from './execution-summary';
import { buildVerificationDetails } from './verification-summary';
import { buildErrorDetails, buildErrorTitle } from './error-summary';

/**
 * 构建完整 ExecutionExplanation
 *
 * 输入整个执行链路上下文，输出统一的 ExecutionExplanation
 */
export function buildExecutionExplanation(input: ExplainInput): ExecutionExplanation {
  const {
    plan,
    profile,
    repairReport,
    executionResult,
    verificationReport,
    error,
    operationLabel,
  } = input;

  const success = executionResult?.success ?? false;

  // Title
  const title = success
    ? `成功完成${operationLabel}`
    : buildErrorTitle(error ?? null);

  // Summary
  const summary = success
    ? buildSummary(plan ?? null, operationLabel, executionResult ?? null)
    : error ?? '执行失败';

  // Detail — 合并执行细节 + 数据画像 + 验证 + 错误
  const detail: string[] = [];

  if (success) {
    // 执行细节
    const execDetails = buildExecutionDetails(plan ?? null, executionResult ?? null, profile ?? null);
    detail.push(...execDetails);

    // 验证细节
    const verDetails = buildVerificationDetails(verificationReport ?? null);
    if (verDetails.length > 0) {
      detail.push('', ...verDetails);
    }
  } else {
    // 错误细节
    const errDetails = buildErrorDetails(error ?? null);
    detail.push(...errDetails);
  }

  // Warnings
  const warnings = buildWarnings(profile ?? null, verificationReport ?? null);

  // Suggestions
  const suggestions = buildSuggestions(plan ?? null, profile ?? null, error ?? null);

  // Auto-fix summary
  const autoFixSummary = buildRepairSummary(repairReport ?? null);

  return {
    title,
    summary,
    detail,
    warnings,
    suggestions,
    autoFixSummary,
  };
}
