// ============================================================
// Formula Repair — 公式 AST 解析器
// ============================================================
// 职责：将公式字符串解析为 AST，提取列引用，校验合法性
//
// 当前 FormulaExecutor 通过 expressionType 枚举分发，
// 公式如 "数量*单价" 从未被真正解析。
// 这个解析器为后续 AST 求值奠定基础。
// ============================================================

import type { ColumnDef } from '../../types';
import type { FormulaPlan } from '../../v2/execution-plan';
import type { RepairRecord } from './repair-types';

// ============================================================
// AST 节点类型
// ============================================================

export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'columnRef'; name: string }
  | { type: 'binaryOp'; op: BinaryOp; left: ASTNode; right: ASTNode }
  | { type: 'unaryOp'; op: '-'; operand: ASTNode }
  | { type: 'funcCall'; name: string; args: ASTNode[] };

export type BinaryOp = '+' | '-' | '*' | '/' | '%' | '>' | '<' | '>=' | '<=' | '==' | '!=';

/** 公式解析结果 */
export interface FormulaParseResult {
  ast: ASTNode | null;
  referencedColumns: string[];
  isValid: boolean;
  errors: string[];
  repairs: RepairRecord[];
}

// ============================================================
// 递归下降解析器
// ============================================================

class Parser {
  private tokens: Token[];
  private pos: number;
  private repairs: RepairRecord[];

  constructor(tokens: Token[], repairs: RepairRecord[]) {
    this.tokens = tokens;
    this.pos = 0;
    this.repairs = repairs;
  }

  peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  consume(): Token {
    return this.tokens[this.pos++];
  }

  expect(type: TokenType): Token {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new Error(`期望 ${type}，实际得到 ${token?.type ?? 'EOF'} (${token?.value ?? ''})`);
    }
    return this.consume();
  }

  // expression → term (('+' | '-') term)*
  parseExpression(): ASTNode {
    let left = this.parseTerm();

    while (this.peek()?.type === 'BINARY_OP' && (this.peek() as any).value.match(/^[+\-]$/)) {
      const op = (this.consume() as BinaryOpToken).value as '+' | '-';
      const right = this.parseTerm();
      left = { type: 'binaryOp', op, left, right };
    }

    return left;
  }

  // term → factor (('*' | '/' | '%') factor)*
  parseTerm(): ASTNode {
    let left = this.parseFactor();

    while (this.peek()?.type === 'BINARY_OP' && (this.peek() as any).value.match(/^[*\/%]$/)) {
      const op = (this.consume() as BinaryOpToken).value as '*' | '/' | '%';
      const right = this.parseFactor();
      left = { type: 'binaryOp', op, left, right };
    }

    // Parse comparison operators (lower precedence than arithmetic)
    if (this.peek()?.type === 'BINARY_OP') {
      const cmpOps = ['>', '<', '>=', '<=', '==', '!='];
      const nextOp = (this.peek() as any).value;
      if (cmpOps.includes(nextOp)) {
        const op = (this.consume() as BinaryOpToken).value as BinaryOp;
        const right = this.parseTerm();
        left = { type: 'binaryOp', op, left, right };
      }
    }

    return left;
  }

  // factor → number | string | columnRef | funcCall | '(' expression ')' | '-' factor
  parseFactor(): ASTNode {
    const token = this.peek();
    if (!token) throw new Error('意外的表达式结束');

    switch (token.type) {
      case 'NUMBER': {
        this.consume();
        return { type: 'number', value: Number(token.value) };
      }
      case 'STRING': {
        this.consume();
        return { type: 'string', value: token.value };
      }
      case 'COLUMN_REF': {
        this.consume();
        return { type: 'columnRef', name: token.value };
      }
      case 'FUNC_CALL': {
        this.consume();
        const name = token.value;
        this.expect('LPAREN');
        const args: ASTNode[] = [];
        if (this.peek()?.type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek()?.type === 'COMMA') {
            this.consume();
            args.push(this.parseExpression());
          }
        }
        this.expect('RPAREN');
        return { type: 'funcCall', name, args };
      }
      case 'LPAREN': {
        this.consume();
        const inner = this.parseExpression();
        this.expect('RPAREN');
        return inner;
      }
      case 'BINARY_OP': {
        const opToken = token as BinaryOpToken;
        if (opToken.value === '-') {
          this.consume();
          const operand = this.parseFactor();
          return { type: 'unaryOp', op: '-', operand };
        }
        throw new Error(`意外的操作符: ${opToken.value}`);
      }
      default:
        throw new Error(`意外的 token: ${token.type} (${token.value})`);
    }
  }

  parseAll(): ASTNode {
    if (this.tokens.length === 0) {
      throw new Error('空表达式');
    }
    const ast = this.parseExpression();
    if (this.peek()) {
      throw new Error(`解析后仍有未处理的 token: ${this.peek()?.value}`);
    }
    return ast;
  }
}

// ============================================================
// Tokenizer
// ============================================================

