// ============================================================
// Verification Summary — 验证结果翻译
// ============================================================
// 把 VerificationReport 转换成人类可读的说明
// ============================================================

import type { VerificationReport } from '../../execution-engine';

export function buildVerificationDetails(
  verification: VerificationReport | null,
): string[] {
  if (!verification) return [];

  const lines: string[] = [];

  if (verification.passed) {
    lines.push('执行结果验证通过。');
    for (const check of verification.checks) {
      if (check.passed) {
        lines.push(`  ✓ ${check.detail}`);
      }
    }
  } else {
    lines.push('执行结果验证未通过：');
    for (const check of verification.checks) {
      if (!check.passed) {
        lines.push(`  ✗ ${check.detail}`);
      }
    }
  }

  return lines;
}
