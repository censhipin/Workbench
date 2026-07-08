// ============================================================
// V2 类型定义 — 统一执行层的核心类型
// ============================================================
// 职责：定义 DataEngine V2 的标准操作符枚举和条件表达式
// 后续 TaskCompiler / ExecutionPlan 都基于此类型系统
// ============================================================

/** 统一操作符枚举（14 种） */
export enum Operator {
  EQ = 'EQ',
  NE = 'NE',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  CONTAINS = 'CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  BETWEEN = 'BETWEEN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  IS_NULL = 'IS_NULL',
  NOT_NULL = 'NOT_NULL',
}

/** 标准条件表达式 */
export interface ConditionExpr {
  /** 列 key（已解析好的机器标识，非中文 title） */
  columnKey: string;
  /** 操作符 */
  operator: Operator;
/**
   * 比较值，根据 operator 不同：
   * - 标量操作符 (EQ/NE/GT/GTE/LT/LTE/CONTAINS/STARTS_WITH/ENDS_WITH): string | number
   * - 范围操作符 (BETWEEN): { start: number | string; end: number | string }
   * - 集合操作符 (IN/NOT_IN): (string | number)[]
   * - 空值操作符 (IS_NULL/NOT_NULL): 忽略，传 null 即可
   */
  value: unknown;
  /** 比较值来自另一列（列 key），此时 value 被忽略；用于列与列比较的场景 */
  valueColumn?: string;
  /** 逻辑连接词（仅在多条件时有效，默认 AND） */
  logic?: 'AND' | 'OR';
}
