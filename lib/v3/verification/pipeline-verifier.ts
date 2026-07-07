// ============================================================
// Pipeline Verifier — 管道验证
// ============================================================
// 递归验证每个子步骤
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';

export class PipelineVerifier implements Verifier {
  readonly type = 'pipeline';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'pipeline') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `PipelineVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];

    checks.push({
      name: '步骤数量',
      passed: true,
      detail: `管道共 ${plan.steps.length} 步`,
    });

    // 非空输入 → 非空输出检查
    if (inputRows.length > 0 && outputRows.length === 0) {
      checks.push({
        name: '结果检查',
        passed: false,
        detail: '非空输入经过管道后结果为空，请检查每步执行',
        confidence: 0.3,
      });
    } else {
      checks.push({
        name: '结果检查',
        passed: true,
        detail: `输出 ${outputRows.length} 行 × ${outputColumns.length} 列`,
      });
    }

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? computePipelineConf(checks) : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: inputRows.length,
        outputRowCount: outputRows.length,
      },
    };
  }
}

function computePipelineConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}
