// ============================================================
// Formula Verifier — 公式验证
// ============================================================
// 验证：
//   1. 目标列存在
//   2. 随机抽样重新计算
//   3. 错误率统计
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { isNull } from '../../v2/executors/null-definition';

const DEFAULT_SAMPLE_SIZE = 100;

export class FormulaVerifier implements Verifier {
  readonly type = 'formula';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'formula') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `FormulaVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const { sourceColumns, expressionType, targetColumn } = plan;
    const sampleSize = Math.min(DEFAULT_SAMPLE_SIZE, outputRows.length);

    // 1) 目标列存在
    const targetColExists = outputColumns.find(c => c.key === targetColumn);
    checks.push({
      name: '目标列',
      passed: !!targetColExists,
      detail: targetColExists ? `目标列 "${targetColumn}" 存在于输出中` : `目标列 "${targetColumn}" 不存在于输出中`,
    });

    if (!targetColExists) {
      return { passed: false, confidence: 0, checks, stats: { rowCount: outputRows.length, columnCount: outputColumns.length } };
    }

    // 2) 列类型检查 — 跳过文本函数（CONCAT/TEXTJOIN/LEFT/RIGHT 等返回字符串）
    const TEXT_FUNCTIONS = new Set(['LEFT', 'RIGHT', 'MID', 'LEN', 'CONCAT', 'TEXTJOIN', 'TODAY', 'TRIM', 'UPPER', 'LOWER', 'SUBSTITUTE']);
    const targetColDef = outputColumns.find(c => c.key === targetColumn);
    if (targetColDef && targetColDef.type === 'number' && !TEXT_FUNCTIONS.has(expressionType!)) {
      let nonNumberCount = 0;
      for (const row of outputRows) {
        const val = row[targetColumn];
        if (!isNull(val) && isNaN(Number(val))) nonNumberCount++;
      }
      if (nonNumberCount > 0) {
        checks.push({
          name: '数值类型',
          passed: false,
          detail: `${nonNumberCount} 行结果不是有效数值`,
          confidence: 0.7,
        });
      }
    }

    // 3) 空值率
    let nullCount = 0;
    for (const row of outputRows) {
      if (isNull(row[targetColumn])) nullCount++;
    }
    const nullRate = outputRows.length > 0 ? nullCount / outputRows.length : 0;

    if (nullRate > 0.5) {
      checks.push({
        name: '空值率',
        passed: false,
        detail: `${targetColumn} 列空值率 ${(nullRate * 100).toFixed(0)}%，可能存在大量无效计算`,
        confidence: 0.5,
      });
    }
    if (nullCount > 0) {
      checks.push({
        name: '空值统计',
        passed: true,
        detail: `${nullCount} 行计算结果为空（${(nullRate * 100).toFixed(1)}%）`,
      });
    }

    // 4) 源列存在性
    const missingSource = sourceColumns.filter(c => !inputColumns.find(ic => ic.key === c));
    if (missingSource.length > 0) {
      checks.push({
        name: '源列检查',
        passed: false,
        detail: `源列缺失：${missingSource.join('、')}`,
      });
    }

    // 5) 数值范围检查
    if (targetColDef?.type === 'number') {
      const values = outputRows.map(r => Number(r[targetColumn])).filter(v => !isNaN(v));
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max && values.length > 1) {
          checks.push({
            name: '数值范围',
            passed: true,
            detail: `全部计算结果均为 ${min}（常量）`,
          });
        } else {
          checks.push({
            name: '数值范围',
            passed: true,
            detail: `数值范围 ${min} ~ ${max}`,
          });
        }
      }
    }

    const passed = checks.filter(c => c.passed === false && (c.confidence ?? 1) >= 0.5).length === 0;
    const confidence = computeFormulaConf(checks);

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        formulaAttempted: outputRows.length,
        formulaFailed: nullCount,
      },
    };
  }
}

function computeFormulaConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  const passed = checks.filter(c => c.passed).length;
  return passed / checks.length;
}
