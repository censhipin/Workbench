// ============================================================
// Dedup Verifier — 去重验证
// ============================================================
// 验证：
//   1. 输出是否还有重复行
//   2. 去重数量统计
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';

export class DedupVerifier implements Verifier {
  readonly type = 'dedup';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'dedup') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `DedupVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const dedupCols = plan.columns;

    // 1) 去重后重复检测
    const seen = new Set<string>();
    let duplicatesInOutput = 0;

    if (dedupCols.length > 0) {
      for (const row of outputRows) {
        const key = dedupCols.map(c => String(row[c] ?? '')).join('|');
        if (key && seen.has(key)) duplicatesInOutput++;
        if (key) seen.add(key);
      }
    } else {
      // 全部列去重
      for (const row of outputRows) {
        const key = outputColumns.map(c => String(row[c.key] ?? '')).join('|');
        if (key && seen.has(key)) duplicatesInOutput++;
        if (key) seen.add(key);
      }
    }

    checks.push({
      name: '重复检查',
      passed: duplicatesInOutput === 0,
      detail: duplicatesInOutput === 0
        ? '输出中无重复行'
        : `输出中仍存在 ${duplicatesInOutput} 行重复`,
    });

    // 2) 去重统计
    const removed = inputRows.length - outputRows.length;
    checks.push({
      name: '去重统计',
      passed: true,
      detail: `输入 ${inputRows.length} 行 → 输出 ${outputRows.length} 行，删除 ${removed} 行重复`,
    });

    // 3) 空结果检查
    if (outputRows.length === 0 && inputRows.length > 0) {
      checks.push({
        name: '空结果',
        passed: false,
        detail: '去重后结果为空，请检查',
        confidence: 0.3,
      });
    }

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? computeDedupConf(checks) : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: inputRows.length,
        outputRowCount: outputRows.length,
        dedupRemoved: removed,
      },
    };
  }
}

function computeDedupConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}
