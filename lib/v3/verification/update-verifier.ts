// ============================================================
// Update Verifier — 更新验证
// ============================================================
// 验证：
//   1. 满足条件的行是否全部更新
//   2. 不满足条件的行是否未更新
//   3. 更新数量统计
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { evaluateAll } from '../../v2/predicate';

export class UpdateVerifier implements Verifier {
  readonly type = 'update';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'update') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `UpdateVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const { column, value, conditions } = plan;

    // 1) 行数不变
    checks.push({
      name: '行数检查',
      passed: inputRows.length === outputRows.length,
      detail: `输入 ${inputRows.length} 行，输出 ${outputRows.length} 行${inputRows.length !== outputRows.length ? '（不一致）' : ''}`,
    });

    if (inputRows.length !== outputRows.length) {
      return { passed: false, confidence: 0, checks, stats: { rowCount: outputRows.length, columnCount: outputColumns.length } };
    }

    // 2) 列数不变
    checks.push({
      name: '列数检查',
      passed: inputColumns.length === outputColumns.length,
      detail: `输入 ${inputColumns.length} 列，输出 ${outputColumns.length} 列`,
    });

    // 3) 条件行更新验证
    let modifiedCount = 0;
    let unmodifiedCount = 0;
    let wrongValueCount = 0;

    for (let i = 0; i < inputRows.length; i++) {
      const inRow = inputRows[i];
      const outRow = outputRows[i];
      const shouldUpdate = !conditions || conditions.length === 0 || evaluateAll(inRow as Record<string, unknown>, conditions);

      if (shouldUpdate) {
        modifiedCount++;
        if (String(outRow[column]) !== String(value)) {
          wrongValueCount++;
        }
      } else {
        unmodifiedCount++;
        // 不满足条件的行应保持不变
        if (String(inRow[column]) !== String(outRow[column])) {
          wrongValueCount++;
        }
      }
    }

    checks.push({
      name: '更新值验证',
      passed: wrongValueCount === 0,
      detail: wrongValueCount === 0
        ? `修改 ${modifiedCount} 行，未修改 ${unmodifiedCount} 行，全部值正确`
        : `${wrongValueCount} 行值不符合预期`,
    });

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? computeUpdateConf(checks) : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: inputRows.length,
        outputRowCount: outputRows.length,
        modifiedCount,
        unmodifiedCount,
      },
    };
  }
}

function computeUpdateConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}