type TokenType = 'NUMBER' | 'STRING' | 'COLUMN_REF' | 'FUNC_CALL' | 'BINARY_OP' | 'COMMA' | 'LPAREN' | 'RPAREN';
type BinaryOpToken = Token & { type: 'BINARY_OP'; value: string };

interface Token {
  type: TokenType;
  value: string;
}

const COMPARISON_OPS = ['>=', '<=', '==', '!=', '>', '<'];

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // 跳过空白
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }

    // 字符串字面量（单引号或双引号）
    if (expr[i] === "'" || expr[i] === '"') {
      const quote = expr[i];
      let j = i + 1;
      while (j < expr.length && expr[j] !== quote) j++;
      tokens.push({ type: 'STRING', value: expr.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // 数字常量
    if (/[0-9]/.test(expr[i]) || (expr[i] === '.' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      tokens.push({ type: 'NUMBER', value: expr.slice(i, j) });
      i = j;
      continue;
    }

    // 比较运算符 (双字符优先)
    const cmpOp = COMPARISON_OPS.find((op) => expr.startsWith(op, i));
    if (cmpOp) {
      tokens.push({ type: 'BINARY_OP', value: cmpOp });
      i += cmpOp.length;
      continue;
    }

    // 算术操作符
    if ('+-*/%'.includes(expr[i])) {
      tokens.push({ type: 'BINARY_OP', value: expr[i] });
      i++;
      continue;
    }

    // 括号和逗号
    if (expr[i] === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
    if (expr[i] === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }

    // 函数调用或列引用：中文/字母开头
    if (/[a-zA-Z_一-鿿]/.test(expr[i])) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_一-鿿]/.test(expr[j])) j++;
      const name = expr.slice(i, j);

      // 如果后面是 '(' 则是函数调用
      const trimmedIdx = skipWhitespace(expr, j);
      if (trimmedIdx < expr.length && expr[trimmedIdx] === '(') {
        tokens.push({ type: 'FUNC_CALL', value: name });
      } else {
        tokens.push({ type: 'COLUMN_REF', value: name });
      }
      i = j;
      continue;
    }

    // 无法识别的字符
    tokens.push({ type: 'COLUMN_REF', value: expr[i] });
    i++;
  }

  return tokens;
}

function skipWhitespace(expr: string, start: number): number {
  let i = start;
  while (i < expr.length && /\s/.test(expr[i])) i++;
  return i;
}

// ============================================================
// 提取列引用（从 AST 中递归提取）
// ============================================================

function extractColumnRefs(node: ASTNode): string[] {
  switch (node.type) {
    case 'columnRef':
      return [node.name];
    case 'binaryOp':
      return [...extractColumnRefs(node.left), ...extractColumnRefs(node.right)];
    case 'unaryOp':
      return extractColumnRefs(node.operand);
    case 'funcCall':
      return node.args.flatMap(extractColumnRefs);
    case 'number':
    case 'string':
      return [];
  }
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 公式表达式解析
 * 将字符串解析为 AST 并提取列引用
 */
export function parseFormula(expression: string): FormulaParseResult {
  const repairs: RepairRecord[] = [];
  const errors: string[] = [];

  if (!expression || expression.trim() === '') {
    return {
      ast: null,
      referencedColumns: [],
      isValid: false,
      errors: ['空表达式'],
      repairs,
    };
  }

  try {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens, repairs);
    const ast = parser.parseAll();
    const referencedColumns = [...new Set(extractColumnRefs(ast))];

    return {
      ast,
      referencedColumns,
      isValid: true,
      errors,
      repairs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return {
      ast: null,
      referencedColumns: [],
      isValid: false,
      errors,
      repairs,
    };
  }
}

/**
 * 公式修复入口
 * 校验 FormulaPlan 中的公式表达式并尝试修复
 */
export function repairFormulaPlan(
  plan: FormulaPlan,
  columns: ColumnDef[],
): { plan: FormulaPlan; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];

  // 如果有 expression 字段，尝试解析
  if (plan.expression) {
    const result = parseFormula(plan.expression);
    if (result.isValid) {
      // 检查提取的列引用是否都在 columns 中
      const missingCols = result.referencedColumns.filter(
        (col) => !columns.some((c) => c.key === col || c.title === col),
      );
      if (missingCols.length > 0) {
        repairs.push({
          action: 'COLUMN_INFER',
          target: plan.expression,
          original: missingCols,
          repaired: result.referencedColumns,
          confidence: 0.5,
          category: 'suggest',
          detail: `公式引用了不存在的列: ${missingCols.join(', ')}`,
        });
      }
    } else {
      repairs.push({
        action: 'FORMULA_PARSE',
        target: plan.expression,
        original: plan.expression,
        repaired: null,
        confidence: 0,
        category: 'suggest',
        detail: `公式解析失败: ${result.errors.join('; ')}`,
      });
    }
  }

  return { plan, repairs };
}
