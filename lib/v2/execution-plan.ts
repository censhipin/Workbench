// ============================================================
// ExecutionPlan — V2 统一执行协议
// ============================================================
// 职责：整个系统唯一的执行指令格式
// 所有 Plan 遵循统一风格：
//   - type: string（操作类型）
//   - 操作字段扁平排列（不套嵌套对象）
//   - 列字段统一命名为 columns / matchColumns（而非 columnKeys / matchKeys）
//   - output?: OutputSpec（可选输出约束）
// ============================================================
// SCHEMA VERSION: 1 — Freeze
// 2026-06-29: 统一字段命名、展平 AggregatePlan
// ============================================================

import { Operator, type ConditionExpr } from './types';

/** 排序方向 */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/** 聚合方法 */
export enum AggMethod {
  SUM = 'SUM',
  AVG = 'AVG',
  COUNT = 'COUNT',
  MAX = 'MAX',
  MIN = 'MIN',
}

/** 单条聚合定义（列 + 方法） */
export interface AggregationDef {
  column: string;
  method: AggMethod;
  /** 聚合结果列的自定义别名，为空时自动生成 {column}_{label} */
  alias?: string;
}

/** 从 AggregatePlan 获取聚合定义列表（兼容新旧格式） */
export function getAggregations(plan: AggregatePlan): AggregationDef[] {
  if (plan.aggregations && plan.aggregations.length > 0) return plan.aggregations;
  if (plan.columns && plan.columns.length > 0 && plan.method) {
    return plan.columns.map(col => ({ column: col, method: plan.method! }));
  }
  return [];
}

/** 排序子句 */
export interface SortClause {
  columnKey: string;
  order: SortOrder;
}

/** 输出控制 */
export interface OutputSpec {
  includeColumns?: string[];
  excludeColumns?: string[];
  renameColumns?: Record<string, string>;
  reorderColumns?: string[];
  limit?: number;
}

// ========== 按操作类型的计划定义 ==========

/**
 * 筛选计划
 * conditions 统一使用 ConditionExpr（Operator 枚举 + value）
 */
export interface FilterPlan {
  type: 'filter';
  conditions: ConditionExpr[];
  output?: OutputSpec;
}

/**
 * 排序计划
 * sorts 是排序子句数组，每列独立控制升降序
 */
export interface SortPlan {
  type: 'sort';
  sorts: SortClause[];
  output?: OutputSpec;
}

/**
 * 聚合计划
 * 扁平结构（不套 aggregate 对象）
 *   aggregations: 每列独立指定聚合方式（多列不同方法）
 *   method / columns: 旧格式，当所有列使用同一方法时由 compiler 转为 aggregations
 *   groupBy: 分组列（可选）
 */
export interface AggregatePlan {
  type: 'aggregate';
  /** 每条聚合定义：列 + 方法 */
  aggregations: AggregationDef[];
  /** 旧格式兼容：所有列使用同一方法 */
  method?: AggMethod;
  columns?: string[];
  groupBy?: string[];
  output?: OutputSpec;
}

/**
 * 去重计划
 * columns: 去重依据列
 */
export interface DedupPlan {
  type: 'dedup';
  columns: string[];
  output?: OutputSpec;
}

/**
 * 匹配计划
 *   matchColumns: 匹配键列
 *   lookupTables: 关联表名
 */
export interface MatchPlan {
  type: 'match';
  matchColumns: string[];
  lookupTables: string[];
  output?: OutputSpec;
}

/**
 * 合并计划
 *   sourceTables: 源表名列表
 */
export interface MergePlan {
  type: 'merge';
  sourceTables: string[];
  output?: OutputSpec;
}

/**
 * 清洗计划
 * 无操作参数，只做数据清洗
 */
export interface CleanPlan {
  type: 'clean';
  output?: OutputSpec;
}

/**
 * 投影计划 — 字段选择/删除/重命名/排序
 * 所有字段使用 columnKey（非 title）
 */
