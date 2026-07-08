// ============================================================
// TaskPlan — DeepSeek AI 输出的标准化执行计划
// DeepSeek 只负责理解语义，输出统一的 JSON TaskPlan。
// 不负责计算，不执行任何数据操作。
// ============================================================

/** 筛选条件（AI 输出） */
export interface TaskPlanCondition {
  columnHint: string;
  operator: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'isNull' | 'notNull' | 'dateRange';
  value?: string | { start: string; end: string };
  /** 逻辑连接词 OR（缺省 AND） */
  logic?: 'AND' | 'OR';
}

/** 聚合操作 */
export type AggMethod = 'sum' | 'avg' | 'count' | 'max' | 'min';

/** DeepSeek 输出的单条聚合：列 + 各自的方法 */
export interface AggregationHint {
  columnHint: string;
  method: AggMethod;
  /** 聚合结果列的自定义别名（如 "平均工资"），为空时自动生成 */
  alias?: string;
}

/** 排序方向 */
export type SortDirection = 'asc' | 'desc';

/** 动作类型 */
export type TaskPlanAction = 'sort' | 'filter' | 'aggregate' | 'delete' | 'dedup' | 'match' | 'merge' | 'clean' | 'select' | 'remove' | 'rename' | 'projection' | 'update' | 'formula' | 'pipeline' | 'unknown';

/**
 * DeepSeek 输出的标准化 TaskPlan
 */
export interface TaskPlan {
  /** 执行动作 */
  action: TaskPlanAction;
  /** 目标表（通常为 "current" 或文件名） */
  table?: string;
  /** 排序列提示 */
  columnHint?: string;
  /** 排序方向 */
  direction?: SortDirection;
  /** 筛选/删除条件列表 */
  conditions?: TaskPlanCondition[];
  /** 聚合方法 */
  method?: AggMethod;
  /** 列提示列表（用于聚合、匹配等） */
  columnHints?: string[];
  /** 匹配/合并时的关联表提示 */
  lookupTableHint?: string;
  /** 匹配键提示 */
  matchKeyHint?: string;
  /** groupBy 列提示 */
  groupByHints?: string[];
  /** 多列聚合：每列可指定不同方法（优先级高于 method+columnHints） */
  aggregations?: AggregationHint[];
  limit?: number;
  /** AI 无法理解时的原因 */
  reason?: string;
  /** 输出约束 */
  output?: OutputOptions;
  /** select/remove 操作的列列表 */
  columns?: string[];
  /** rename 操作的原列名 */
  column?: string;
  /** rename 操作的新列名 */
  newName?: string;
  /** projection 操作的包含列 */
  includeColumns?: string[];
  /** projection 操作的排除列 */
  excludeColumns?: string[];
  /** projection 操作的重命名映射 */
  renameColumns?: Record<string, string>;
  /** projection 操作的列排序 */
  reorderColumns?: string[];
  /** update/formula 操作的目标值 */
  value?: string | number;
  /** update 操作的值来源 */
  updateColumn?: string;
  /** formula 操作的表达式 */
  expression?: string;
  /** formula 操作的目标列 */
  targetColumn?: string;
  /** pipeline 操作的子步骤 */
  steps?: TaskPlan[];
  /** ROUND 的小数位数 */
  decimalPlaces?: number;
  /** 表达式类型 */
  expressionType?: '*' | '/' | '+' | '-' | 'ROUND' | 'ABS' | 'SUM' | 'AVG' | 'IF' | 'DATEDIF' | 'YEAR' | 'MONTH' | 'DAY' | 'TODAY' | 'LEFT' | 'RIGHT' | 'MID' | 'LEN' | 'SUMIF' | 'COUNTIF' | 'AVERAGEIF';
  /** 计算的源列 */
  sourceColumnHints?: string[];
  /** formula 常量操作数（如金额*0.9 中的 0.9） */
  constantOperand?: number;
  /** IF condition column hint */
  conditionColumnHint?: string;
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
}

/** 输出约束配置 — 所有操作统一支持 */
export interface OutputOptions {
  includeColumns?: string[];
  excludeColumns?: string[];
  renameColumns?: Record<string, string>;
  reorderColumns?: string[];
  limit?: number;
}
