// ============================================================
// Formula Builder — 从 FormulaPlan 构建 AST 并求值
// ============================================================
// 桥接层：将 FormulaPlan 参数转换为 AST 树
// 避免字符串解析，直接从结构化 plan 构建 AST
// ============================================================

import type { FormulaPlan } from '../../execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import type { ASTNode, EvalContext } from './types';
import { evaluate, buildColMap } from './evaluator';
import { parseFormula } from './parser';
import { tokenize } from './tokenizer';

export interface FormulaBuildResult {
  /** 每行的计算结果 */
  values: (number | string | null)[];
  /** 失败行数 */
  failCount: number;
  /** 任何解析/计算错误 */
  error?: string;
}

/**
 * 从 FormulaPlan 执行公式计算
 * 优先使用 expression 字段解析，否则 fallback 到结构化构建
 */
export function executeFormula(
  plan: FormulaPlan,
  rows: RowData[],
  columns: ColumnDef[],
): FormulaBuildResult {
  const { expression, sourceColumns, expressionType } = plan;

  // 先用 expression 字符串解析（仅当 expression 包含真正的运算，而非简单列引用）
  if (expression && expression.trim() && containsRealExpression(expression)) {
    return executeFromExpression(expression, rows, columns, plan);
  }

  // 没有真实 expression → 从结构化字段构建
  return executeFromStructured(sourceColumns, expressionType, rows, columns, plan);
}

