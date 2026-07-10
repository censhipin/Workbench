// ============================================================
// Formula Evaluator — AST 递归求值
// ============================================================
// 核心原则：完全递归，不写 switch
// ============================================================

import type { ASTNode, EvalContext } from './types';

/**
 * 递归求值 AST 节点
 */
export function evaluate(node: ASTNode, ctx: EvalContext): number | string | null {
  switch (node.type) {
    case 'literal':
      return node.value;

    case 'columnRef':
      return resolveColumn(node.name, ctx);

    case 'binaryOp':
      return evaluateBinaryOp(node, ctx);

    case 'unaryOp':
      return evaluateUnaryOp(node, ctx);

    case 'functionCall':
      return evaluateFunction(node, ctx);

    default:
      return null;
  }
}

function resolveColumn(name: string, ctx: EvalContext): number | string | null {
  // 直接查 colMap
  if (name in ctx.colMap) return ctx.colMap[name];
  // 通过列定义查找（title → key）
  for (const col of ctx.columns) {
    if (col.title === name || col.key === name) {
      return ctx.row[col.key] ?? null;
    }
  }
  return null;
}

/** 解析列的数值版本 */
function resolveNumber(node: ASTNode, ctx: EvalContext): number {
  const v = evaluate(node, ctx);
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function evaluateBinaryOp(node: import('./types').BinaryOpNode, ctx: EvalContext): number | string | null {
  const { operator, left, right } = node;

  switch (operator) {
    case '||': {
      const l = evaluate(left, ctx);
      if (isTruthy(l)) return l;
      return evaluate(right, ctx);
    }
    case '&&': {
      const l = evaluate(left, ctx);
      if (!isTruthy(l)) return l;
      return evaluate(right, ctx);
    }
    case '==': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      return l == r ? 1 : 0;
    }
    case '!=': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      return l != r ? 1 : 0;
    }
    case '<': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      if (l == null || r == null) return 0;
      return compareValues(l, r) < 0 ? 1 : 0;
    }
    case '<=': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      if (l == null || r == null) return 0;
      return compareValues(l, r) <= 0 ? 1 : 0;
    }
    case '>': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      if (l == null || r == null) return 0;
      return compareValues(l, r) > 0 ? 1 : 0;
    }
    case '>=': {
      const l = evaluate(left, ctx);
      const r = evaluate(right, ctx);
      if (l == null || r == null) return 0;
      return compareValues(l, r) >= 0 ? 1 : 0;
    }
    case '+': {
      const l = resolveNumber(left, ctx);
      const r = resolveNumber(right, ctx);
      return roundFloat(l + r);
    }
    case '-': {
      const l = resolveNumber(left, ctx);
      const r = resolveNumber(right, ctx);
      return roundFloat(l - r);
    }
    case '*': {
      const l = resolveNumber(left, ctx);
      const r = resolveNumber(right, ctx);
      return roundFloat(l * r);
    }
    case '/': {
      const l = resolveNumber(left, ctx);
      const r = resolveNumber(right, ctx);
      if (r === 0) return Infinity; // 除 0 返回 Infinity（保持与旧实现兼容）
      return roundFloat(l / r);
    }
    case '%': {
      const l = resolveNumber(left, ctx);
      const r = resolveNumber(right, ctx);
      if (r === 0) return 0;
      return roundFloat(l % r);
    }
    default:
      return null;
  }
}

function evaluateUnaryOp(node: import('./types').UnaryOpNode, ctx: EvalContext): number | string | null {
  const value = evaluate(node.operand, ctx);
  if (node.operator === '-') {
    if (value == null) return null;
    const n = Number(value);
    return isNaN(n) ? null : -n;
  }
  if (node.operator === '!') {
    return isTruthy(value) ? 0 : 1;
  }
  return value;
}

