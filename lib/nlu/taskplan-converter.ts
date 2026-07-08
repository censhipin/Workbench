// ============================================================
// TaskPlan → TaskIntent 转换器
// ============================================================
// 职责：将 DeepSeek 输出的 TaskPlan JSON
// 转换为系统内部的 TaskIntent，然后走 Schema Resolver
// ============================================================

import { TaskIntent, Operation, ColumnDef } from '../types';
import { TaskPlan, TaskPlanAction } from './taskplan-types';
import type { AggregationType, FilterCondition } from './types';

/** 映射 TaskPlan.action → 内部 Operation */
function mapAction(action: TaskPlanAction): Operation {
  switch (action) {
    case 'sort': return 'sort';
    case 'filter': return 'filter';
    case 'aggregate': return 'sum';
    case 'delete': return 'clean';
    case 'select': return 'select';
    case 'remove': return 'remove';
    case 'dedup': return 'dedup';
    case 'match': return 'match';
    case 'merge': return 'merge';
    case 'clean': return 'clean';
    case 'update': return 'update';
    case 'formula': return 'formula';
    case 'rename': return 'rename';
    case 'pipeline': return 'pipeline';
    default: return null;
  }
}

/** 映射聚合方法 */
function mapAggMethod(method?: string): AggregationType {
  switch (method) {
    case 'sum': return 'SUM';
    case 'avg': return 'AVG';
    case 'count': return 'COUNT';
    case 'max': return 'MAX';
    case 'min': return 'MIN';
    default: return null;
  }
}

/** 将条件转换为内部 FilterCondition */
function mapCondition(
  cond: { columnHint: string; operator: string; value?: string | { start: string; end: string } }
): FilterCondition | null {
  const operatorMap: Record<string, FilterCondition['operator']> = {
    '=': 'eq', '!=': 'neq', '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte',
    'contains': 'contains', 'isNull': 'eq', 'notNull': 'neq',
    'dateRange': 'dateRange',
  };
  const mappedOp = operatorMap[cond.operator];
  if (!mappedOp) return null;

  if (mappedOp === 'dateRange' && typeof cond.value === 'object') {
    return { column: cond.columnHint, operator: 'dateRange', value: cond.value };
  }

  return {
    column: cond.columnHint,
    operator: mappedOp,
    value: cond.value ?? '',
  };
}

/**
 * 将 TaskPlan 转换为 TaskIntent（尚未解析列，columnHint 留给 Schema Resolver）
 */
export function taskPlanToIntent(
  plan: TaskPlan,
  fileNames: string[],
  rawPrompt: string
): TaskIntent {
  const operation = mapAction(plan.action);
  const aggregation = mapAggMethod(plan.method);

  // 从 columnHint / columnHints 提取语义目标
  const target = plan.columnHint
    || (plan.columnHints && plan.columnHints[0])
    || plan.matchKeyHint
    || '';

  // 构建 filters
  const filters: FilterCondition[] = [];
  if (plan.conditions) {
    for (const c of plan.conditions) {
      const mapped = mapCondition(c);
      if (mapped) filters.push(mapped);
    }
  }

  // 构建 params — 同时将 filters 中的条件同步到 params（兼容 ExecutionEngine）
  const params: Record<string, unknown> = {};
  if (plan.direction) {
    params.asc = plan.direction === 'asc';
  }
  if (plan.limit) {
    params.limit = plan.limit;
  }
  if (plan.matchKeyHint) {
    params.matchKeyHint = plan.matchKeyHint;
  }
  if (plan.lookupTableHint) {
    params.lookupTableHint = plan.lookupTableHint;
  }
  if (plan.columnHints && plan.columnHints.length > 0) {
    params.targets = plan.columnHints;
  }
  // select 操作的 columns 也映射到 params.targets
  if (plan.columns && plan.columns.length > 0) {
    params.targets = plan.columns;
  }

  // === 关键修复：将 AI 解析的筛选条件同步到 params（ExecutionEngine 依赖 params）===
  if (plan.conditions && plan.conditions.length > 0) {
    const first = plan.conditions[0];
    if (first.operator === '=' && typeof first.value === 'string' && first.value) {
      params.operator = 'eq';
      params.filterValue = first.value;
    } else if (first.operator === 'contains') {
      params.operator = 'contains';
      params.filterValue = first.value ?? '';
    } else if (first.operator === 'dateRange') {
      params.dateRange = first.value;
      params.operator = 'dateRange';
    }
    // isNull → filterValue='' 匹配空值
    if (first.operator === 'isNull') {
      params.operator = 'eq';
      params.filterValue = '';
    }
  }

  // ── formula/update/pipeline 的专用字段 ──
  if (plan.targetColumn) params.targetColumn = plan.targetColumn;
  if (plan.sourceColumnHints) params.sourceColumnHints = plan.sourceColumnHints;
  if (plan.expressionType) params.expressionType = plan.expressionType;
  if (plan.expression) params.expression = plan.expression;
  if (plan.decimalPlaces) params.decimalPlaces = plan.decimalPlaces;
  if (plan.value !== undefined) params.value = plan.value;
  if (plan.column) params.column = plan.column;
  if (plan.updateColumn) params.updateColumn = plan.updateColumn;
  if (plan.columnHints) params.targets = plan.columnHints;
  // ── rename 操作字段 ──
  if (operation === 'rename') {
    if (plan.column) params.oldName = plan.column;
    if (plan.newName) params.newName = plan.newName;
  }

  // pipeline 子步骤
  const steps: TaskIntent[] | undefined = plan.steps
    ? plan.steps.map(s => taskPlanToIntent(s, fileNames, rawPrompt))
    : undefined;

  return {
    operation,
    target,
    targetColumns: [],
    resolvedColumns: undefined,
    scope: filters.length > 0 ? 'filtered' : 'all',
    groupBy: plan.groupByHints?.length ? plan.groupByHints : undefined,
    filters: filters.length > 0 ? filters : undefined,
    aggregation,
    output: plan.output,
    params,
    targetFiles: fileNames,
    rawPrompt,
    confidence: 0.95,  // AI 解析的置信度高
    steps,
  };
}
