// ============================================================
// RuleTaskPlanConverter — 规则解析结果 → TaskPlan 转换器
// ============================================================
// 职责：
//   将 RuleBasedSemanticParser 输出的 TaskIntent 转换为 TaskPlan
//   使得 Fallback 路径也能走 TaskCompiler → ExecutionPlan → V2 Executor
//
// 转换映射：
//   TaskIntent                     → TaskPlan
//   ──────────────────────────────────────────
//   operation: 'sort'              → action: 'sort'
//   operation: 'filter'            → action: 'filter'
//   operation: 'sum'               → action: 'aggregate'
//   operation: 'dedup'             → action: 'dedup'
//   operation: 'match'             → action: 'match'
//   operation: 'merge'             → action: 'merge'
//   operation: 'clean'             → action: 'clean'
//   operation: 'update'            → action: 'update'
//   operation: 'formula'           → action: 'formula'
//   operation: 'pipeline'          → action: 'pipeline'
//   target                         → columnHint
//   groupBy[]                      → groupByHints
//   aggregation                    → method
//   params.operator + filterValue  → conditions[]（filter 操作）
//   params.asc                     → direction
//   params.targets[]               → columnHints
// ============================================================

import type { TaskIntent } from '../types';
import type { TaskPlan, TaskPlanAction, TaskPlanCondition } from './taskplan-types';

/**
 * 将规则解析的 TaskIntent 转换为 TaskPlan
 * @param intent 规则解析器输出的 TaskIntent
 * @returns 标准化 TaskPlan（可输入 TaskCompiler）
 */
export function ruleIntentToTaskPlan(intent: TaskIntent): TaskPlan {
  const action = mapOperationToAction(intent.operation);
  const plan: TaskPlan = { action };

  // ── pipeline：转换子步骤 ──
  if (intent.operation === 'pipeline' && intent.steps && intent.steps.length > 0) {
    plan.steps = intent.steps.map(step => ruleIntentToTaskPlan(step));
    return plan;
  }

  // ── select（列选择）：转为 select 操作 ──
  if (intent.operation === 'select') {
    plan.action = 'select';
    const targets = (intent.params.targets as string[]) || (intent.target ? [intent.target] : []);
    plan.columns = targets;
    return plan;
  }

  // ── pipeline select 子步骤也设置 columns ──
  if (intent.params.targets && Array.isArray(intent.params.targets) && intent.params.targets.length > 0 && plan.action !== 'select') {
    plan.columnHints = intent.params.targets as string[];
  }

  // columnHint: 用语义 target
  if (intent.target) {
    plan.columnHint = intent.target;
  }

  // columnHints: 多列场景
  if (intent.params.targets && Array.isArray(intent.params.targets) && intent.params.targets.length > 0) {
    plan.columnHints = intent.params.targets as string[];
  }

  // direction: 排序方向
  if (intent.params.asc !== undefined) {
    plan.direction = intent.params.asc ? 'asc' : 'desc';
  }

  // method: 聚合方法
  if (intent.aggregation) {
    plan.method = mapAggregationToMethod(intent.aggregation);
  }

  // groupByHints: 分组
  if (intent.groupBy && intent.groupBy.length > 0) {
    plan.groupByHints = intent.groupBy;
  }

  // conditions: 筛选条件
  if (intent.filters && intent.filters.length > 0) {
    plan.conditions = intent.filters.map(f => mapFilterCondition(f));
  } else if (intent.operation === 'filter' && intent.params.operator) {
    // params 回退（如 RuleBasedParser 没有 filters 只有 params）
    const cond = mapFilterParams(intent.params);
    if (cond) {
      // 补上 columnHint：从 intent.target 获取
      cond.columnHint = cond.columnHint || intent.target || '';
      plan.conditions = [cond];
    }
  }

  // ── update 操作：生成 conditions（WHERE 条件） ──
  if (intent.operation === 'update') {
    // 从 intent.filters 提取条件（新架构：parseUpdateIntent 将条件放在 filters 中）
    if (intent.filters && intent.filters.length > 0) {
      if (!plan.conditions) plan.conditions = [];
      for (const f of intent.filters) {
        const condOp = f.operator === 'eq' && f.value === '' ? 'isNull'
          : f.operator === 'neq' && f.value === '' ? 'notNull'
          : '=';
        plan.conditions.push({
          columnHint: f.column || intent.target,
          operator: condOp as any,
          value: '',
        });
      }
    }
    // 兼容旧 params 条件
    if (intent.params.updateCondition && (!plan.conditions || plan.conditions.length === 0)) {
      if (!plan.conditions) plan.conditions = [];
      if (intent.target) {
        plan.conditions.push({
          columnHint: intent.target,
          operator: intent.params.updateCondition === 'IS_NULL' ? 'isNull' : 'notNull',
          value: '',
        });
      }
    }
  }

  // ── update/formula 操作的额外字段 ──
  if (intent.operation === 'update' || intent.operation === 'formula') {
    if (intent.params.value) plan.value = intent.params.value as string;
    if (intent.params.updateValue) plan.value = intent.params.updateValue as string;
    if (intent.params.expressionType) plan.expressionType = intent.params.expressionType as any;
    if (intent.params.targetColumn) plan.targetColumn = intent.params.targetColumn as string;
    if (intent.params.sourceColumnHints) plan.sourceColumnHints = intent.params.sourceColumnHints as string[];
    if (intent.params.decimalPlaces) plan.decimalPlaces = intent.params.decimalPlaces as number;
    if (intent.params.constantOperand !== undefined) plan.constantOperand = intent.params.constantOperand as number;

    // IF / formula 条件字段
    if (intent.params.conditionColumnHint) plan.conditionColumnHint = intent.params.conditionColumnHint as string;
    if (intent.params.conditionOperator) plan.conditionOperator = intent.params.conditionOperator as string;
    if (intent.params.conditionValue !== undefined) plan.conditionValue = intent.params.conditionValue as any;
    if (intent.params.trueValue !== undefined) plan.trueValue = intent.params.trueValue as any;
    if (intent.params.falseValue !== undefined) plan.falseValue = intent.params.falseValue as any;

    // MID / 文本函数字段
    if (intent.params.charCount !== undefined) plan.charCount = intent.params.charCount as number;
    if (intent.params.startPos !== undefined) plan.startPos = intent.params.startPos as number;

    if (plan.action === 'formula') {
      console.log('===== LAYER 2: TaskPlan =====');
      console.log('  action:', plan.action);
      console.log('  targetColumn:', plan.targetColumn);
      console.log('  sourceColumnHints:', plan.sourceColumnHints);
      console.log('  expressionType:', plan.expressionType);
      console.log('  constantOperand:', plan.constantOperand);
    }

    // update 的 column 从 target 获取
    if (intent.operation === 'update' && intent.target) {
      plan.column = intent.target;
    }
  }

  return plan;
}

