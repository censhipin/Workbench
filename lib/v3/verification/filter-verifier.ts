// ============================================================
// Filter Verifier — 筛选验证
// ============================================================
// 验证：
//   1. 每行都满足 Predicate
//   2. 删除比例是否正常
//   3. 结果是否为空
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { computeTableStats } from './statistics';
import { isNull } from '../../v2/executors/null-definition';
import { evaluateAll } from '../../v2/predicate';

export class FilterVerifier implements Verifier {
  readonly type = 'filter';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'filter') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `FilterVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const conditions = plan.conditions;
    const inputStats = computeTableStats(inputRows, inputColumns);
    const outputStats = computeTableStats(outputRows, outputColumns);

    // 1) Predicate 验证：每行重新计算
    let predicateFailures = 0;
    for (const row of outputRows) {
      if (!evaluateAll(row as Record<string, unknown>, conditions)) {
        predicateFailures++;
      }
    }

    checks.push({
      name: '条件验证',
      passed: predicateFailures === 0,
      detail: predicateFailures === 0
        ? `所有 ${outputRows.length} 行均满足筛选条件`
        : `${predicateFailures} 行不满足筛选条件`,
    });

    // 2) 行数变化统计
    const removed = inputRows.length - outputRows.length;
    const removedPct = inputRows.length > 0 ? removed / inputRows.length : 0;

    checks.push({
      name: '行数变化',
      passed: true,
      detail: `输入 ${inputRows.length} 行 → 输出 ${outputRows.length} 行，删除 ${removed} 行（${(removedPct * 100).toFixed(1)}%）`,
    });

    // 3) 空结果警告
    if (outputRows.length === 0) {
      checks.push({
        name: '空结果检查',
        passed: false,
        detail: '筛选条件没有命中任何数据，结果为空',
        confidence: 0.5,
      });
    }

    // 4) 全删除警告
    if (outputRows.length === 0 && inputRows.length > 0) {
      checks.push({
        name: '全部删除检查',
        passed: false,
        detail: `所有 ${inputRows.length} 行均被删除，请检查筛选条件`,
        confidence: 0.3,
      });
    }

    // 5) 删除比例过高警告
    if (removedPct > 0.95 && inputRows.length > 0) {
      checks.push({
        name: '删除比例',
        passed: false,
        detail: `删除了 ${(removedPct * 100).toFixed(0)}% 的数据，请确认筛选条件是否正确`,
        confidence: 0.6,
      });
    }

    const passed = predicateFailures === 0;
    const confidence = passed ? computeConfidence(checks) : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: inputRows.length,
        outputRowCount: outputRows.length,
        nullCount: outputStats.nullCount,
        removedCount: removed,
        removedPct,
      },
    };
  }
}

function computeConfidence(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  const passed = checks.filter(c => c.passed).length;
  return passed / checks.length;
}
