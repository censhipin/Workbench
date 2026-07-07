// ============================================================
// Projection Verifier — 投影验证
// ============================================================
// 验证：
//   1. includeColumns 约束
//   2. excludeColumns 约束
//   3. rename 正确性
//   4. reorder 正确性
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';

export class ProjectionVerifier implements Verifier {
  readonly type = 'projection';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'projection') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `ProjectionVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const outKeys = new Set(outputColumns.map(c => c.key));

    // 1) includeColumns 检查
    if (plan.includeColumns?.length) {
      const missing = plan.includeColumns.filter(c => !outKeys.has(c));
      checks.push({
        name: '包含列检查',
        passed: missing.length === 0,
        detail: missing.length === 0
          ? `指定的 ${plan.includeColumns.length} 列全部包含在输出中`
          : `${missing.length} 列未包含在输出中：${missing.join('、')}`,
      });
    }

    // 2) excludeColumns 检查
    if (plan.excludeColumns?.length) {
      const stillPresent = plan.excludeColumns.filter(c => outKeys.has(c));
      checks.push({
        name: '排除列检查',
        passed: stillPresent.length === 0,
        detail: stillPresent.length === 0
          ? `指定的 ${plan.excludeColumns.length} 列已正确排除`
          : `${stillPresent.length} 列仍存在于输出中：${stillPresent.join('、')}`,
      });
    }

    // 3) rename 检查
    if (plan.renameColumns) {
      const renameEntries = Object.entries(plan.renameColumns);
      let allRenamed = true;
      for (const [, newKey] of renameEntries) {
        if (!outKeys.has(newKey)) { allRenamed = false; break; }
      }
      checks.push({
        name: '重命名检查',
        passed: allRenamed,
        detail: allRenamed
          ? `已重命名 ${renameEntries.length} 列`
          : '部分重命名列不存在于输出中',
      });
    }

    // 4) reorder 检查
    if (plan.reorderColumns?.length) {
      const expectedOrder = plan.reorderColumns;
      const actualKeys = outputColumns.map(c => c.key);
      let orderMatch = true;
      for (let i = 0; i < Math.min(expectedOrder.length, actualKeys.length); i++) {
        if (expectedOrder[i] !== actualKeys[i]) { orderMatch = false; break; }
      }
      checks.push({
        name: '列序检查',
        passed: orderMatch,
        detail: orderMatch ? '列顺序符合要求' : '列顺序与期望不符',
      });
    }

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? 1 : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
      },
    };
  }
}
