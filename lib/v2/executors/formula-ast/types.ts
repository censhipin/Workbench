// ============================================================
// Formula AST — 节点类型定义
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { FormulaPlan } from '../../execution-plan';

/** AST 节点联合类型 */
export type ASTNode =
  | LiteralNode
  | ColumnRefNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode;

export interface LiteralNode {
  type: 'literal';
  value: number | string | null;
}

export interface ColumnRefNode {
  type: 'columnRef';
  /** 列名（可能是 title 或 key） */
  name: string;
}

export interface BinaryOpNode {
  type: 'binaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'unaryOp';
  operator: string;
  operand: ASTNode;
}

export interface FunctionCallNode {
  type: 'functionCall';
  name: string;
  args: ASTNode[];
}

/** Evaluator 上下文 */
export interface EvalContext {
  row: RowData;
  columns: ColumnDef[];
  allRows?: RowData[];
  /** 从列名（title/key）解析到实际值的映射 */
  colMap: Record<string, string | number | null>;
}

/** Token 类型 */
export type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

/** 已知函数名 */
export const KNOWN_FUNCTIONS = new Set([
  'IF', 'ROUND', 'ABS', 'SUM', 'AVG', 'MIN', 'MAX',
  'LEFT', 'RIGHT', 'MID', 'LEN',
  'YEAR', 'MONTH', 'DAY', 'TODAY', 'DATEDIF',
  'SUMIF', 'COUNTIF', 'AVERAGEIF',
]);
