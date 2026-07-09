// ============================================================
// TaskCompiler — TaskPlan → ExecutionPlan 编译器
// ============================================================
// 职责：只做一次编译，不做数据操作
//   - columnHint（中文）→ columnKey（机器标识）
//   - 操作符字符串 → Operator 枚举
//   - 校验必须字段存在，不存在则报错
// ============================================================

import { Operator, type ConditionExpr } from './types';
import {
  type ExecutionPlan,
  type FilterPlan,
  type SortPlan,
  type AggregatePlan,
  type AggregationDef,
  type DedupPlan,
  type MatchPlan,
  type MergePlan,
  type CleanPlan,
  type ProjectionPlan,
  type UpdatePlan,
  type FormulaPlan,
  type SortClause,
  SortOrder,
  AggMethod,
} from './execution-plan';
import type { TaskPlan, TaskPlanCondition } from '@/lib/nlu/taskplan-types';
import type { ColumnDef, RowData } from '../types';
import { resolveTaskPlan } from './field-resolver';

/** 编译结果 */
export interface CompileResult {
  success: boolean;
  plan?: ExecutionPlan;
  error?: string;
}

/** 列解析上下文 */
interface ColumnContext {
  columns: ColumnDef[];
  rows?: RowData[];
}

/**
 * 将 TaskPlan 编译为 ExecutionPlan
 * @param taskPlan DeepSeek 返回的 TaskPlan
 * @param columns  当前表的列定义（用于解析 columnHint → columnKey）
 * @param rows     可选的行数据（用于 FieldResolver 值采样）
 */
export function compile(taskPlan: TaskPlan, columns: ColumnDef[], rows?: RowData[]): CompileResult {
  const ctx: ColumnContext = { columns, rows };

  // Step 0: FieldResolver — 修复 columnHint 的自然语言问题
  if (rows && rows.length > 0) {
    const resolved = resolveTaskPlan(taskPlan, columns, rows);
    if (resolved.success && resolved.plan) {
      taskPlan = resolved.plan;
    }
  }

  switch (taskPlan.action) {
    case 'filter':
      return compileFilter(taskPlan, ctx);
    case 'sort':
      return compileSort(taskPlan, ctx);
    case 'aggregate':
      return compileAggregate(taskPlan, ctx);
    case 'dedup':
      return compileDedup(taskPlan, ctx);
    case 'match':
      return compileMatch(taskPlan, ctx);
    case 'merge':
      return compileMerge(taskPlan, ctx);
    case 'clean':
    case 'delete':
      return { success: true, plan: { type: 'clean' } as CleanPlan };
    case 'select':
      return compileProjectionSelect(taskPlan, ctx);
    case 'remove':
      return compileProjectionRemove(taskPlan, ctx);
    case 'rename':
      return compileProjectionRename(taskPlan, ctx);
    case 'projection':
      return compileProjection(taskPlan, ctx);
    case 'update':
      return compileUpdate(taskPlan, ctx);
    case 'formula':
      return compileFormula(taskPlan, ctx);
    case 'pipeline':
      return compilePipeline(taskPlan, ctx);
    case 'unknown':
      return { success: false, error: taskPlan.reason || 'AI 无法理解该指令' };
    default:
      return { success: false, error: `不支持的操作: ${taskPlan.action}` };
  }
}

// ========== 各操作编译 ==========

function compileFilter(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.conditions || plan.conditions.length === 0) {
    return { success: false, error: '筛选操作缺少 conditions' };
  }

  const conditions: ConditionExpr[] = [];
  for (const c of plan.conditions) {
    const columnKey = resolveColumn(c.columnHint, ctx);
    if (!columnKey) {
      return { success: false, error: `找不到列: "${c.columnHint}"` };
    }
    const operator = mapOperator(c.operator);
    if (!operator) {
      return { success: false, error: `不支持的操作符: "${c.operator}"` };
    }

    if (operator === Operator.BETWEEN && typeof c.value === 'object' && c.value !== null) {
      // dateRange 格式：{ start, end }
      conditions.push({ columnKey, operator, value: c.value, logic: c.logic });
    } else {
      const condition: ConditionExpr = { columnKey, operator, value: c.value ?? '', logic: c.logic };
      // 列间比较：valueColumnHint 指向另一列
      if (c.valueColumn) {
        const vcKey = resolveColumn(c.valueColumn, ctx);
        if (vcKey) condition.valueColumn = vcKey;
      }
      conditions.push(condition);
    }
  }

  const result: FilterPlan = {
    type: 'filter',
    conditions,
    output: compileOutput(plan),
  };
  return { success: true, plan: result };
}

