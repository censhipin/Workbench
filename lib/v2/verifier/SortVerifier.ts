// ============================================================
// SortVerifier
//
// 验证规则：相邻行必须满足排序子句定义的全部排序规则
// ============================================================

import { SortOrder } from '../execution-plan';
import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class SortVerifier implements Verifier {
  readonly type = 'sort';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'sort') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `SortVerifier 收到错误 type: ${plan.type}` }] };
    }

    if (plan.sorts.length === 0) {
      return { passed: true, checks: [{ name: '排序验证', passed: true, detail: '无排序条件（顺序不变）' }] };
    }

    if (outputRows.length <= 1) {
      return { passed: true, checks: [{ name: '排序验证', passed: true, detail: '0 或 1 行数据，无需验证排序' }] };
    }

    for (let i = 1; i < outputRows.length; i++) {
      const prev = outputRows[i - 1];
      const curr = outputRows[i];

      for (const sort of plan.sorts) {
        const va = prev[sort.columnKey];
        const vb = curr[sort.columnKey];
        if (va == null && vb == null) continue;
        if (va == null) {
          if (sort.order === SortOrder.ASC) {
            return { passed: false, checks: [{ name: '排序验证', passed: false, detail: `第 ${i} 行（${sort.columnKey}）空值出现在非空值之前` }] };
          }
          continue;
        }
        if (vb == null) {
          if (sort.order === SortOrder.DESC) {
            return { passed: false, checks: [{ name: '排序验证', passed: false, detail: `第 ${i} 行（${sort.columnKey}）空值出现在非空值之前` }] };
          }
          continue;
        }

        const na = Number(va), nb = Number(vb);
        let cmp: number;
        if (!isNaN(na) && !isNaN(nb)) {
          cmp = na - nb;
        } else {
          cmp = String(va).localeCompare(String(vb));
        }

        if (cmp !== 0) {
          const orderLabel = sort.order === SortOrder.ASC ? '升序' : '降序';
          const expectedOrder = sort.order === SortOrder.ASC ? cmp > 0 : cmp < 0;
          if (expectedOrder) {
            return {
              passed: false,
              checks: [{
                name: '排序验证',
                passed: false,
                detail: `第 ${i} 行（${sort.columnKey}）顺序异常：期望 ${orderLabel}，但 ${va} 出现在 ${vb} 之前`,
              }],
            };
          }
          break; // 当前排序字段满足，检查下一对行
        }
      }
    }

    const sortDescs = plan.sorts.map(s =>
      `${s.columnKey}(${s.order === SortOrder.ASC ? '↑' : '↓'})`
    ).join(', ');
    return {
      passed: true,
      checks: [{
        name: '排序验证',
        passed: true,
        detail: `共 ${outputRows.length} 行，按 [${sortDescs}] 正确排列`,
      }],
    };
  }
}