function evaluateFunction(node: import('./types').FunctionCallNode, ctx: EvalContext): number | string | null {
  const { name, args } = node;

  switch (name) {
    // ── 数学函数 ──
    case 'IF': {
      if (args.length < 3) return null;
      const cond = evaluate(args[0], ctx);
      const trueVal = evaluate(args[1], ctx);
      const falseVal = evaluate(args[2], ctx);
      return isTruthy(cond) ? trueVal : falseVal;
    }
    case 'ROUND': {
      const val = resolveNumber(args[0], ctx);
      const places = args.length > 1 ? resolveNumber(args[1], ctx) : 0;
      const factor = Math.pow(10, places);
      return roundFloat(Math.round(val * factor) / factor);
    }
    case 'ABS': {
      const val = resolveNumber(args[0], ctx);
      return Math.abs(val);
    }
    case 'SUM': {
      let sum = 0;
      for (const arg of args) sum += resolveNumber(arg, ctx);
      return roundFloat(sum);
    }
    case 'AVG': {
      if (args.length === 0) return 0;
      let sum = 0;
      for (const arg of args) sum += resolveNumber(arg, ctx);
      return roundFloat(sum / args.length);
    }
    case 'MIN': {
      if (args.length === 0) return 0;
      let min = resolveNumber(args[0], ctx);
      for (let i = 1; i < args.length; i++) {
        const v = resolveNumber(args[i], ctx);
        if (v < min) min = v;
      }
      return min;
    }
    case 'MAX': {
      if (args.length === 0) return 0;
      let max = resolveNumber(args[0], ctx);
      for (let i = 1; i < args.length; i++) {
        const v = resolveNumber(args[i], ctx);
        if (v > max) max = v;
      }
      return max;
    }

    // ── 文本函数 ──
    case 'LEFT': {
      const text = String(evaluate(args[0], ctx) ?? '');
      const n = args.length > 1 ? resolveNumber(args[1], ctx) : 1;
      return text.slice(0, Math.max(0, n));
    }
    case 'RIGHT': {
      const text = String(evaluate(args[0], ctx) ?? '');
      const n = args.length > 1 ? resolveNumber(args[1], ctx) : 1;
      return text.slice(-Math.max(0, n));
    }
    case 'MID': {
      const text = String(evaluate(args[0], ctx) ?? '');
      const start = Math.max(0, (args.length > 1 ? resolveNumber(args[1], ctx) : 1) - 1);
      const len = args.length > 2 ? resolveNumber(args[2], ctx) : text.length;
      return text.slice(start, start + len);
    }
    case 'LEN': {
      const text = evaluate(args[0], ctx);
      return text == null ? 0 : String(text).length;
    }
    case 'CONCAT': {
      return args.map(a => String(evaluate(a, ctx) ?? '')).join('');
    }
    case 'TEXTJOIN': {
      // TEXTJOIN(delimiter, text1, text2, ...)
      const delimiter = String(evaluate(args[0], ctx) ?? '');
      return args.slice(1).map(a => String(evaluate(a, ctx) ?? '')).join(delimiter);
    }

    // ── 文本清洗函数 ──
    case 'TRIM': {
      return String(evaluate(args[0], ctx) ?? '').trim().replace(/\s+/g, ' ');
    }
    case 'UPPER': {
      return String(evaluate(args[0], ctx) ?? '').toUpperCase();
    }
    case 'LOWER': {
      return String(evaluate(args[0], ctx) ?? '').toLowerCase();
    }
    case 'SUBSTITUTE': {
      const text = String(evaluate(args[0], ctx) ?? '');
      const oldText = String(evaluate(args[1], ctx) ?? '');
      const newText = args.length > 2 ? String(evaluate(args[2], ctx) ?? '') : '';
      if (!oldText) return text;
      return text.split(oldText).join(newText);
    }

    // ── 日期函数 ──
    case 'YEAR': {
      const d = parseDateValue(evaluate(args[0], ctx));
      return d ? d.getFullYear() : null;
    }
    case 'MONTH': {
      const d = parseDateValue(evaluate(args[0], ctx));
      return d ? d.getMonth() + 1 : null;
    }
    case 'DAY': {
      const d = parseDateValue(evaluate(args[0], ctx));
      return d ? d.getDate() : null;
    }
    case 'TODAY': {
      const now = new Date();
      return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    }
    case 'DATEDIF': {
      const d1 = parseDateValue(evaluate(args[0], ctx));
      const d2 = parseDateValue(args.length > 1 ? evaluate(args[1], ctx) : evaluate(args[0], ctx));
      if (!d1 || !d2) return null;
      const days = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      return Math.floor(Math.abs(days) / 365);
    }

    // ── 条件聚合函数（全局扫描） ──
    case 'SUMIF':
    case 'COUNTIF':
    case 'AVERAGEIF': {
      return evaluateAggregateIf(name, args, ctx);
    }

    default:
      return null;
  }
}

/** 条件聚合（SUMIF/COUNTIF/AVERAGEIF） */
function evaluateAggregateIf(
  name: string,
  args: ASTNode[],
  ctx: EvalContext,
): number | null {
  if (!ctx.allRows || args.length < 2) return null;

  // args[0] = 条件列, args[1] = 比较值, args[2] = 求和列（可选）
  const condColNode = args[0];
  const compareValue = evaluate(args[1], ctx);
  const valueColNode = args.length > 2 ? args[2] : args[0];

  const matched: number[] = [];

  for (const row of ctx.allRows) {
    const tmpCtx: EvalContext = {
      row,
      columns: ctx.columns,
      colMap: buildColMap(row, ctx.columns),
    };
    const condVal = evaluate(condColNode, tmpCtx);
    const val = Number(evaluate(valueColNode, tmpCtx));

    // 精确匹配
    if (condVal == compareValue || String(condVal) === String(compareValue)) {
      if (!isNaN(val)) matched.push(val);
    }
  }

  if (name === 'COUNTIF') return matched.length;
  if (matched.length === 0) return 0;
  if (name === 'SUMIF') return roundFloat(matched.reduce((a, b) => a + b, 0));
  return roundFloat(matched.reduce((a, b) => a + b, 0) / matched.length);
}

// ============================================================
// 辅助
// ============================================================

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
  return true;
}

function roundFloat(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 1e10) / 1e10;
}

function compareValues(a: number | string | null, b: number | string | null): number {
  const an = Number(a); const bn = Number(b);
  if (!isNaN(an) && !isNaN(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function parseDateValue(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && value > 59 && value < 2000000) {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + value * 86400000);
  }
  const str = String(value).trim();
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  let m2 = str.match(/^(\d{4})[年](\d{1,2})[月](\d{1,2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return null;
}

/** 从列定义构建 colMap */
export function buildColMap(row: Record<string, unknown>, columns: import('@/lib/types').ColumnDef[]): Record<string, string | number | null> {
  const map: Record<string, string | number | null> = {};
  for (const col of columns) {
    const v = row[col.key];
    map[col.key] = v as string | number | null ?? null;
    map[col.title] = map[col.key];
  }
  return map;
}
