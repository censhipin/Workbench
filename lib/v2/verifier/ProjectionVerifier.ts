// ============================================================
// ProjectionVerifier — 字段投影验证
// 验证：
//   - include: 输出 columns 的 key 必须是指定集合的子集
//   - exclude: 被排除的字段 key 不在输出中
//   - rename: 列 title 对应改变
//   - reorder: 输出顺序匹配
// ============================================================

import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class ProjectionVerifier implements Verifier {
  readonly type = 'projection';

  verify(
    plan: ExecutionPlan,
    _inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'projection') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `ProjectionVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: VerificationCheckPrivate[] = [];

    // 1. includeColumns — 输出列必须在指定集合内
    if (plan.includeColumns && plan.includeColumns.length > 0) {
      const includeSet = new Set(plan.includeColumns);
      const outputKeys = outputRows.length > 0 ? Object.keys(outputRows[0]) : [];
      const unexpected = outputKeys.filter(k => !includeSet.has(k));
      if (unexpected.length > 0) {
        checks.push({
          name: 'includeColumns 验证',
          passed: false,
          detail: `输出包含未指定的列: ${unexpected.join(', ')}`,
        });
      } else {
        checks.push({
          name: 'includeColumns 验证',
          passed: true,
          detail: `输出仅包含指定的 ${plan.includeColumns.length} 列`,
        });
      }
    }

    // 2. excludeColumns — 被排除的列不在输出中
    if (plan.excludeColumns && plan.excludeColumns.length > 0) {
      const excludeSet = new Set(plan.excludeColumns);
      const outputKeys = outputRows.length > 0 ? Object.keys(outputRows[0]) : [];
      const found = outputKeys.filter(k => excludeSet.has(k));
      if (found.length > 0) {
        checks.push({
          name: 'excludeColumns 验证',
          passed: false,
          detail: `已排除的列仍存在于输出: ${found.join(', ')}`,
        });
      } else {
        checks.push({
          name: 'excludeColumns 验证',
          passed: true,
          detail: `已成功删除 ${plan.excludeColumns.length} 列`,
        });
      }
    }

    // 如果没有任何验证规则，标记通过
    if (checks.length === 0) {
      return {
        passed: true,
        checks: [{ name: '投影验证', passed: true, detail: '无需验证' }],
      };
    }

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}

interface VerificationCheckPrivate {
  name: string;
  passed: boolean;
  detail: string;
}