function compileSort(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  const hints = plan.columnHints || (plan.columnHint ? [plan.columnHint] : []);
  if (hints.length === 0) {
    return { success: false, error: '排序操作缺少排序列' };
  }

  const sorts = hints.map((hint) => {
    const columnKey = resolveColumn(hint, ctx);
    if (!columnKey) return null;
    // 多列排序统一使用 direction（缺省 asc），ExecutionPlan 每个 sorter 独立控制升/降
    const order = plan.direction === 'desc' ? SortOrder.DESC : SortOrder.ASC;
    return { columnKey, order };
  }).filter(Boolean) as SortClause[];

  if (sorts.length === 0) {
    return { success: false, error: '找不到排序目标列' };
  }

  const result: SortPlan = { type: 'sort', sorts, output: compileOutput(plan) };
  return { success: true, plan: result };
}

function compileAggregate(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  const groupByKeys = plan.groupByHints
    ?.map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[] | undefined;

  // 新格式：每列各自指定方法（DeepSeek 输出 aggregations[]）
  if (plan.aggregations && plan.aggregations.length > 0) {
    const aggDefs: AggregationDef[] = [];
    for (const agg of plan.aggregations) {
      const colKey = resolveColumn(agg.columnHint, ctx);
      if (!colKey) continue;
      const method = mapAggMethodSimple(agg.method) || AggMethod.SUM;
      aggDefs.push({ column: colKey, method, alias: agg.alias });
    }
    if (aggDefs.length === 0) {
      return { success: false, error: '找不到聚合目标列' };
    }
    const result: AggregatePlan = {
      type: 'aggregate',
      aggregations: aggDefs,
      columns: aggDefs.map(a => a.column),
      method: aggDefs[0].method,
      groupBy: groupByKeys?.length ? groupByKeys : undefined,
      output: undefined,
    };
    return { success: true, plan: result };
  }

  // 旧格式：所有列共用一个 method
  const hints = plan.columnHints || (plan.columnHint ? [plan.columnHint] : []);
  if (hints.length === 0) {
    return { success: false, error: '聚合操作缺少目标列' };
  }

  const columnKeys = hints
    .map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[];
  if (columnKeys.length === 0) {
    return { success: false, error: '找不到聚合目标列' };
  }

  const method = mapAggMethod(plan.method) || AggMethod.SUM;

  const groupByKeys2 = plan.groupByHints
    ?.map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[] | undefined;

  // 每列一条 AggregationDef（当前所有列共用一个 method，未来可扩展 AI 按列指定）
  const aggregations: AggregationDef[] = columnKeys.map(col => ({
    column: col,
    method,
  }));

  const result: AggregatePlan = {
    type: 'aggregate',
    aggregations,
    columns: columnKeys,
    method,
    groupBy: groupByKeys2?.length ? groupByKeys2 : undefined,
    output: plan.output
      ? { renameColumns: plan.output.renameColumns, limit: plan.limit ?? plan.output.limit }
      : undefined,
  };
  return { success: true, plan: result };
}

function mapAggMethodSimple(m: string): AggMethod | undefined {
  const map: Record<string, AggMethod> = {
    sum: AggMethod.SUM, avg: AggMethod.AVG, count: AggMethod.COUNT,
    max: AggMethod.MAX, min: AggMethod.MIN,
    SUM: AggMethod.SUM, AVG: AggMethod.AVG, COUNT: AggMethod.COUNT,
    MAX: AggMethod.MAX, MIN: AggMethod.MIN,
  };
  return map[m];
}

