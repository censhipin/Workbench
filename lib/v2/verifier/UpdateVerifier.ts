// ============================================================
// UpdateVerifier — 批量更新结果验证器
// ============================================================
// 验证规则：
//   - 更新后的值必须等于目标值
//   - 修改数量正确
//   - WHERE 条件正确（未命中的行不应被修改）
// ============================================================

import { evaluateAll } from '../predicate';
import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import { tryBuildExpressionEvaluator } from '../executors/UpdateExecutor';

export class UpdateVerifier implements Verifier {
  readonly type = 'update';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'update') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: 'UpdateVerifier 收到错误 type' }] };
    }

    var { column, value, conditions } = plan;
    if (inputRows.length !== outputRows.length) {
      return { passed: false, checks: [{ name: '行数检查', passed: false, detail: '更新不应改变行数' }] };
    }

    // 如果是表达式更新，构建表达式求值器用于验证
    const expressionEval = typeof value === 'string'
      ? tryBuildExpressionEvaluator(value, inputColumns)
      : null;

    var changedCount = 0;
    var unexpectedChanged = 0;
    var expectedUnchanged = 0;

    for (var i = 0; i < outputRows.length; i++) {
      var wasModified = outputRows[i][column] !== inputRows[i][column];
      var shouldModify = !conditions || conditions.length === 0 || evaluateAll(inputRows[i] as Record<string, unknown>, conditions);

      if (wasModified) {
        changedCount++;
        if (!shouldModify) unexpectedChanged++;

        var expectedValue = expressionEval
          ? expressionEval(inputRows[i])
          : value;

        if (String(outputRows[i][column]) !== String(expectedValue)) {
          return {
            passed: false,
            checks: [{ name: '值检查', passed: false, detail: '第 ' + (i + 1) + ' 行更新后的值不等于目标值' }],
          };
        }
      } else {
        if (shouldModify) expectedUnchanged++;
      }
    }

    if (unexpectedChanged > 0) {
      return {
        passed: false,
        checks: [{ name: '条件检查', passed: false, detail: unexpectedChanged + ' 行不满足WHERE条件但被修改' }],
      };
    }

    return {
      passed: true,
      checks: [
        { name: '更新数量', passed: true, detail: '修改了 ' + changedCount + '/' + inputRows.length + ' 行' },
        { name: '值验证', passed: true, detail: '所有更新行值正确' },
      ],
    };
  }
}
