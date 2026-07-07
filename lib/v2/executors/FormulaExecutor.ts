// ============================================================
// FormulaExecutor — 公式计算执行器（AST 重构版）
// ============================================================
// 完全 AST 化，废弃旧 130+ 行 switch 方案
//
// 流程：
//   1. 优先从 plan.expression 字符串解析为 AST
//   2. 无 expression 时从结构化字段构建 AST
//   3. AST Evaluator 递归求值
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import { executeFormula } from './formula-ast/builder';
import { tokenize } from './formula-ast/tokenizer';
import { Parser } from './formula-ast/parser';
import { evaluate, buildColMap } from './formula-ast/evaluator';
import type { ASTNode, EvalContext } from './formula-ast/types';
import { AppError, ErrorCodes } from '@/lib/v3/error-codes';

export class FormulaExecutor implements OperationExecutor {
  readonly type = 'formula';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'formula') {
      throw new Error(`FormulaExecutor 收到错误 type: ${plan.type}`);
    }

    const { targetColumn, sourceColumns, expressionType, decimalPlaces } = plan;
    const inputColumns = ctx.mainSheet.columns;
    const inputRows = ctx.mainSheet.rows;

    // 确定目标列的 title
    const existingCol = inputColumns.find(c => c.key === targetColumn);
    const targetTitle = existingCol?.title ?? targetColumn;

    // 使用 AST 执行公式计算
    const result = executeFormula(plan, inputRows, inputColumns);

    let resultRows: RowData[];

    if (result.error) {
      // 解析失败 → 抛出结构化错误，让上层 Explain 层处理
      throw new AppError(
        result.error.includes('括号')
          ? { ...ErrorCodes.COMP_UNKNOWN_TYPE, code: 'FORMULA_PARSE_ERROR', message: '公式解析失败' }
          : { ...ErrorCodes.COMP_UNKNOWN_TYPE, code: 'FORMULA_PARSE_ERROR', message: '公式解析失败' },
        result.error,
      );
    } else {
      // 小数位统一处理
      resultRows = inputRows.map((row, i) => {
        let val = result.values[i] ?? null;
        if (decimalPlaces !== undefined && val !== null && typeof val === 'number') {
          const factor = Math.pow(10, decimalPlaces);
          val = Math.round(val * factor) / factor;
        }
        return { ...row, [targetColumn]: val };
      });
    }

    // 列管理
    let resultColumns: ColumnDef[];
    if (existingCol) {
      resultColumns = inputColumns;
    } else {
      const insertAfter = sourceColumns[sourceColumns.length - 1];
      let insertIdx = inputColumns.length;
      for (let i = 0; i < inputColumns.length; i++) {
        if (inputColumns[i].key === insertAfter) { insertIdx = i + 1; break; }
      }
      resultColumns = inputColumns.slice();
      resultColumns.splice(insertIdx, 0, {
        key: targetColumn,
        title: targetTitle,
        type: 'number',
      });
    }

    return {
      result: { columns: resultColumns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
        modifiedCount: result.error ? 0 : inputRows.length,
      },
    };
  }
}