function compileDedup(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  const hints = plan.columnHints || (plan.columnHint ? [plan.columnHint] : []);
  const columnKeys = hints
    .map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[];
  if (columnKeys.length === 0) {
    return { success: false, error: '去重操作缺少目标列' };
  }
  const result: DedupPlan = { type: 'dedup', columns: columnKeys, output: compileOutput(plan) };
  return { success: true, plan: result };
}

function compileMatch(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  const matchColumns: string[] = [];

  // matchKeyHint → columnKey
  if (plan.matchKeyHint) {
    const k = resolveColumn(plan.matchKeyHint, ctx);
    if (!k) return { success: false, error: `匹配键列 "${plan.matchKeyHint}" 不存在` };
    matchColumns.push(k);
  } else {
    // 没有 hint 时取两张表共同列（由执行引擎处理）
  }

  const lookupTables: string[] = [];
  if (plan.lookupTableHint) lookupTables.push(plan.lookupTableHint);

  const result: MatchPlan = {
    type: 'match',
    matchColumns,
    lookupTables,
    output: compileOutput(plan),
  };
  return { success: true, plan: result };
}

function compileMerge(plan: TaskPlan, _ctx: ColumnContext): CompileResult {
  const sourceTables: string[] = [];

  // 从 plan 中解析源表名
  if (plan.lookupTableHint) {
    sourceTables.push(plan.lookupTableHint);
  }
  if (plan.table && plan.table !== 'current' && !sourceTables.includes(plan.table)) {
    sourceTables.push(plan.table);
  }

  const result: MergePlan = { type: 'merge', sourceTables, output: compileOutput(plan) };
  return { success: true, plan: result };
}

// ========== Projection 编译 ==========

/** select: 只保留指定列 */
function compileProjectionSelect(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.columns || plan.columns.length === 0) {
    return { success: false, error: 'select 操作缺少 columns' };
  }

  const resolved: string[] = [];
  for (const hint of plan.columns) {
    const k = resolveColumn(hint, ctx);
    if (!k) return { success: false, error: `找不到列: "${hint}"` };
    resolved.push(k);
  }

  const result: ProjectionPlan = { type: 'projection', includeColumns: resolved };
  return { success: true, plan: result };
}

/** remove: 删除指定列 */
function compileProjectionRemove(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.columns || plan.columns.length === 0) {
    return { success: false, error: 'remove 操作缺少 columns' };
  }

  const resolved: string[] = [];
  for (const hint of plan.columns) {
    const k = resolveColumn(hint, ctx);
    if (!k) return { success: false, error: `找不到列: "${hint}"` };
    resolved.push(k);
  }

  const result: ProjectionPlan = { type: 'projection', excludeColumns: resolved };
  return { success: true, plan: result };
}

/** rename: 重命名指定列 */
function compileProjectionRename(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.column || !plan.newName) {
    return { success: false, error: 'rename 操作缺少 column 或 newName' };
  }

  const resolved = resolveColumn(plan.column, ctx);
  if (!resolved) return { success: false, error: `找不到列: "${plan.column}"` };

  const result: ProjectionPlan = {
    type: 'projection',
    renameColumns: { [resolved]: plan.newName },
  };
  return { success: true, plan: result };
}

/** projection: 直接投影操作（包含/排除/重命名/排序混合） */
function compileProjection(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  const includeColumns = plan.includeColumns
    ?.map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[] | undefined;
  const excludeColumns = plan.excludeColumns
    ?.map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[] | undefined;

  const renameColumns: Record<string, string> | undefined = plan.renameColumns
    ? resolveRenameMap(plan.renameColumns, ctx)
    : undefined;

  const reorderColumns = plan.reorderColumns
    ?.map((h) => resolveColumn(h, ctx))
    .filter(Boolean) as string[] | undefined;

  const result: ProjectionPlan = { type: 'projection' };
  if (includeColumns?.length) result.includeColumns = includeColumns;
  if (excludeColumns?.length) result.excludeColumns = excludeColumns;
  if (renameColumns && Object.keys(renameColumns).length) result.renameColumns = renameColumns;
  if (reorderColumns?.length) result.reorderColumns = reorderColumns;

  return { success: true, plan: result };
}

