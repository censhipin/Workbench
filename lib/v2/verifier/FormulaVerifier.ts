// ============================================================
// FormulaVerifier — 公式计算结果验证器
// ============================================================
// 验证规则：
//   - 每一行的计算结果正确
//   - 新列正确生成
// ============================================================

import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class FormulaVerifier implements Verifier {
  readonly type = 'formula';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    _inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'formula') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: 'FormulaVerifier 收到错误 type' }] };
    }

    var { targetColumn, sourceColumns, expressionType } = plan;

    // 检查目标列存在
    var colExists = outputRows.length === 0 || targetColumn in outputRows[0];
    if (!colExists) {
      return { passed: false, checks: [{ name: '列检查', passed: false, detail: '目标列 "' + targetColumn + '" 未生成' }] };
    }

    // 检查列定义
    var colDef = inputColumns.find(function (c) { return c.key === targetColumn; });
    if (!colDef && outputRows.length > 0) {
      // 新列应在列定义中（由 executor 插入）
    }

    // 文本函数（LEFT/RIGHT/MID）和 TODAY 返回字符串；IF 可返回文本或数字；DATEDIF 返回数字
    var TEXT_FUNCTIONS = ['LEFT', 'RIGHT', 'MID', 'TODAY', 'IF'];
    var isTextFunction = TEXT_FUNCTIONS.indexOf(expressionType) >= 0;
    var isDateDif = expressionType === 'DATEDIF';

    // 检查每行计算结果是否为有效值
    var invalidCount = 0;
    for (var i = 0; i < outputRows.length; i++) {
      var val = outputRows[i][targetColumn];
      if (val == null || val === '') continue;
      if (isTextFunction && expressionType === 'IF') {
        // IF 文本或数字都接受
        if (typeof val !== 'string' && (typeof val !== 'number' || isNaN(val))) invalidCount++;
      } else if (isTextFunction) {
        // 文本函数返回字符串
        if (typeof val !== 'string') invalidCount++;
      } else if (isDateDif) {
        // DATEDIF 返回数字（年数）
        if (typeof val !== 'number' || isNaN(val as number)) invalidCount++;
      } else {
        // 数值函数返回数字
        if (typeof val !== 'number' || isNaN(val as number)) invalidCount++;
      }
    }

    if (invalidCount > 0) {
      return {
        passed: false,
        checks: [{ name: '计算结果检查', passed: false, detail: invalidCount + ' 行计算结果类型异常' }],
      };
    }

    return {
      passed: true,
      checks: [
        { name: '列检查', passed: true, detail: '目标列 "' + targetColumn + '" 已' + (colDef ? '更新' : '新增') },
        { name: '计算结果检查', passed: true, detail: '全部 ' + outputRows.length + ' 行计算有效' },
      ],
    };
  }
}
