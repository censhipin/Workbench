// ============================================================
// AggregateExecutor
// ============================================================

import { aggregateRows } from '@/lib/data-engine';
import { AggMethod } from '../execution-plan';
import type { RowData } from '@/lib/types';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class AggregateExecutor implements OperationExecutor {
  readonly type = 'aggregate';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'aggregate') {
      throw new Error(`AggregateExecutor 收到错误 type: ${plan.type}`);
    }

    const methodStr = aggMethodToString(plan.method);
    const columns = plan.columns;
    const groupBy = plan.groupBy ?? [];

    // 有分组时优先走分组路径（不论多少聚合列）
    if (groupBy.length > 0) {
      // 对每个聚合列分别调用 aggregateRows（目前 aggregateRows 只支持单列）
      // 第一列作为主聚合，后续列额外追加
      const mainAgg = columns[0];
      if (!mainAgg) {
        return {
          result: { columns: ctx.mainSheet.columns, rows: [...ctx.mainSheet.rows] },
          summary: { totalRecords: ctx.mainSheet.rows.length },
        };
      }

      const r = aggregateRows(ctx.mainSheet.rows, groupBy, mainAgg, methodStr, ctx.mainSheet.columns);

      // 如果有多个聚合列，为剩余列再算一次并合并结果
      if (columns.length > 1) {
        for (let i = 1; i < columns.length; i++) {
          const extra = aggregateRows(ctx.mainSheet.rows, groupBy, columns[i], methodStr, ctx.mainSheet.columns);
          if (extra.rows.length > 0 && r.rows.length === extra.rows.length) {
            for (let j = 0; j < r.rows.length; j++) {
              const aggKey = Object.keys(extra.rows[j]).find(k => k !== Object.keys(r.rows[j])[0]);
              if (aggKey) r.rows[j][aggKey] = extra.rows[j][aggKey];
            }
            // 合并列定义
            for (const ec of extra.columns) {
              if (!r.columns.find(c => c.key === ec.key)) {
                r.columns.push(ec);
              }
            }
          }
        }
      }

      return {
        result: { columns: r.columns, rows: r.rows },
        summary: { totalRecords: r.rows.length },
      };
    }

    // 多列聚合（无分组）：逐列求和，追加汇总行
    if (columns.length > 1) {
      const totalRow: RowData = {};
      for (const c of ctx.mainSheet.columns) totalRow[c.key] = null;
      for (const colKey of columns) {
        const r = aggregateRows(ctx.mainSheet.rows, [], colKey, methodStr, ctx.mainSheet.columns);
        if (r.rows[0]) {
          const resultKey = Object.keys(r.rows[0])[0];
          totalRow[colKey] = r.rows[0][resultKey] ?? null;
        }
      }
      return {
        result: { columns: ctx.mainSheet.columns, rows: [...ctx.mainSheet.rows, totalRow] },
        summary: { totalRecords: ctx.mainSheet.rows.length },
      };
    }

    // 单列聚合（可分组）
    const aggCol = columns[0];
    if (!aggCol) {
      return {
        result: { columns: ctx.mainSheet.columns, rows: [...ctx.mainSheet.rows] },
        summary: { totalRecords: ctx.mainSheet.rows.length },
      };
    }

    const r = aggregateRows(ctx.mainSheet.rows, groupBy, aggCol, methodStr, ctx.mainSheet.columns);
    return {
      result: { columns: r.columns, rows: r.rows },
      summary: { totalRecords: r.rows.length },
    };
  }
}

function aggMethodToString(method: AggMethod): string {
  const map: Record<AggMethod, string> = {
    [AggMethod.SUM]: 'SUM',
    [AggMethod.AVG]: 'AVG',
    [AggMethod.COUNT]: 'COUNT',
    [AggMethod.MAX]: 'MAX',
    [AggMethod.MIN]: 'MIN',
  };
  return map[method];
}
