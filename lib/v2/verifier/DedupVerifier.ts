// ============================================================
// DedupVerifier
//
// 验证规则：输出行中，按去重列组合的复合键无重复
// ============================================================

import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class DedupVerifier implements Verifier {
  readonly type = 'dedup';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'dedup') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `DedupVerifier 收到错误 type: ${plan.type}` }] };
    }

    if (plan.columns.length === 0) {
      return { passed: false, checks: [{ name: '去重验证', passed: false, detail: '无可用的去重列' }] };
    }

    const seen = new Map<string, number>();
    let hasDup = false;
    let dupKey = '';

    for (let i = 0; i < outputRows.length; i++) {
      const key = plan.columns.map(c => String(outputRows[i][c] ?? '')).join('|');
      if (seen.has(key)) {
        hasDup = true;
        dupKey = key;
        break;
      }
      seen.set(key, i);
    }

    if (hasDup) {
      return {
        passed: false,
        checks: [{
          name: '去重验证',
          passed: false,
          detail: `结果中存在重复记录（复合键: "${dupKey}"）`,
        }],
      };
    }

    return {
      passed: true,
      checks: [{
        name: '去重验证',
        passed: true,
        detail: `共 ${outputRows.length} 行，按 [${plan.columns.join(', ')}] 去重，无重复记录`,
      }],
    };
  }
}
