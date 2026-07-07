// ============================================================
// Formula Tokenizer — 分词器
// ============================================================
// 将公式字符串转为 Token 流
// 支持：数字、字符串、标识符、操作符、括号、逗号
// ============================================================

import type { Token } from './types';

/**
 * 将公式字符串分割为 Token 数组
 *
 * "工资*奖金+100" → [
 *   ident("工资"), op("*"), ident("奖金"), op("+"), number(100)
 * ]
 *
 * "IF(A>10,1,0)" → [
 *   ident("IF"), lparen, ident("A"), op(">"), number(10), comma, number(1), comma, number(0), rparen
 * ]
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // 空格 → 跳过
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++;
      continue;
    }

    // 数字（整数和小数）
    if (ch >= '0' && ch <= '9') {
      let numStr = '';
      while (i < input.length && ((input[i] >= '0' && input[i] <= '9') || input[i] === '.')) {
        numStr += input[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      continue;
    }

    // 字符串（单引号）
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = '';
      while (i < input.length && input[i] !== quote) {
        str += input[i];
        i++;
      }
      i++; // 跳过结束引号
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // 多字符操作符：>=, <=, !=, ==, &&
    if (ch === '>' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '>=' });
      i += 2;
      continue;
    }
    if (ch === '<' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '<=' });
      i += 2;
      continue;
    }
    if (ch === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '!=' });
      i += 2;
      continue;
    }
    if (ch === '=' && input[i + 1] === '=') {
      tokens.push({ type: 'op', value: '==' });
      i += 2;
      continue;
    }
    if (ch === '&' && input[i + 1] === '&') {
      tokens.push({ type: 'op', value: '&&' });
      i += 2;
      continue;
    }
    if (ch === '|' && input[i + 1] === '|') {
      tokens.push({ type: 'op', value: '||' });
      i += 2;
      continue;
    }

    // 单字符操作符
    if ('+-*/%()><=,'.includes(ch)) {
      if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
      if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
      if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue; }
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // 标识符（函数名、列名）
    if (isIdentStart(ch)) {
      let word = '';
      while (i < input.length && isIdentPart(input[i])) {
        word += input[i];
        i++;
      }
      tokens.push({ type: 'ident', value: word });
      continue;
    }

    // 无法识别的字符 → 跳过
    i++;
  }

  return tokens;
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
    ch === '_' || ch === '$' ||
    (ch >= '一' && ch <= '鿿'); // 中文
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9') ||
    ch === '.'; // 允许中文句号分隔
}
