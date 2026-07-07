// ============================================================
// Warning — 警告信息生成
// ============================================================
// 把 DataProfile 和 Verification 中的警告翻译成人话
// ============================================================

import type { DataProfile } from '../profile/types';
import type { VerificationReport } from '../../execution-engine';

export function buildWarnings(
  profile: DataProfile | null,
  verification: VerificationReport | null,
): string[] {
  const warnings: string[] = [];

  if (profile) {
    for (const w of profile.warnings) {
      warnings.push(formatProfileWarning(w));
    }

    // 空值率警告
    for (const col of profile.columns) {
      if (col.nullRate > 0.3) {
        warnings.push(
          `「${col.title}」列空值率为 ${(col.nullRate * 100).toFixed(0)}%，${describeNullImpact(col)}`,
        );
      }
    }
  }

  if (verification && !verification.passed) {
    for (const check of verification.checks) {
      if (!check.passed) {
        warnings.push(check.detail);
      }
    }
  }

  return warnings;
}

function formatProfileWarning(w: { columnKey: string; message: string; severity: string }): string {
  const prefix = w.severity === 'error' ? '⚠️' : 'ℹ️';
  return `${prefix} ${w.message}`;
}

function describeNullImpact(col: { title: string; type: string }): string {
  if (col.type === 'number') {
    return '可能影响数值计算结果的准确性。';
  }
  if (col.type === 'date') {
    return '可能影响日期分析和排序。';
  }
  return '建议检查数据完整性。';
}
