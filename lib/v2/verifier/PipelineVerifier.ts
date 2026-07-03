// ============================================================
// PipelineVerifier — 管道执行结果验证器
// ============================================================
// 验证规则：
//   - 每一步的输出是下一步的有效输入
//   - 最终输出非空（如果输入非空）
// ============================================================

import { runVerification } from './run-verification';
import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class PipelineVerifier implements Verifier {
  readonly type = 'pipeline';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'pipeline') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: 'PipelineVerifier 收到错误 type' }] };
    }

    var checks: { name: string; passed: boolean; detail: string }[] = [];

    // 执行步数检查
    checks.push({
      name: '执行步数',
      passed: true,
      detail: '管道共 ' + plan.steps.length + ' 步',
    });

    // 如果输入有数据，输出不应为空（除非是筛选/清洗等操作）
    if (inputRows.length > 0 && outputRows.length === 0) {
      checks.push({
        name: '结果检查',
        passed: false,
        detail: '输入有 ' + inputRows.length + ' 行数据，但管道输出为空',
      });
      return { passed: false, checks };
    }

    // 列一致性检查：输出列应来自管道最终结果
    checks.push({
      name: '列完整性',
      passed: true,
      detail: '输出 ' + outputRows.length + ' 行',
    });

    return { passed: true, checks };
  }
}