function mapOperationToAction(op: string | null): TaskPlanAction {
  switch (op) {
    case 'sort': return 'sort';
    case 'filter': return 'filter';
    case 'sum': return 'aggregate';
    case 'dedup': return 'dedup';
    case 'match': return 'match';
    case 'merge': return 'merge';
    case 'clean': return 'clean';
    case 'update': return 'update';
    case 'formula': return 'formula';
    case 'pipeline': return 'pipeline';
    case 'select': return 'select';
    default: return 'unknown';
  }
}

function mapAggregationToMethod(agg: string): TaskPlan['method'] {
  switch (agg) {
    case 'SUM': return 'sum';
    case 'AVG': return 'avg';
    case 'COUNT': return 'count';
    case 'MAX': return 'max';
    case 'MIN': return 'min';
    default: return undefined;
  }
}

/** 将 FilterCondition 转换为 TaskPlanCondition */
function mapFilterCondition(f: { column: string; operator: string; value: string | { start: string; end: string } }): TaskPlanCondition {
  const opMap: Record<string, string> = {
    'eq': '=',
    'neq': '!=',
    'gt': '>',
    'gte': '>=',
    'lt': '<',
    'lte': '<=',
    'contains': 'contains',
    'dateRange': 'dateRange',
  };

  const base: TaskPlanCondition = {
    columnHint: f.column || '',
    operator: (opMap[f.operator] || '=') as TaskPlanCondition['operator'],
  };

  if (f.operator === 'dateRange' && typeof f.value === 'object') {
    base.value = f.value;
  } else {
    base.value = String(f.value ?? '');
  }

  return base;
}

/** 从 params 降级构建条件 */
function mapFilterParams(params: Record<string, unknown>): TaskPlanCondition | null {
  const op = String(params.operator || 'eq');
  const val = String(params.filterValue || '');

  // 如果 params 里边有 dateRange 对象
  if (params.dateRange && typeof params.dateRange === 'object') {
    return {
      columnHint: '',
      operator: 'dateRange',
      value: params.dateRange as { start: string; end: string },
    };
  }

  const opMap: Record<string, string> = {
    'eq': '=',
    'neq': '!=',
    'gt': '>',
    'gte': '>=',
    'lt': '<',
    'lte': '<=',
    'contains': 'contains',
  };

  if (!val && op !== 'isNull') return null;

  return {
    columnHint: '',
    operator: (opMap[op] || '=') as TaskPlanCondition['operator'],
    value: val,
  };
}
