// ============================================================
// MatchExecutor — 匹配执行器（重构版）
// ============================================================
// 默认行为：Left Join
//   - 左表全部保留
//   - 匹配到的右表值填充
//   - 未匹配的右表列填 null
//   - 不抛异常：任何匹配错误降级为保留左表
// 支持：
//   - 精确匹配
//   - 模糊匹配（归一化 + Levenshtein）
//   - 多列复合键匹配
// ============================================================

import { matchMultiTables } from '@/lib/data-engine';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';

export class MatchExecutor implements OperationExecutor {
  readonly type = 'match';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'match') {
      throw new Error(`MatchExecutor 收到错误 type: ${plan.type}`);
    }

    // 单表模式：无 taskSheets 时返回原样
    if (!ctx.taskSheets || ctx.taskSheets.length === 0) {
      return {
        result: { columns: ctx.mainSheet.columns, rows: [...ctx.mainSheet.rows] },
        summary: { totalRecords: ctx.mainSheet.rows.length },
      };
    }

    try {
      // mainSheet 作为第一个表，taskSheets 作为后续查找表
      const allTables = [
        { columns: ctx.mainSheet.columns, rows: ctx.mainSheet.rows, name: 'main' },
        ...ctx.taskSheets,
      ];
      const r = matchMultiTables(allTables);
      const totalRows = ctx.mainSheet.rows.length;
      const matched = r.summary.matchedCount || 0;
      return {
        result: { columns: r.columns, rows: r.rows },
        summary: {
          totalRecords: r.rows.length,
          matchedCount: matched,
          unmatchedCount: Math.max(0, totalRows - matched),
        },
      };
    } catch (err) {
      console.error('[MatchExecutor] 匹配失败:', err);
      // 任何匹配异常 → 降级为保留左表
      return {
        result: { columns: ctx.mainSheet.columns, rows: [...ctx.mainSheet.rows] },
        summary: { totalRecords: ctx.mainSheet.rows.length },
      };
    }
  }
}
