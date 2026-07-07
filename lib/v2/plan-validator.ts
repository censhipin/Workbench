// ============================================================
// PlanValidator — ExecutionPlan 校验层
// 职责：在 compile/AI 输出 → Executor 之间插入校验
// - 列存在性检查
// - 操作符合法性
// - 值类型标准化（返回新的 normalizedPlan，不修改输入）
// - 多条件结构验证
// - 数据感知校验（需 DataProfile）
//
// ★ 纯函数：不修改输入 plan，返回新的 normalizedPlan
// ============================================================

import { Operator } from './types';
import type { ConditionExpr } from './types';
import type { ExecutionPlan, FilterPlan, SortPlan, AggregatePlan, DedupPlan, MatchPlan, MergePlan, CleanPlan, ProjectionPlan, UpdatePlan, FormulaPlan, PipelinePlan, AggregationDef } from './execution-plan';
import { getAggregations } from './execution-plan';
import type { ColumnDef } from '../types';
import type { DataProfile } from '../v3/profile/types';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PlanValidationResult {
  valid: boolean;
  plan: ExecutionPlan;
  issues: ValidationIssue[];
}

/** 支持的算子列表（14种） */
const VALID_OPERATORS = new Set(Object.values(Operator));

function resolveCol(hint: string, columns: ColumnDef[]): ColumnDef | null {
  const lower = hint.toLowerCase();
  for (const c of columns) {
    if (c.key === hint || c.key.toLowerCase() === lower || c.title === hint || c.title.toLowerCase() === lower) return c;
  }
  for (const c of columns) {
    if (c.title.toLowerCase().includes(lower) || lower.includes(c.title.toLowerCase())) return c;
  }
  return null;
}

/**
 * 校验并修正 ExecutionPlan
 * 纯函数：不修改输入 plan，返回 validated plan（含修正后的副本）
 *
 * 可传入可选的 DataProfile 以启用数据感知校验：
 *   - 空值检测（filter 列空值过多 → 警告）
 *   - 匹配键质量检测（join key 重复率高 → 警告）
 *   - 聚合类型检测（非数值列聚合 → 错误）
 *   - 去重影响预估（去重将删除大量行 → 警告）
 */
export function validatePlan(plan: ExecutionPlan, columns: ColumnDef[], profile?: DataProfile): PlanValidationResult {
  const issues: ValidationIssue[] = [];

  // === 多阶段校验 ===
  // Phase 1: 原始合法性校验（原有逻辑）
  const baseResult = validatePlanBase(plan, columns);
  issues.push(...baseResult.issues);

  // Phase 2: 数据感知校验（profile 存在时）
  if (profile) {
    const profileIssues = validateWithProfile(plan, profile, columns);
    issues.push(...profileIssues);
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    plan: baseResult.plan,
    issues,
  };
}

/**
 * Phase 1: 原始合法性校验（原有逻辑，提取为独立函数）
 */
function validatePlanBase(plan: ExecutionPlan, columns: ColumnDef[]): PlanValidationResult {
  const issues: ValidationIssue[] = [];

  switch (plan.type) {
    case 'filter':
      return validateFilterPlan(plan, columns, issues);
    case 'sort':
      return validateSortPlan(plan, columns, issues);
    case 'aggregate':
      return validateAggregatePlan(plan, columns, issues);
    case 'dedup':
      return validateDedupPlan(plan, columns, issues);
    case 'match':
      return validateMatchPlan(plan, columns, issues);
    case 'merge':
      break;
    case 'clean':
      break;
    case 'projection':
      return validateProjectionPlan(plan, columns, issues);
    case 'update':
      return validateUpdatePlan(plan, columns, issues);
    case 'formula':
      return validateFormulaPlan(plan, columns, issues);
    case 'pipeline':
      return validatePipelinePlan(plan, columns, issues);
    default:
      issues.push({ field: 'type', message: `未知操作类型: ${(plan as any).type}`, severity: 'error' });
  }

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateFilterPlan(plan: FilterPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  if (!plan.conditions || plan.conditions.length === 0) {
    issues.push({ field: 'conditions', message: '筛选操作缺少条件', severity: 'error' });
    return { valid: false, plan, issues };
  }

  const normalizedConditions: ConditionExpr[] = [];

  for (let i = 0; i < plan.conditions.length; i++) {
    const c = plan.conditions[i];
    const col = resolveCol(c.columnKey, columns);

    if (!col) {
      issues.push({ field: `conditions[${i}].columnKey`, message: `列 "${c.columnKey}" 不存在`, severity: 'error' });
      continue;
    }
    if (!VALID_OPERATORS.has(c.operator)) {
      issues.push({ field: `conditions[${i}].operator`, message: `不支持的操作符: ${c.operator}`, severity: 'error' });
      continue;
    }

    // 标准化值类型：数值列强制数值（创建新对象，不修改原条件）
    let normalizedValue = c.value;
    if (col.type === 'number' && c.value != null) {
      const n = Number(c.value);
      if (!isNaN(n)) {
        normalizedValue = n;
      }
    }

    normalizedConditions.push({ ...c, value: normalizedValue });
  }

  // 构建新的 FilterPlan（避免原引用被修改）
  const normalizedPlan: FilterPlan = {
    ...plan,
    conditions: normalizedConditions,
  };

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan: normalizedPlan, issues };
}