export interface ProjectionPlan {
  type: 'projection';
  includeColumns?: string[];
  excludeColumns?: string[];
  renameColumns?: Record<string, string>;
  reorderColumns?: string[];
  output?: OutputSpec;
}

// ========== 新增 Phase 12 计划类型 ==========

/**
 * 更新计划 — 批量修改指定列的值
 *   column: 要修改的目标列
 *   value: 要设置的新值（常量）
 *   conditions?: ConditionExpr[] — 条件更新（WHERE 子句）
 * 示例：
 *   { type: 'update', column: 'status', value: '未完成', conditions: [{ columnKey: 'status', operator: Operator.IS_NULL, value: null }] }
 *   { type: 'update', column: 'region', value: '成都' }
 */
export interface UpdatePlan {
  type: 'update';
  /** 要修改的目标列 key */
  column: string;
  /** 要设置的新值 */
  value: string | number;
  /** 可选的条件 — 只有满足条件的行才被更新 */
  conditions?: ConditionExpr[];
  output?: OutputSpec;
}

/**
 * 公式计划 — 新增计算列或更新已有列
 *   expressionType: 表达式类型标识
 *   targetColumn: 目标列 key（新列名或已有列名）
 *   sourceColumns: 参与计算的源列
 *   expression: 表达式描述（用于日志/验证）
 *
 * 首批支持：+ - * / ROUND ABS SUM AVG
 *
 * 示例：
 *   { type: 'formula', targetColumn: '金额', sourceColumns: ['数量', '单价'], expression: '数量*单价', expressionType: '*' }
 *   { type: 'formula', targetColumn: '利润', sourceColumns: ['销售额', '成本'], expression: '销售额-成本', expressionType: '-' }
 *   { type: 'formula', targetColumn: '单价', sourceColumns: ['单价'], expression: 'ROUND(单价,2)', expressionType: 'ROUND' }
 */
export interface FormulaPlan {
  type: 'formula';
  /** 目标列 key（不存在则新增，已存在则覆盖） */
  targetColumn: string;
  /** 参与计算的源列 key 列表 */
  sourceColumns: string[];
  /** 表达式类型 */
  expressionType: '*' | '/' | '+' | '-' | 'ROUND' | 'ABS' | 'SUM' | 'AVG' | 'IF' | 'LEFT' | 'RIGHT' | 'MID' | 'LEN' | 'YEAR' | 'MONTH' | 'DAY' | 'TODAY' | 'DATEDIF' | 'SUMIF' | 'COUNTIF' | 'AVERAGEIF' | 'CONCAT' | 'TEXTJOIN';
  /** 表达式可读描述 */
  expression?: string;
  /** ROUND 的小数位数 */
  decimalPlaces?: number;
  /** 常量操作数（如金额×0.9 中的 0.9） */
  constantOperand?: number;
  /** IF condition column key */
  conditionColumn?: string;
  /** IF condition operator */
  conditionOperator?: string;
  /** IF condition compare value */
  conditionValue?: string | number;
  /** IF true value */
  trueValue?: string | number;
  /** IF false value */
  falseValue?: string | number;
  /** LEFT/RIGHT/MID char count */
  charCount?: number;
  /** MID start position */
  startPos?: number;
  output?: OutputSpec;
}

/**
 * 管道计划 — 多个 ExecutionPlan 顺序执行
 *   steps: 按序执行的子计划数组
 *
 * 示例：筛选成都地区 → 按销售额降序 → 只保留客户名称、销售额
 */
export interface PipelinePlan {
  type: 'pipeline';
  steps: ExecutionPlan[];
  output?: OutputSpec;
}

/** 联合类型 */
export type ExecutionPlan =
  | FilterPlan
  | SortPlan
  | AggregatePlan
  | DedupPlan
  | MatchPlan
  | MergePlan
  | CleanPlan
  | ProjectionPlan
  | UpdatePlan
  | FormulaPlan
  | PipelinePlan;
