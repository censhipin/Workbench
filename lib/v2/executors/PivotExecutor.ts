// ============================================================
// PivotExecutor — 透视表执行器
// ============================================================
// 把明细数据按行/列维度交叉汇总，类似 Excel 透视表
// 输入：明细数据（如订单表）
// 输出：交叉汇总表
// ============================================================

import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan, PivotPlan } from '../execution-plan';
import { AggMethod } from '../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

export class PivotExecutor implements OperationExecutor {
  readonly type = 'pivot';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    const p = plan as PivotPlan;
    const { rows, columns } = ctx.mainSheet;
    const { rowFields, colField, valueField, aggMethod } = p;

    // 收集行维度取值
    const rowGroups = new Map<string, RowData>();
    for (const row of rows) {
      const rowKey = rowFields.map(f => String(row[f] ?? '')).join('||');
      if (!rowGroups.has(rowKey)) {
        const base: RowData = {};
        for (const f of rowFields) base[f] = row[f];
        rowGroups.set(rowKey, base);
      }
    }

    if (!colField) {
      // 无列维度：简单分组求和
      const resultRows: RowData[] = [];
      for (const [rowKey, base] of rowGroups) {
        const groupRows = rows.filter(r => rowFields.every(f => String(r[f] ?? '') === String(base[f] ?? '')));
        const vals = groupRows.map(r => Number(r[valueField] ?? 0)).filter(v => !isNaN(v));
        const agg = calcAgg(vals, aggMethod);
        resultRows.push({ ...base, [valueField]: agg });
      }
      const resultCols = [...columns.filter(c => rowFields.includes(c.key) || c.key === valueField)];
      return {
        result: { columns: resultCols, rows: resultRows },
        summary: { totalRecords: resultRows.length },
      };
    }

    // 有列维度：收集所有列值
    const colValues = new Set<string>();
    for (const row of rows) {
      const cv = String(row[colField] ?? '(空白)');
      if (cv) colValues.add(cv);
    }
    const sortedCols = Array.from(colValues).sort();

    // 构建交叉表
    const resultCols: ColumnDef[] = [
      ...rowFields.map(f => columns.find(c => c.key === f)!).filter(Boolean),
      ...sortedCols.map(cv => ({
        key: '_pvt_' + cv,
        title: cv,
        type: 'number' as const,
      })),
    ];

    const resultRows: RowData[] = [];
    for (const [rowKey, base] of rowGroups) {
      const newRow: RowData = { ...base };
      for (const cv of sortedCols) {
        const groupRows = rows.filter(r =>
          rowFields.every(f => String(r[f] ?? '') === String(base[f] ?? '')) &&
          String(r[colField] ?? '') === cv
        );
        const vals = groupRows.map(r => Number(r[valueField] ?? 0)).filter(v => !isNaN(v));
        newRow['_pvt_' + cv] = calcAgg(vals, aggMethod);
      }
      resultRows.push(newRow);
    }

    // 加一个合计行
    const totalRow: RowData = {};
    for (const f of rowFields) totalRow[f] = '合计';
    for (const cv of sortedCols) {
      const sum = resultRows.reduce((s, r) => s + (Number(r['_pvt_' + cv]) || 0), 0);
      totalRow['_pvt_' + cv] = aggMethod === AggMethod.COUNT ? resultRows.length : sum;
    }
    resultRows.push(totalRow);

    return {
      result: { columns: resultCols, rows: resultRows },
      summary: { totalRecords: resultRows.length },
    };
  }
}

function calcAgg(values: number[], method: AggMethod): number {
  if (values.length === 0) return 0;
  switch (method) {
    case AggMethod.SUM: return values.reduce((a, b) => a + b, 0);
    case AggMethod.AVG: return values.reduce((a, b) => a + b, 0) / values.length;
    case AggMethod.COUNT: return values.length;
    case AggMethod.MAX: return Math.max(...values);
    case AggMethod.MIN: return Math.min(...values);
    default: return 0;
  }
}
