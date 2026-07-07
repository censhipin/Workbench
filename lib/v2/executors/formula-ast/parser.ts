// ============================================================
// Formula Parser — 递归下降解析器
// ============================================================
// Token 流 → AST
//
// 优先级（从低到高）：
//   1. ||, &&
//   2. ==, !=, <, <=, >, >=
//   3. +, -
//   4. *, /, %
//   5. 一元 - !
//   6. 函数调用、括号、字面量、列引用
// ============================================================

import type { Token, ASTNode } from './types';
import { tokenize } from './tokenizer';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  /** 解析完整表达式 */
  parse(): ASTNode {
    const result = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`公式解析错误：位置 ${this.pos} 存在无法识别的字符`);
    }
    return result;
  }

  /** 顶层：|| */
  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.currentOp() === '||') {
      this.pos++;
      const right = this.parseAnd();
      left = { type: 'binaryOp', operator: '||', left, right };
    }
    return left;
  }

  /** && */
  private parseAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.currentOp() === '&&') {
      this.pos++;
      const right = this.parseComparison();
      left = { type: 'binaryOp', operator: '&&', left, right };
    }
    return left;
  }

  /** 比较：==, !=, <, <=, >, >= */
  private parseComparison(): ASTNode {
    let left = this.parseAddSub();
    const compOps = new Set(['==', '!=', '<', '<=', '>', '>=']);
    while (compOps.has(this.currentOp())) {
      const op = this.currentOp();
      this.pos++;
      const right = this.parseAddSub();
      left = { type: 'binaryOp', operator: op, left, right };
    }
    return left;
  }

  /** +, - */
  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.currentOp() === '+' || this.currentOp() === '-') {
      const op = this.currentOp();
      this.pos++;
      const right = this.parseMulDiv();
      left = { type: 'binaryOp', operator: op, left, right };
    }
    return left;
  }

  /** *, /, % */
  private parseMulDiv(): ASTNode {
    let left = this.parseUnary();
    while (this.currentOp() === '*' || this.currentOp() === '/' || this.currentOp() === '%') {
      const op = this.currentOp();
      this.pos++;
      const right = this.parseUnary();
      left = { type: 'binaryOp', operator: op, left, right };
    }
    return left;
  }

  /** 一元：-, ! */
  private parseUnary(): ASTNode {
    if (this.currentOp() === '-' || this.currentOp() === '!') {
      const op = this.currentOp();
      this.pos++;
      const operand = this.parseUnary();
      return { type: 'unaryOp', operator: op, operand };
    }
    return this.parsePrimary();
  }

  /** 基础：数字、字符串、列引用、函数调用、(表达式) */
  private parsePrimary(): ASTNode {
    if (this.pos >= this.tokens.length) {
      throw new Error('公式解析错误：表达式不完整');
    }

    const token = this.tokens[this.pos];

    if (token.type === 'number') {
      this.pos++;
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'string') {
      this.pos++;
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'lparen') {
      this.pos++;
      const expr = this.parseOr();
      if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
        throw new Error('公式解析错误：缺少右括号');
      }
      this.pos++;
      return expr;
    }

    if (token.type === 'ident') {
      const name = token.value;
      this.pos++;

      if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'lparen') {
        this.pos++;
        const args: ASTNode[] = [];

        if (this.pos < this.tokens.length && this.tokens[this.pos].type !== 'rparen') {
          args.push(this.parseOr());
          while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'comma') {
            this.pos++;
            if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'rparen') break;
            args.push(this.parseOr());
          }
        }

        if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'rparen') {
          throw new Error(`公式解析错误：函数 "${name}" 缺少右括号`);
        }
        this.pos++;

        return { type: 'functionCall', name, args };
      }

      return { type: 'columnRef', name };
    }

    // 一元 plus: +100
    if (token.type === 'op' && token.value === '+') {
      this.pos++;
      return this.parsePrimary();
    }

    throw new Error(`公式解析错误：位置 ${this.pos} 出现意外的 token`);
  }

  /** 获取当前 token 的操作符值，如果不是 op 类型则返回空字符串 */
  private currentOp(): string {
    const t = this.tokens[this.pos];
    if (t && t.type === 'op') {
      return t.value;
    }
    return '';
  }
}

/** 快捷解析函数 */
export function parseFormula(input: string): ASTNode {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}
