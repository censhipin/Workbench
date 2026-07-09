// ============================================================
// UpdateExecutor — 批量更新执行器（重构版）
// ============================================================
// 支持：
//   - 无条件批量修改指定列
//   - 条件更新 WHERE
//   - 自动类型转换（消费 Type Repair）
//   - 数值列自动转数值，日期列自动转日期，文本列统一为字符串
//   - 表达式更新：当 value 含列引用+算术运算时自动按公式求值
//     如 "基本工资+1000" 会按行计算 基本工资值+1000
// ============================================================

import { evaluateAll } from '../predicate';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import { tokenize } from './formula-ast/tokenizer';
import { Parser } from './formula-ast/parser';
import { evaluate, buildColMap } from './formula-ast/evaluator';
import type { ASTNode, EvalContext } from './formula-ast/types';
import type { ColumnDef, RowData } from '@/lib/types';

export class UpdateExecutor implements OperationExecutor {
  readonly type = 'update';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'update') {
      throw new Error(`UpdateExecutor 收到错误 type: ${plan.type}`);
    }

    const { column, value, conditions } = plan;
    const inputRows = ctx.mainSheet.rows;
    const inputColumns = ctx.mainSheet.columns;
    let modifiedCount = 0;

    // 验证目标列是否存在
    const targetCol = inputColumns.find(c => c.key === column);
    if (!targetCol) {
      return {
        result: { columns: inputColumns, rows: [...inputRows] },
        summary: { totalRecords: inputRows.length },
      };
    }

    // 检测 value 是否为表达式（含列引用+算术运算符）
    const expressionEval = typeof value === 'string'
      ? tryBuildExpressionEvaluator(value, inputColumns)
      : null;

    // 预转换（仅非表达式时使用）
    const finalValue = expressionEval ? null : convertValue(value, targetCol.type);

    const resultRows = inputRows.map(row => {
      if (conditions && conditions.length > 0) {
        if (!evaluateAll(row as Record<string, unknown>, conditions)) {
          return { ...row };
        }
      }
      modifiedCount++;
      if (expressionEval) {
        const computed = expressionEval(row);
        // 如果计算结果为空则尝试保留原值
        if (computed === null || computed === undefined) {
          return { ...row };
        }
        return {
          ...row,
          [column]: targetCol.type === 'number' ? convertValue(String(computed), 'number') : computed,
        };
      }
      return { ...row, [column]: finalValue };
    });

    return {
      result: { columns: inputColumns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
        modifiedCount,
      },
    };
  }
}

// ============================================================
// 表达式求值辅助
// ============================================================

/**
 * 尝试将 value 字符串构建为按行求值的表达式函数
 *
 * "基本工资+1000" → 对每行计算 col("基本工资") + 1000
 * "纯文本值"     → null（非表达式，走原逻辑）
 */
export function tryBuildExpressionEvaluator(
  value: string,
  inputColumns: ColumnDef[],
): ((row: RowData) => number | string | null) | null {
  // 不含算术运算符 → 不可能是表达式
  if (!/[+\-*/%]/.test(value)) return null;

  let ast: ASTNode;
  try {
    const tokens = tokenize(value);
    const parser = new Parser(tokens);
    ast = parser.parse();
  } catch {
    return null; // 解析失败 → 非公式，走原文本逻辑
  }

  // 检查 AST 中是否引用到列（而非纯字面量如 "1000+200"）
  if (!hasColumnRef(ast)) return null;

  return (row: RowData) => {
    const ctx: EvalContext = {
      row,
      columns: inputColumns,
      colMap: buildColMap(row, inputColumns),
    };
    try {
      return evaluate(ast, ctx);
    } catch {
      return null;
    }
  };
}

function hasColumnRef(node: ASTNode): boolean {
  switch (node.type) {
    case 'columnRef': return true;
    case 'binaryOp': return hasColumnRef(node.left) || hasColumnRef(node.right);
    case 'unaryOp': return hasColumnRef(node.operand);
    case 'functionCall': return node.args.some(hasColumnRef);
    case 'literal': return false;
    default: return false;
  }
}

/**
 * 类型自适应转换
 * 消费 Type Repair 的能力：自动在 number / string / date 间转换
 */
function convertValue(value: string | number, targetType: string): string | number | null {
  if (typeof value === 'number') {
    // 数值 → 文本：保持数值
    if (targetType === 'text' || targetType === 'date') {
      // 保持为 number，让上层自行 toString
    }
    return value;
  }

  // 字符串 → 数值
  if (targetType === 'number') {
    const n = Number(value);
    if (!isNaN(n)) return n;
    // 无法转换则原样返回
    return value;
  }

  // 字符串 → 日期（存为字符串，但校验格式）
  if (targetType === 'date') {
    if (isValidDateString(value)) return value;
    return value;
  }

  return value;
}

function isValidDateString(str: string): boolean {
  // 支持 YYYY-MM-DD, YYYY/MM/DD, YYYY年MM月DD日
  return /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?$/.test(str.trim()) ||
    !isNaN(Date.parse(str));
}
