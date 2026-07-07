// ============================================================
// Clean Verifier — 清洗验证
// ============================================================
// 验证：
//   1. 空值是否减少
//   2. 空行是否删除
//   3. 统计汇总
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { computeTableStats } from './statistics';
import { isNull } from '../../v2/executors/null-definition';

export class CleanVerifier implements Verifier {
  readonly type = 'clean';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'clean') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `CleanVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const inputStats = computeTableStats(inputRows, inputColumns);
    const outputStats = computeTableStats(outputRows, outputColumns);

    // 1) 空值变化
    const nullReduction = inputStats.nullCount - outputStats.nullCount;
    const nullBefore = inputStats.nullCount;
    const nullAfter = outputStats.nullCount;

    checks.push({
      name: '空值清洗',
      passed: nullAfter <= nullBefore,
      detail: nullAfter <= nullBefore
        ? `空值从 ${nullBefore} 减少到 ${nullAfter}（减少 ${nullReduction}）`
        : `空值从 ${nullBefore} 增加到 ${nullAfter}（异常）`,
    });

    // 2) 空行删除
    const deletedRows = inputRows.length - outputRows.length;
    checks.push({
      name: '行数变化',
      passed: true,
      detail: `输入 ${inputRows.length} 行 → 输出 ${outputRows.length} 行，删除 ${deletedRows} 行`,
    });

    // 3) 列数检查
    const colUnchanged = inputColumns.length === outputColumns.length;
    if (inputColumns.length !== outputColumns.length) {
      checks.push({
        name: '列数检查',
        passed: false,
        detail: `列数变化：${inputColumns.length} → ${outputColumns.length}，清洗不应该增加或删除列`,
      });
    } else {
      checks.push({
        name: '列数检查',
        passed: true,
        detail: `列数正确：${outputColumns.length} 列`,
      });
    }

    const totalCells = outputRows.length * outputColumns.length;
    const cellNullRate = totalCells > 0 ? outputStats.nullCount / totalCells : 0;
    if (cellNullRate > 0.3) {
      checks.push({
        name: '清洗质量',
        passed: false,
        detail: `清洗后数据空值率仍为 ${(cellNullRate * 100).toFixed(0)}%，建议进一步清洗`,
        confidence: 0.6,
      });
    } else {
      checks.push({
        name: '清洗质量',
        passed: true,
        detail: `清洗后数据空值率 ${(cellNullRate * 100).toFixed(1)}%`,
      });
    }

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? computeCleanConf(checks) : 0;

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
        deletedCount: deletedRows,
      },
    };
  }
}

function computeCleanConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}
