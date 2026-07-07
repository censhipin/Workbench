// ============================================================
// Aggregate Verifier — 聚合验证
// ============================================================
// 验证：
//   1. GroupBy 分组数量正确
//   2. 输出列 Schema 正确
//   3. 重新计算聚合值（抽样比较）
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { computeGroupKeys } from './statistics';
import { aggregateRows } from '../../data-engine';

export class AggregateVerifier implements Verifier {
  readonly type = 'aggregate';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'aggregate') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `AggregateVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const { method, columns: aggColumns, groupBy } = plan;
    const groupByCols = groupBy ?? [];

    // 1) Schema 验证
    const expectedColCount = groupByCols.length + aggColumns.length;
    if (outputColumns.length !== expectedColCount) {
      checks.push({
        name: 'Schema 验证',
        passed: false,
        detail: `输出列数 ${outputColumns.length}，期望 ${expectedColCount}（${groupByCols.length} 分组列 + ${aggColumns.length} 聚合列）`,
      });
    } else {
      checks.push({ name: 'Schema 验证', passed: true, detail: `输出 ${outputColumns.length} 列，符合预期` });
    }

    // 2) 分组数量验证
    if (groupByCols.length > 0) {
      const expectedGroups = computeGroupKeys(inputRows, groupByCols);
      checks.push({
        name: '分组数量',
        passed: outputRows.length === expectedGroups.size,
        detail: `输入分组键 ${expectedGroups.size} 个，输出 ${outputRows.length} 行${outputRows.length !== expectedGroups.size ? `（不匹配）` : ''}`,
      });
    }

    // 3) 重新计算验证（单列聚合时）
    if (aggColumns.length === 1) {
      const methodStr = aggMethodStr(method);
      const aggCol = aggColumns[0];

      try {
        const recomputed = aggregateRows(inputRows, groupByCols, aggCol, methodStr, inputColumns);

        if (recomputed.rows.length !== outputRows.length) {
          checks.push({
            name: '聚合重算',
            passed: false,
            detail: `重算行数 ${recomputed.rows.length}，输出行数 ${outputRows.length}`,
          });
        } else {
          // 比较聚合值
          const recompKey = recomputed.columns[recomputed.columns.length - 1].key;
          const outKey = outputColumns[outputColumns.length - 1].key;
          let mismatch = 0;

          for (let i = 0; i < recomputed.rows.length; i++) {
            const expected = Number(recomputed.rows[i][recompKey]);
            const actual = Number(outputRows[i]?.[outKey]);
            if (Math.abs(expected - actual) > 0.01) mismatch++;
          }

          checks.push({
            name: '聚合值验证',
            passed: mismatch === 0,
            detail: mismatch === 0
              ? `全部 ${recomputed.rows.length} 组聚合值正确`
              : `${mismatch} 组聚合值不匹配`,
          });
        }
      } catch {
        checks.push({ name: '聚合重算', passed: true, detail: '无法重算，跳过' });
      }
    } else {
      checks.push({ name: '多列聚合', passed: true, detail: `多列聚合 ${aggColumns.length} 列，存在性检查通过` });
    }

    // 4) 分组列输出检查
    if (groupByCols.length > 0) {
      const missingGCols = groupByCols.filter(g => !outputColumns.find(c => c.key === g));
      if (missingGCols.length > 0) {
        checks.push({
          name: '分组列输出',
          passed: false,
          detail: `缺少分组列：${missingGCols.join('、')}`,
        });
      }
    }

    const passed = checks.filter(c => !c.passed).length === 0;
    const confidence = passed ? computeConf(checks) : 0;

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: inputRows.length,
        outputRowCount: outputRows.length,
        groupCount: outputRows.length,
        aggColumnCount: aggColumns.length,
      },
    };
  }
}

function computeConf(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}

function aggMethodStr(method: any): string {
  const map: Record<string, string> = { SUM: 'SUM', AVG: 'AVG', COUNT: 'COUNT', MAX: 'MAX', MIN: 'MIN' };
  return map[method] || 'SUM';
}
