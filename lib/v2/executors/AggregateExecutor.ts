// ============================================================
// AggregateExecutor — 聚合执行器（重构版）
// ============================================================
// 流程：
//   1. 有 groupBy → Map<Key, Rows[]> → 每组计算 → 输出 GroupCount 行
//   2. 无 groupBy → 全局聚合 → 输出 1 行
// 支持：COUNT / SUM / AVG / MAX / MIN
// 多列聚合：每列各自计算，合并到同一行
// ============================================================

import type { RowData, ColumnDef } from '@/lib/types';
import { AggMethod } from '../execution-plan';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class AggregateExecutor implements OperationExecutor {
  readonly type = 'aggregate';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'aggregate') {
      throw new Error(`AggregateExecutor 收到错误 type: ${plan.type}`);
    }

    const { method, columns, groupBy } = plan;
    const inputRows = ctx.mainSheet.rows;
    const inputColumns = ctx.mainSheet.columns;

    if (!columns || columns.length === 0) {
      return {
        result: { columns: inputColumns, rows: [] },
        summary: { totalRecords: 0 },
      };
    }

    // 构建分组 Map
    const groups = groupBy && groupBy.length > 0
      ? buildGroups(inputRows, groupBy)
      : null;

    // 分组聚合
    if (groups) {
      return executeGroupedAggregation(groups, groupBy!, method, columns, inputColumns, inputRows);
    }

    // 无分组：全局聚合
    return executeGlobalAggregation(method, columns, inputColumns, inputRows);
  }
}

// ============================================================
// 分组逻辑
// ============================================================

interface GroupEntry {
  key: string;
  keyValues: (string | null)[];
  rows: RowData[];
}

function buildGroups(rows: RowData[], groupByCols: string[]): GroupEntry[] {
  const map = new Map<string, GroupEntry>();
  for (const row of rows) {
    const vals = groupByCols.map(c => row[c] as string | null ?? null);
    const key = vals.join('||');
    if (!map.has(key)) {
      map.set(key, { key, keyValues: vals, rows: [] });
    }
    map.get(key)!.rows.push(row);
  }
  return Array.from(map.values());
}

// ============================================================
// 分组聚合执行
// ============================================================

function executeGroupedAggregation(
  groups: GroupEntry[],
  groupByCols: string[],
  method: AggMethod,
  aggColumns: string[],
  inputColumns: ColumnDef[],
  inputRows: RowData[],
): ExecutorResult {
  const methodLabel = aggMethodLabel(method);

  // 构建结果列：分组列 + 聚合列
  const resultCols: ColumnDef[] = [];
  for (const gCol of groupByCols) {
    const def = inputColumns.find(c => c.key === gCol);
    resultCols.push(def || { key: gCol, title: gCol, type: 'text' });
  }
  for (const aCol of aggColumns) {
    const def = inputColumns.find(c => c.key === aCol);
    resultCols.push({
      key: `${aCol}_${methodLabel}`,
      title: def ? `${def.title}_${methodLabel}` : `${aCol}_${methodLabel}`,
      type: 'number',
    });
  }

  const resultRows: RowData[] = [];

  for (const group of groups) {
    const row: RowData = {};
    // 分组键值
    groupByCols.forEach((c, i) => { row[c] = group.keyValues[i]; });

    // 每列聚合
    for (const aCol of aggColumns) {
      const nums = group.rows
        .map(r => r[aCol])
        .filter(v => v != null && v !== '' && !isNaN(Number(v)))
        .map(Number);
      const resultKey = `${aCol}_${methodLabel}`;
      row[resultKey] = aggregate(nums, method);
    }

    resultRows.push(row);
  }

  return {
    result: { columns: resultCols, rows: resultRows },
    summary: { totalRecords: resultRows.length },
  };
}

// ============================================================
// 全局聚合执行（无分组）
// ============================================================

function executeGlobalAggregation(
  method: AggMethod,
  aggColumns: string[],
  inputColumns: ColumnDef[],
  inputRows: RowData[],
): ExecutorResult {
  const methodLabel = aggMethodLabel(method);

  const row: RowData = {};
  const resultCols: ColumnDef[] = [];

  for (const aCol of aggColumns) {
    const def = inputColumns.find(c => c.key === aCol);
    const nums = inputRows
      .map(r => r[aCol])
      .filter(v => v != null && v !== '' && !isNaN(Number(v)))
      .map(Number);
    const resultKey = `${aCol}_${methodLabel}`;
    const resultTitle = def ? `${def.title}_${methodLabel}` : `${aCol}_${methodLabel}`;

    row[resultKey] = aggregate(nums, method);
    resultCols.push({ key: resultKey, title: resultTitle, type: 'number' });
  }

  return {
    result: { columns: resultCols, rows: [row] },
    summary: { totalRecords: 1 },
  };
}

// ============================================================
// 辅助函数
// ============================================================

function aggregate(nums: number[], method: AggMethod): number | null {
  if (nums.length === 0) {
    // SUM/COUNT 的单位元是 0，AVG/MAX/MIN 无法计算
    switch (method) {
      case AggMethod.SUM:
      case AggMethod.COUNT:
        return 0;
      case AggMethod.AVG:
      case AggMethod.MAX:
      case AggMethod.MIN:
      default:
        return null;
    }
  }

  switch (method) {
    case AggMethod.SUM:
      return roundFloat(nums.reduce((a, b) => a + b, 0));
    case AggMethod.AVG:
      return roundFloat(nums.reduce((a, b) => a + b, 0) / nums.length);
    case AggMethod.COUNT:
      return nums.length;
    case AggMethod.MAX:
      return Math.max(...nums);
    case AggMethod.MIN:
      return Math.min(...nums);
    default:
      return 0;
  }
}

function roundFloat(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 1e10) / 1e10;
}

function aggMethodLabel(method: AggMethod): string {
  const map: Record<AggMethod, string> = {
    [AggMethod.SUM]: '合计',
    [AggMethod.AVG]: '平均',
    [AggMethod.COUNT]: '计数',
    [AggMethod.MAX]: '最大',
    [AggMethod.MIN]: '最小',
  };
  return map[method];
}