/** 解析重命名映射（key: title/key, value: newName） */
function resolveRenameMap(map: Record<string, string>, ctx: ColumnContext): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [keyHint, newName] of Object.entries(map)) {
    const resolved = resolveColumn(keyHint, ctx);
    if (resolved) result[resolved] = newName;
  }
  return result;
}

// ========== 辅助函数 ==========

/**
 * 解析 columnHint（中文列名/别名）→ 实际 columnKey
 * 如果找不到返回 null（编译失败，由调用方处理错误，不做 fallback）
 */
function resolveColumn(hint: string, ctx: ColumnContext): string | null {
  const lowerHint = hint.toLowerCase();
  for (const col of ctx.columns) {
    if (col.key === hint) return col.key;
    if (col.title === hint) return col.key;
    if (col.title.toLowerCase() === lowerHint) return col.key;
  }

  // 模糊匹配：包含关系
  for (const col of ctx.columns) {
    const titleLower = col.title.toLowerCase();
    if (titleLower.includes(lowerHint) || lowerHint.includes(titleLower)) {
      return col.key;
    }
  }

  return null;
}

/** 映射 TaskPlan 操作符 → Operator 枚举 */
function mapOperator(op: string): Operator | null {
  const map: Record<string, Operator> = {
    '=': Operator.EQ,
    '!=': Operator.NE,
    '>': Operator.GT,
    '>=': Operator.GTE,
    '<': Operator.LT,
    '<=': Operator.LTE,
    contains: Operator.CONTAINS,
    isNull: Operator.IS_NULL,
    notNull: Operator.NOT_NULL,
    dateRange: Operator.BETWEEN,
    between: Operator.BETWEEN,
    in: Operator.IN,
    notIn: Operator.NOT_IN,
    startsWith: Operator.STARTS_WITH,
    endsWith: Operator.ENDS_WITH,
  };
  return map[op] ?? null;
}

/** 映射聚合方法 */
function mapAggMethod(method?: string): AggMethod | undefined {
  const map: Record<string, AggMethod> = {
    sum: AggMethod.SUM,
    avg: AggMethod.AVG,
    count: AggMethod.COUNT,
    max: AggMethod.MAX,
    min: AggMethod.MIN,
  };
  return method ? map[method] : undefined;
}

// ========== Update 编译 ==========

function compileUpdate(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.column && !plan.updateColumn) {
    return { success: false, error: 'update 操作缺少 column' };
  }
  var colHint = plan.column || plan.updateColumn || '';
  var columnKey = resolveColumn(colHint, ctx);
  if (!columnKey) return { success: false, error: '找不到列: "' + colHint + '"' };

  if (plan.value === undefined) {
    return { success: false, error: 'update 操作缺少 value' };
  }

  var conditions: ConditionExpr[] | undefined;
  if (plan.conditions && plan.conditions.length > 0) {
    conditions = [];
    for (var _a = 0, _b = plan.conditions; _a < _b.length; _a++) {
      var c = _b[_a];
      var ccKey = resolveColumn(c.columnHint, ctx);
      if (!ccKey) return { success: false, error: '找不到条件列: "' + c.columnHint + '"' };
      var op = mapOperator(c.operator);
      conditions.push({ columnKey: ccKey, operator: op || Operator.EQ, value: c.value ?? '' });
    }
  }

  var result: UpdatePlan = {
    type: 'update',
    column: columnKey,
    value: typeof plan.value === 'number' ? plan.value : String(plan.value),
    conditions: conditions && conditions.length > 0 ? conditions : undefined,
    output: compileOutput(plan),
  };
  return { success: true, plan: result };
}

// ========== Formula 编译 ==========