function validateSortPlan(plan: SortPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  if (!plan.sorts || plan.sorts.length === 0) {
    issues.push({ field: 'sorts', message: '排序操作缺少排序列', severity: 'error' });
    return { valid: false, plan, issues };
  }
  for (let i = 0; i < plan.sorts.length; i++) {
    const col = resolveCol(plan.sorts[i].columnKey, columns);
    if (!col) {
      issues.push({ field: `sorts[${i}].columnKey`, message: `排序列 "${plan.sorts[i].columnKey}" 不存在`, severity: 'error' });
    }
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateAggregatePlan(plan: AggregatePlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  const aggregations = getAggregations(plan);
  if (aggregations.length === 0) {
    issues.push({ field: 'aggregations', message: '聚合操作缺少目标列', severity: 'error' });
    return { valid: false, plan, issues };
  }
  for (const agg of aggregations) {
    const col = resolveCol(agg.column, columns);
    if (!col) {
      issues.push({ field: 'aggregations', message: `聚合列 "${agg.column}" 不存在`, severity: 'error' });
    } else if (col.type !== 'number') {
      issues.push({ field: 'aggregations', message: `"${col.title}" 不是数值列，聚合可能返回异常`, severity: 'warning' });
    }
  }
  if (plan.groupBy) {
    for (const g of plan.groupBy) {
      const col = resolveCol(g, columns);
      if (!col) {
        issues.push({ field: 'groupBy', message: `分组列 "${g}" 不存在`, severity: 'warning' });
      }
    }
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateDedupPlan(plan: DedupPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  if (!plan.columns || plan.columns.length === 0) {
    issues.push({ field: 'columns', message: '去重操作缺少目标列，将使用全部列', severity: 'warning' });
  } else {
    for (const colKey of plan.columns) {
      const col = resolveCol(colKey, columns);
      if (!col) {
        issues.push({ field: 'columns', message: `去重列 "${colKey}" 不存在`, severity: 'warning' });
      }
    }
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateMatchPlan(plan: MatchPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  for (const colKey of plan.matchColumns) {
    const col = resolveCol(colKey, columns);
    if (!col) {
      issues.push({ field: 'matchColumns', message: `匹配列 "${colKey}" 不存在`, severity: 'warning' });
    }
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateProjectionPlan(plan: ProjectionPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  if (plan.includeColumns) {
    for (const colKey of plan.includeColumns) {
      if (!resolveCol(colKey, columns)) {
        issues.push({ field: 'includeColumns', message: `列 "${colKey}" 不存在，将被跳过`, severity: 'warning' });
      }
    }
  }
  if (plan.excludeColumns) {
    for (const colKey of plan.excludeColumns) {
      if (!resolveCol(colKey, columns)) {
        issues.push({ field: 'excludeColumns', message: `列 "${colKey}" 不存在，将被跳过`, severity: 'warning' });
      }
    }
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validateUpdatePlan(plan: UpdatePlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  const col = resolveCol(plan.column, columns);

  if (!col) {
    issues.push({ field: 'column', message: `目标列 "${plan.column}" 不存在，将跳过修改`, severity: 'warning' });
    return { valid: true, plan, issues };
  }

  // 值类型标准化：数值列强制数值（创建副本，不修改原 plan）
  let normalizedValue = plan.value;
  if (col.type === 'number' && typeof plan.value !== 'number') {
    const n = Number(plan.value);
    if (!isNaN(n)) {
      normalizedValue = n;
    }
  }

  let normalizedConditions = plan.conditions;
  if (plan.conditions) {
    for (let i = 0; i < plan.conditions.length; i++) {
      const c = plan.conditions[i];
      if (!resolveCol(c.columnKey, columns)) {
        issues.push({ field: `conditions[${i}].columnKey`, message: `条件列 "${c.columnKey}" 不存在`, severity: 'error' });
      }
    }
  }

  const normalizedPlan: UpdatePlan = {
    ...plan,
    value: normalizedValue,
  };

  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan: normalizedPlan, issues };
}

function validateFormulaPlan(plan: FormulaPlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  for (const colKey of plan.sourceColumns) {
    if (!resolveCol(colKey, columns)) {
      issues.push({ field: 'sourceColumns', message: `源列 "${colKey}" 不存在`, severity: 'warning' });
    }
  }
  if (plan.conditionColumn && !resolveCol(plan.conditionColumn, columns)) {
    issues.push({ field: 'conditionColumn', message: `IF 条件列 "${plan.conditionColumn}" 不存在`, severity: 'error' });
  }
  return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan, issues };
}

function validatePipelinePlan(plan: PipelinePlan, columns: ColumnDef[], issues: ValidationIssue[]): PlanValidationResult {
  if (!plan.steps || plan.steps.length === 0) {
    issues.push({ field: 'steps', message: 'Pipeline 无步骤，将返回原数据', severity: 'warning' });
    return { valid: true, plan, issues };
  }

  if (plan.steps.length === 1) {
    const stepResult = validatePlan(plan.steps[0], columns);
    for (const iss of stepResult.issues) {
      issues.push({ field: `steps[0].${iss.field}`, message: iss.message, severity: iss.severity });
    }
    return { valid: issues.filter((i) => i.severity === 'error').length === 0, plan: { ...plan, steps: [stepResult.plan] }, issues };
  }

  const normalizedSteps: ExecutionPlan[] = [];
  const evolvingColumns = [...columns];
  for (let i = 0; i < plan.steps.length; i++) {
    const stepResult = validatePlan(plan.steps[i], evolvingColumns);
    for (const iss of stepResult.issues) {
      issues.push({ field: `steps[${i}].${iss.field}`, message: iss.message, severity: iss.severity });
    }
    normalizedSteps.push(stepResult.plan);
    // 追踪列变更：formula 新增列，rename 改 title
    const rawStep = plan.steps[i];
    if (rawStep.type === 'formula' && 'targetColumn' in rawStep && rawStep.targetColumn) {
      const existing = evolvingColumns.find(c => c.key === rawStep.targetColumn || c.title === rawStep.targetColumn);
      if (!existing) {
        evolvingColumns.push({ key: rawStep.targetColumn, title: rawStep.targetColumn, type: 'number' });
      }
    }
    if (rawStep.type === 'projection' && 'renameColumns' in rawStep && rawStep.renameColumns) {
      for (const [oldKey, newTitle] of Object.entries(rawStep.renameColumns)) {
        const col = evolvingColumns.find(c => c.key === oldKey || c.title === oldKey);
        if (col) col.title = newTitle as string;
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    plan: { ...plan, steps: normalizedSteps },
    issues,
  };
}

// ============================================================
// Phase 2: 数据感知校验（需 DataProfile）
// ============================================================

function validateWithProfile(
  plan: ExecutionPlan,
  profile: DataProfile,
  columns: ColumnDef[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (plan.type) {
    case 'filter':
      return profileValidateFilter(plan, profile, issues);
    case 'aggregate':
      return profileValidateAggregate(plan, profile, issues);
    case 'match':
      return profileValidateMatch(plan, profile, issues);
    case 'dedup':
      return profileValidateDedup(plan, profile, issues);
    case 'formula':
      return profileValidateFormula(plan, profile, issues);
    case 'pipeline':
      return profileValidatePipeline(plan, profile, columns, issues);
    default:
      return issues;
  }
}

/** 筛选操作的 profile 检测 */
function profileValidateFilter(
  plan: FilterPlan,
  profile: DataProfile,
  issues: ValidationIssue[],
): ValidationIssue[] {
  for (const cond of plan.conditions) {
    const colProfile = profile.columns.find((c) => c.columnKey === cond.columnKey);
    if (!colProfile) continue;

    // 空值过多 → 可能导致 0 结果
    if (colProfile.nullRate > 0.5) {
      issues.push({
        field: `conditions.${cond.columnKey}`,
        message: `"${colProfile.title}" 列空值率 ${(colProfile.nullRate * 100).toFixed(0)}%，筛选后可能返回空结果`,
        severity: 'warning',
      });
    }

    // 类型不匹配：数字列做文本匹配
    if (colProfile.type === 'number' && ['CONTAINS', 'STARTS_WITH', 'ENDS_WITH'].includes(cond.operator)) {
      issues.push({
        field: `conditions.${cond.columnKey}`,
        message: `"${colProfile.title}" 是数值列，不支持 ${cond.operator} 文本匹配操作`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

/** 聚合操作的 profile 检测 */
function profileValidateAggregate(
  plan: AggregatePlan,
  profile: DataProfile,
  issues: ValidationIssue[],
): ValidationIssue[] {
  const aggregations = getAggregations(plan);
  for (const agg of aggregations) {
    const colProfile = profile.columns.find((c) => c.columnKey === agg.column);
    if (!colProfile) continue;

    // 非数值列做聚合 → 错误
    if (colProfile.type !== 'number') {
      issues.push({
        field: `aggregations.${agg.column}`,
        message: `"${colProfile.title}" 列推断类型为 ${colProfile.type}，不是数值类型，${agg.method} 聚合可能返回异常结果`,
        severity: 'error',
      });
    }

    // 空值过多影响聚合准确性
    if (colProfile.nullRate > 0.1) {
      issues.push({
        field: `aggregations.${agg.column}`,
        message: `"${colProfile.title}" 列存在 ${(colProfile.nullRate * 100).toFixed(0)}% 空值，聚合结果仅基于非空行`,
        severity: 'warning',
      });
    }
  }

  // groupBy 列的唯一值过多
  if (plan.groupBy) {
    for (const g of plan.groupBy) {
      const colProfile = profile.columns.find((c) => c.columnKey === g);
      if (colProfile && colProfile.uniqueRate > 0.5 && profile.rowCount > 100) {
        issues.push({
          field: `groupBy.${g}`,
          message: `"${colProfile.title}" 列唯一值率 ${(colProfile.uniqueRate * 100).toFixed(0)}%，分组后结果可能非常多`,
          severity: 'warning' as const,
        });
      }
    }
  }

  return issues;
}

/** 匹配操作的 profile 检测 */
function profileValidateMatch(
  plan: MatchPlan,
  profile: DataProfile,
  issues: ValidationIssue[],
): ValidationIssue[] {
  for (const colKey of plan.matchColumns) {
    const colProfile = profile.columns.find((c) => c.columnKey === colKey);
    if (!colProfile) continue;

    // 匹配键重复率过高 → 多对多爆炸
    if (colProfile.uniqueRate < 0.2) {
      issues.push({
        field: `matchColumns.${colKey}`,
        message: `"${colProfile.title}" 列唯一值率仅 ${(colProfile.uniqueRate * 100).toFixed(0)}%，作为匹配键可能导致多对多结果膨胀`,
        severity: 'warning',
      });
    }

    // 空值匹配键 → 匹配失败
    if (colProfile.nullRate > 0.1) {
      issues.push({
        field: `matchColumns.${colKey}`,
        message: `"${colProfile.title}" 列存在 ${(colProfile.nullRate * 100).toFixed(0)}% 空值，空值行无法参与匹配`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

/** 去重操作的 profile 检测 */
function profileValidateDedup(
  plan: DedupPlan,
  profile: DataProfile,
  issues: ValidationIssue[],
): ValidationIssue[] {
  const targetCols = plan.columns && plan.columns.length > 0
    ? plan.columns
    : profile.columns.map((c) => c.columnKey);

  for (const colKey of targetCols) {
    const colProfile = profile.columns.find((c) => c.columnKey === colKey);
    if (!colProfile) continue;

    // 空值列去重可能导致意外删除
    if (colProfile.nullRate > 0.2) {
      issues.push({
        field: `columns.${colKey}`,
        message: `"${colProfile.title}" 列空值率 ${(colProfile.nullRate * 100).toFixed(0)}%，按此列去重可能导致空值行被删除`,
        severity: 'warning',
      });
    }
  }

  // 整体重复率过高
  if (profile.globalStats.duplicateRowRate > 0.3) {
    issues.push({
      field: 'columns',
      message: `数据重复行率 ${(profile.globalStats.duplicateRowRate * 100).toFixed(0)}%，去重将删除大量数据`,
      severity: 'warning',
    });
  }

  return issues;
}

/** 公式操作的 profile 检测 */
function profileValidateFormula(
  plan: FormulaPlan,
  profile: DataProfile,
  issues: ValidationIssue[],
): ValidationIssue[] {
  for (const colKey of plan.sourceColumns) {
    const colProfile = profile.columns.find((c) => c.columnKey === colKey);
    if (!colProfile) continue;

    // 数学运算要求数值列
    if (['SUM', 'AVG', 'ROUND', 'ABS'].includes(plan.expressionType)) {
      if (colProfile.type !== 'number') {
        issues.push({
          field: `sourceColumns.${colKey}`,
          message: `"${colProfile.title}" 列推断为 ${colProfile.type}，${plan.expressionType} 运算可能需要数值`,
          severity: 'warning',
        });
      }
    }
  }
  return issues;
}

/** Pipeline 的 profile 检测（递归到子步骤） */
function profileValidatePipeline(
  plan: PipelinePlan,
  profile: DataProfile,
  columns: ColumnDef[],
  issues: ValidationIssue[],
): ValidationIssue[] {
  if (!plan.steps) return issues;
  for (let i = 0; i < plan.steps.length; i++) {
    const stepIssues = validateWithProfile(plan.steps[i], profile, columns);
    for (const iss of stepIssues) {
      issues.push({
        field: `steps[${i}].${iss.field}`,
        message: iss.message,
        severity: iss.severity,
      });
    }
  }
  return issues;
}
