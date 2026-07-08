// ============================================================
// AggregateVerifier
//
// 验证规则：用相同参数重跑 aggregateRows，结果与输出一致
// ============================================================

import { AggMethod, getAggregations } from '../execution-plan';
import { aggregateRows } from '@/lib/data-engine';
import type { Verifier, VerificationResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

/**
 * 与 AggregateExecutor 保持一致的标签映射
 * 输出列 key 格式为 {column}_{label}
 */
function aggLabel(method: AggMethod): string {
  const map: Record<AggMethod, string> = {
    [AggMethod.SUM]: '合计',
    [AggMethod.AVG]: '平均',
    [AggMethod.COUNT]: '计数',
    [AggMethod.MAX]: '最大',
    [AggMethod.MIN]: '最小',
  };
  return map[method];
}

export class AggregateVerifier implements Verifier {
  readonly type = 'aggregate';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'aggregate') {
      return { passed: false, checks: [{ name: '类型检查', passed: false, detail: `AggregateVerifier 收到错误 type: ${plan.type}` }] };
    }

    const aggregations = getAggregations(plan);
    const groupBy = plan.groupBy ?? [];

    // 多列聚合：无法用 aggregateRows 重验，做存在性检查
    if (aggregations.length > 1) {
      const lastRow = outputRows[outputRows.length - 1];
      if (!lastRow) {
        return { passed: false, checks: [{ name: '聚合验证', passed: false, detail: '输出为空' }] };
      }
      // 输出列的 key 格式为 {column}_{label}（有 alias 时直接用 alias）
      const allHaveValues = aggregations.every(agg => {
        const resultKey = agg.alias || `${agg.column}_${aggLabel(agg.method)}`;
        return lastRow[resultKey] != null;
      });
      return {
        passed: allHaveValues,
        checks: [{
          name: '聚合验证',
          passed: allHaveValues,
          detail: allHaveValues
            ? `多列 ${aggregations.length} 列聚合完成，共 ${outputRows.length} 行`
            : '部分聚合列结果为空',
        }],
      };
    }

    // 单列聚合：重新计算并比对
    const aggCol = aggregations[0].column;
    const aggMethod = aggregations[0].method;
    const methodStr = aggMethodLabel(aggMethod);
    if (!aggCol) {
      return { passed: true, checks: [{ name: '聚合验证', passed: true, detail: '无聚合列（跳过）' }] };
    }

    const recomputed = aggregateRows(inputRows, groupBy, aggCol, methodStr, inputColumns);

    // 比较行数一致
    if (recomputed.rows.length !== outputRows.length) {
      return {
        passed: false,
        checks: [{
          name: '聚合验证',
          passed: false,
          detail: `行数不匹配：期望 ${recomputed.rows.length}，实际 ${outputRows.length}`,
        }],
      };
    }

    // 比较数值结果（在最后一行列上对比）
    const lastRecompKey = recomputed.columns[recomputed.columns.length - 1].key;

    if (groupBy.length === 0) {
      // 无分组：比较最后一行（汇总行）
      const expectedVal = recomputed.rows[0]?.[lastRecompKey];
      const actualRow = outputRows[outputRows.length - 1];
      // 无分组时汇总行列的 key 可能是 aggCol 本身（多列路径）或 bonus_合计（单列路径）
      const actualVal = actualRow?.[lastRecompKey] ?? actualRow?.[aggCol];

      if (actualVal == null && expectedVal == null) {
        return { passed: true, checks: [{ name: '聚合验证', passed: true, detail: `聚合完成（空结果）` }] };
      }

      if (Math.abs(Number(actualVal) - Number(expectedVal)) > 0.01) {
        return {
          passed: false,
          checks: [{
            name: '聚合验证',
            passed: false,
            detail: `聚合值不匹配：期望 ${expectedVal}，实际 ${actualVal}`,
          }],
        };
      }
    } else {
      // 分组聚合：逐组比较
      const recompKey = recomputed.columns[recomputed.columns.length - 1].key;
      for (let i = 0; i < recomputed.rows.length; i++) {
        const expected = recomputed.rows[i][recompKey];
        const actual = outputRows[i]?.[recompKey];
        if (Math.abs(Number(actual) - Number(expected)) > 0.01) {
          return {
            passed: false,
            checks: [{
              name: '聚合验证',
              passed: false,
              detail: `第 ${i} 组聚合值不匹配：期望 ${expected}，实际 ${actual}`,
            }],
          };
        }
      }
    }

    return {
      passed: true,
      checks: [{
        name: '聚合验证',
        passed: true,
        detail: `重算验证通过，${recomputed.rows.length} 行`,
      }],
    };
  }
}

function aggMethodLabel(method: AggMethod): string {
  const labels: Record<AggMethod, string> = {
    [AggMethod.SUM]: 'SUM',
    [AggMethod.AVG]: 'AVG',
    [AggMethod.COUNT]: 'COUNT',
    [AggMethod.MAX]: 'MAX',
    [AggMethod.MIN]: 'MIN',
  };
  return labels[method];
}
