// ============================================================
// MatchVerifier
//
// 验证规则：输出的匹配键值必须在输入数据中存在
// ============================================================

import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class MatchVerifier implements Verifier {
  readonly type = 'match';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'match') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `MatchVerifier 收到错误 type: ${plan.type}` }] };
    }

    if (plan.matchColumns.length === 0) {
      // 没有指定匹配键时跳过验证
      return { passed: true, checks: [{ name: '匹配验证', passed: true, detail: '无指定匹配键（跳过验证）' }] };
    }

    // 构建输入行中所有出现的复合键集合
    const validKeys = new Set<string>();
    for (const row of inputRows) {
      const key = plan.matchColumns.map(c => String(row[c] ?? '')).join('|');
      if (key) validKeys.add(key);
    }

    // 检查输出行中每条的复合键是否在输入中存在
    let missingCount = 0;
    let firstMissingKey = '';
    for (const row of outputRows) {
      const key = plan.matchColumns.map(c => String(row[c] ?? '')).join('|');
      if (key && !validKeys.has(key)) {
        missingCount++;
        if (!firstMissingKey) firstMissingKey = key;
      }
    }

    if (missingCount > 0) {
      return {
        passed: false,
        checks: [{
          name: '匹配验证',
          passed: false,
          detail: `${missingCount} 条记录的匹配键在输入中不存在（首条: "${firstMissingKey}"）`,
        }],
      };
    }

    return {
      passed: true,
      checks: [{
        name: '匹配验证',
        passed: true,
        detail: `全部 ${outputRows.length} 行匹配键有效`,
      }],
    };
  }
}