function compileFormula(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.targetColumn) {
    return { success: false, error: 'formula 操作缺少 targetColumn' };
  }

  var sourceColumnKeys: string[] = [];
  if (plan.sourceColumnHints) {
    for (var _c = 0, _d = plan.sourceColumnHints; _c < _d.length; _c++) {
      var h = _d[_c];
      var k = resolveColumn(h, ctx);
      if (!k) return { success: false, error: '找不到源列: "' + h + '"' };
      sourceColumnKeys.push(k);
    }
  } else if (plan.columnHints) {
    for (var _e = 0, _f = plan.columnHints; _e < _f.length; _e++) {
      var h2 = _f[_e];
      var k2 = resolveColumn(h2, ctx);
      if (!k2) return { success: false, error: '找不到源列: "' + h2 + '"' };
      sourceColumnKeys.push(k2);
    }
  }

  var exprType = plan.expressionType || '*';

  // 如果 constantOperand 未设置，尝试从 expression 字符串中提取
  var constantOperand = plan.constantOperand;
  if (constantOperand === undefined && plan.expression) {
    var numMatch = plan.expression.match(/(\d+(?:\.\d+)?)\s*$/);
    if (numMatch && sourceColumnKeys.length === 1) {
      constantOperand = parseFloat(numMatch[1]);
    }
  }

  var result: FormulaPlan = {
    type: 'formula',
    targetColumn: plan.targetColumn,
    sourceColumns: sourceColumnKeys,
    expressionType: exprType,
    expression: plan.expression || plan.targetColumn + ' = ' + sourceColumnKeys.join(' ' + exprType + ' '),
    decimalPlaces: plan.decimalPlaces,
    constantOperand: constantOperand,
    conditionColumn: plan.conditionColumnHint ? resolveColumn(plan.conditionColumnHint, ctx) ?? undefined : undefined,
    conditionOperator: plan.conditionOperator,
    conditionValue: plan.conditionValue,
    trueValue: plan.trueValue,
    falseValue: plan.falseValue,
    charCount: plan.charCount,
    startPos: plan.startPos,
    output: compileOutput(plan),
  };


  return { success: true, plan: result };
}

// ========== Pipeline 编译 ==========

function compilePipeline(plan: TaskPlan, ctx: ColumnContext): CompileResult {
  if (!plan.steps || plan.steps.length === 0) {
    return { success: false, error: 'pipeline 操作缺少 steps' };
  }

  var compiledSteps: ExecutionPlan[] = [];
  var evolvingColumns = [...ctx.columns];
  for (var _g = 0, _h = plan.steps; _g < _h.length; _g++) {
    var step = _h[_g];
    var r = compile(step, evolvingColumns, ctx.rows);
    if (!r.success || !r.plan) {
      return { success: false, error: 'pipeline 子步骤编译失败: ' + (r.error || '未知错误') };
    }
    // 子步骤的 output/limit 约束传递到编译后的 plan
    if (step.output || step.limit) {
      (r.plan as any).output = compileOutput(step);
    }
    compiledSteps.push(r.plan);
    // 公式新增列需对后续步骤可见
    if (step.action === 'formula' && step.targetColumn) {
      var existing = evolvingColumns.find(function (c) { return c.key === step.targetColumn || c.title === step.targetColumn; });
      if (!existing) {
        evolvingColumns.push({ key: step.targetColumn, title: step.targetColumn, type: 'number' });
      }
    }
    // projection 对列重新命名的步骤后续可用新列名
    if (step.action === 'rename' && step.column && step.newName) {
      var renamedCol = evolvingColumns.find(function (c) { return c.key === step.column || c.title === step.column; });
      if (renamedCol) renamedCol.title = step.newName;
    }
  }

  return {
    success: true,
    plan: { type: 'pipeline', steps: compiledSteps, output: compileOutput(plan) },
  };
}

/** 编译输出约束（TaskPlan → OutputSpec） */
function compileOutput(plan: TaskPlan) {
  if (!plan.output && !plan.limit) return undefined;
  return {
    includeColumns: plan.output?.includeColumns,
    excludeColumns: plan.output?.excludeColumns,
    renameColumns: plan.output?.renameColumns,
    reorderColumns: plan.output?.reorderColumns,
    limit: plan.limit ?? plan.output?.limit,
  };
}