/** 从 expression 字符串解析并求值 */
function executeFromExpression(
  expression: string,
  rows: RowData[],
  columns: ColumnDef[],
  plan: FormulaPlan,
): FormulaBuildResult {
  // 剥离赋值前缀： "折扣金额 = 金额 * 0.9" → "金额 * 0.9"
  const cleanExpr = stripAssignment(expression);

  let ast: ASTNode;
  try {
    ast = parseFormula(cleanExpr);
  } catch (e) {
    return {
      values: [],
      failCount: rows.length,
      error: `公式解析失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let failCount = 0;
  const values: (number | string | null)[] = [];

  for (const row of rows) {
    try {
      const ctx: EvalContext = {
        row,
        columns,
        colMap: buildColMap(row, columns),
        allRows: rows,
      };
      const result = evaluate(ast, ctx);
      values.push(result);
    } catch {
      failCount++;
      values.push(null);
    }
  }

  return { values, failCount };
}

/** 剥离赋值前缀：找到第一个真正的表达式起点 */
function stripAssignment(expr: string): string {
  // 匹配 "XXX = " 前缀
  const match = expr.match(/^[^=]+=\s*/);
  if (match) {
    return expr.slice(match[0].length);
  }
  return expr;
}

/** 判断 expression 是否包含真正的运算逻辑 */
function containsRealExpression(expr: string): boolean {
  const clean = stripAssignment(expr);
  return /[+\-*\/%><=!&|]/.test(clean) || /^(IF|ROUND|ABS|SUM|AVG|MIN|MAX|LEFT|RIGHT|MID|LEN|YEAR|MONTH|DAY|TODAY|DATEDIF)/i.test(clean);
}

/** 从结构化字段构建简单表达式 */
function executeFromStructured(
  sourceColumns: string[],
  expressionType: string,
  rows: RowData[],
  columns: ColumnDef[],
  plan: FormulaPlan,
): FormulaBuildResult {
  let failCount = 0;
  const values: (number | string | null)[] = [];

  // 文本函数：直接处理，不需要 AST
  if (isTextFunction(expressionType)) {
    return executeTextFunction(expressionType, rows, columns, plan);
  }

  // 日期函数
  if (isDateFunction(expressionType)) {
    return executeDateFunction(expressionType, rows, columns, plan);
  }

  // 单值函数
  if (expressionType === 'TODAY') {
    const now = new Date();
    const val = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    return { values: rows.map(() => val), failCount: 0 };
  }

  // 条件聚合
  if (isAggIfFunction(expressionType)) {
    return executeAggIfFunction(expressionType, rows, columns, plan);
  }

  // 通用：构建二元运算 AST 或函数调用 AST
  for (const row of rows) {
    try {
      const ctx: EvalContext = {
        row,
        columns,
        colMap: buildColMap(row, columns),
        allRows: rows,
      };
      const ast = buildStructuredAST(sourceColumns, expressionType, plan, ctx);
      const result = evaluate(ast, ctx);
      values.push(result);
    } catch {
      failCount++;
      values.push(null);
    }
  }

  return { values, failCount };
}

/** 从结构化字段构建 AST */
function buildStructuredAST(
  sourceColumns: string[],
  expressionType: string,
  plan: FormulaPlan,
  ctx: EvalContext,
): ASTNode {
  const colRefs: ASTNode[] = sourceColumns.map(name => ({
    type: 'columnRef' as const,
    name,
  }));

  // IF 特殊处理
  if (expressionType === 'IF') {
    const condCol: ASTNode = { type: 'columnRef', name: plan.conditionColumn || sourceColumns[0] || '' };
    const cmpValue: ASTNode = { type: 'literal', value: plan.conditionValue ?? '' };
    const trueVal: ASTNode = plan.trueValue !== undefined
      ? { type: 'literal', value: plan.trueValue }
      : { type: 'columnRef', name: sourceColumns[0] || '' };
    const falseVal: ASTNode = plan.falseValue !== undefined
      ? { type: 'literal', value: plan.falseValue }
      : { type: 'columnRef', name: sourceColumns[sourceColumns.length > 1 ? 1 : 0] || '' };
    return { type: 'functionCall', name: 'IF', args: [condCol, cmpValue, trueVal, falseVal] };
  }

  // 数学函数
  if (expressionType === 'ROUND') {
    return { type: 'functionCall', name: 'ROUND', args: [colRefs[0], { type: 'literal', value: plan.decimalPlaces ?? 0 }] };
  }
  if (expressionType === 'ABS') {
    return { type: 'functionCall', name: 'ABS', args: colRefs };
  }
  if (expressionType === 'SUM' || expressionType === 'AVG') {
    return { type: 'functionCall', name: expressionType, args: colRefs };
  }

  // 二元运算
  if (colRefs.length >= 2) {
    let result = colRefs[0];
    for (let i = 1; i < colRefs.length; i++) {
      result = { type: 'binaryOp', operator: expressionType, left: result, right: colRefs[i] };
    }
    // 常量操作数
    if (plan.constantOperand !== undefined) {
      result = { type: 'binaryOp', operator: expressionType, left: result, right: { type: 'literal', value: plan.constantOperand } };
    }
    return result;
  }

  // 单列 + 常量
  if (colRefs.length === 1 && plan.constantOperand !== undefined) {
    return { type: 'binaryOp', operator: expressionType, left: colRefs[0], right: { type: 'literal', value: plan.constantOperand } };
  }

  return colRefs[0] || { type: 'literal', value: 0 };
}

// ============================================================
// 文本函数
// ============================================================

function isTextFunction(type: string): boolean {
  return ['LEFT', 'RIGHT', 'MID', 'LEN'].includes(type);
}

function executeTextFunction(
  type: string,
  rows: RowData[],
  columns: ColumnDef[],
  plan: FormulaPlan,
): FormulaBuildResult {
  const sourceKey = plan.sourceColumns[0];
  const charCount = plan.charCount ?? 1;
  const startPos = plan.startPos ?? 1;
  let failCount = 0;

  const values = rows.map(row => {
    const raw = row[sourceKey];
    const text = raw == null ? '' : String(raw);
    try {
      switch (type) {
        case 'LEFT': return text.slice(0, Math.max(0, charCount));
        case 'RIGHT': return text.slice(-Math.max(0, charCount));
        case 'MID': return text.slice(Math.max(0, startPos - 1), Math.max(0, startPos - 1) + charCount);
        case 'LEN': return text.length;
        default: return null;
      }
    } catch {
      failCount++;
      return null;
    }
  });

  return { values, failCount };
}

// ============================================================
// 日期函数
// ============================================================

function isDateFunction(type: string): boolean {
  return ['YEAR', 'MONTH', 'DAY', 'DATEDIF'].includes(type);
}

function executeDateFunction(
  type: string,
  rows: RowData[],
  columns: ColumnDef[],
  plan: FormulaPlan,
): FormulaBuildResult {
  const sourceKey0 = plan.sourceColumns[0];
  const sourceKey1 = plan.sourceColumns[1] || sourceKey0;
  let failCount = 0;

  const values = rows.map(row => {
    try {
      const d1 = parseDateVal(row[sourceKey0]);
      if (type === 'YEAR') return d1 ? d1.getFullYear() : null;
      if (type === 'MONTH') return d1 ? d1.getMonth() + 1 : null;
      if (type === 'DAY') return d1 ? d1.getDate() : null;
      if (type === 'DATEDIF') {
        const d2 = parseDateVal(row[sourceKey1]);
        if (!d1 || !d2) return null;
        const days = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        return Math.floor(Math.abs(days) / 365);
      }
      return null;
    } catch {
      failCount++;
      return null;
    }
  });

  return { values, failCount };
}

function parseDateVal(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && value > 59 && value < 2000000) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + value * 86400000);
  }
  const str = String(value).trim();
  const m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const m2 = str.match(/^(\d{4})[年](\d{1,2})[月](\d{1,2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return null;
}

// ============================================================
// 条件聚合函数
// ============================================================

function isAggIfFunction(type: string): boolean {
  return ['SUMIF', 'COUNTIF', 'AVERAGEIF'].includes(type);
}

function executeAggIfFunction(
  type: string,
  rows: RowData[],
  columns: ColumnDef[],
  plan: FormulaPlan,
): FormulaBuildResult {
  const condColKey = plan.conditionColumn || plan.sourceColumns[0] || '';
  const valueColKey = plan.sourceColumns[0] || condColKey;
  const condOp = plan.conditionOperator || '=';
  const condVal = plan.conditionValue ?? 0;

  const matched: number[] = [];
  for (const row of rows) {
    const cell = row[condColKey];
    const meets = compareCell(cell, condOp, condVal);
    if (meets) {
      const n = Number(row[valueColKey]);
      if (!isNaN(n)) matched.push(n);
    }
  }

  let result: number;
  if (type === 'COUNTIF') result = matched.length;
  else if (matched.length === 0) result = 0;
  else if (type === 'SUMIF') result = matched.reduce((a, b) => a + b, 0);
  else result = matched.reduce((a, b) => a + b, 0) / matched.length;

  return { values: rows.map(() => result), failCount: 0 };
}

function compareCell(cell: unknown, op: string, target: unknown): boolean {
  const sCell = String(cell ?? '');
  const sTarget = String(target ?? '');
  switch (op) {
    case '=': case '==': return sCell === sTarget;
    case '!=': return sCell !== sTarget;
    case '>': return Number(sCell) > Number(sTarget);
    case '<': return Number(sCell) < Number(sTarget);
    case '>=': return Number(sCell) >= Number(sTarget);
    case '<=': return Number(sCell) <= Number(sTarget);
    default: return sCell === sTarget;
  }
}
