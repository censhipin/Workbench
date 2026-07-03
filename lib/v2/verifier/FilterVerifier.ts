// ============================================================
// FilterVerifier
//
// 验证规则：每一行输出必须满足所有筛选条件
// 使用 predicate.ts 的 evaluateAll 逐行验证
// ============================================================

import { evaluateAll } from '../predicate';
import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class FilterVerifier implements Verifier {
  readonly type = 'filter';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'filter') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `FilterVerifier 收到错误 type: ${plan.type}` }] };
    }

    if (plan.conditions.length === 0) {
      return { passed: true, checks: [{ name: '筛选验证', passed: true, detail: '无条件筛选（返回全部数据）' }] };
    }

    let failedCount = 0;
    let firstFailedIndex = -1;

    for (let i = 0; i < outputRows.length; i++) {
      if (!evaluateAll(outputRows[i] as Record<string, unknown>, plan.conditions)) {
        failedCount++;
        if (firstFailedIndex < 0) firstFailedIndex = i;
      }
    }

    if (failedCount > 0) {
      return {
        passed: false,
        checks: [{
          name: '筛选条件验证',
          passed: false,
          detail: `${failedCount}/${outputRows.length} 行不满足筛选条件（首行索引: ${firstFailedIndex}）`,
        }],
      };
    }

    return {
      passed: true,
      checks: [{
        name: '筛选条件验证',
        passed: true,
        detail: `全部 ${outputRows.length} 行满足 ${plan.conditions.length} 个筛选条件`,
      }],
    };
  }
}
