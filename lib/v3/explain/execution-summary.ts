// ============================================================
// Execution Summary — 执行过程翻译
// ============================================================
// 解释每种操作类型的具体执行过程和结果
// ============================================================

import type { ExecutionPlan } from '../../v2/execution-plan';
import type { ExecutionResult } from '../../execution-engine';
import type { DataProfile } from '../profile/types';

export function buildExecutionDetails(
  plan: ExecutionPlan | null,
  execution: ExecutionResult | null,
  profile: DataProfile | null,
): string[] {
  if (!plan || !execution) return [];

  if (!execution.success) return [`执行失败：${execution.error || '未知错误'}`];

  switch (plan.type) {
    case 'filter':
      return buildFilterDetails(plan, execution, profile);
    case 'aggregate':
      return buildAggregateDetails(plan, execution, profile);
    case 'sort':
      return ['排序完成。'];
    case 'dedup':
      return buildDedupDetails(execution);
    case 'match':
      return buildMatchDetails(plan, execution, profile);
    case 'formula':
      return buildFormulaDetails(plan, execution, profile);
    case 'clean':
      return ['数据清洗完成。'];
    case 'update':
      return buildUpdateDetails(plan);
    case 'projection':
      return buildProjectionDetails(plan);
    case 'merge':
      return ['多表合并完成。'];
    case 'pipeline':
      return ['多步流水线执行完成。'];
    default:
      return ['执行完成。'];
  }
}

function buildFilterDetails(plan: any, execution: ExecutionResult, profile: DataProfile | null): string[] {
  const lines: string[] = [];
  const total = execution.summary?.beforeCount ?? execution.summary?.totalRecords;
  const after = execution.data?.rows.length ?? 0;

  lines.push(`筛选条件已应用于数据。`);

  if (plan.conditions) {
    for (const cond of plan.conditions) {
      const colProfile = profile?.columns.find(c => c.columnKey === cond.columnKey);
      const colName = colProfile?.title ?? cond.columnKey;
      lines.push(`条件：${colName} ${cond.operator} ${cond.value ?? ''}`);
    }
  }

  if (total !== undefined) {
    const removed = total - after;
    lines.push(`共处理 ${total} 行，保留 ${after} 行，删除 ${removed} 行。`);
  }

  return lines;
}

function buildAggregateDetails(plan: any, execution: ExecutionResult, profile: DataProfile | null): string[] {
  const lines: string[] = [];
  const groups = plan.groupBy?.length ?? 0;
  const cols = plan.columns ?? [];
  const methodLabels: Record<string, string> = {
    SUM: '求和', AVG: '平均值', COUNT: '计数', MAX: '最大值', MIN: '最小值',
  };
  const methodLabel = methodLabels[plan.method] || plan.method;

  if (groups > 0) {
    lines.push(`按照「${plan.groupBy.join('、')}」进行了分组。`);
    lines.push(`每组计算「${cols.join('、')}」的${methodLabel}。`);
  } else {
    lines.push(`对「${cols.join('、')}」计算${methodLabel}。`);
  }

  const resultRows = execution.data?.rows.length ?? 0;
  if (groups > 0) {
    lines.push(`共形成 ${resultRows} 个组。`);
  }
  lines.push(`输出 ${resultRows} 行结果。`);

  // 空值说明
  if (profile) {
    for (const colKey of cols) {
      const colProfile = profile.columns.find(c => c.columnKey === colKey);
      if (colProfile && colProfile.nullRate > 0) {
        const nullPct = ((1 - colProfile.nullRate) * 100).toFixed(0);
        lines.push(`「${colProfile.title}」列计算基于 ${nullPct}% 有效数据（已忽略空值）。`);
      }
    }
  }

  return lines;
}

function buildDedupDetails(execution: ExecutionResult): string[] {
  const after = execution.data?.rows.length ?? 0;
  return [`去重完成，保留 ${after} 行唯一数据。`];
}

function buildMatchDetails(plan: any, execution: ExecutionResult, profile: DataProfile | null): string[] {
  const lines: string[] = [];
  const after = execution.data?.rows.length ?? 0;

  lines.push(`匹配键列：${plan.matchColumns?.join('、') ?? '无'}。`);
  lines.push(`共输出 ${after} 行结果。`);

  if (plan.lookupTables?.length > 0) {
    lines.push(`关联表：${plan.lookupTables.join('、')}。`);
  }

  return lines;
}

function buildFormulaDetails(plan: any, execution: ExecutionResult, profile: DataProfile | null): string[] {
  const lines: string[] = [];
  const after = execution.data?.rows.length ?? 0;

  lines.push(`公式：${plan.expression || `${plan.sourceColumns?.join('、')} → ${plan.targetColumn}`}`);
  lines.push(`涉及 ${plan.sourceColumns?.length ?? 0} 列，计算 ${after} 行。`);

  if (profile) {
    for (const colKey of plan.sourceColumns ?? []) {
      const colProfile = profile.columns.find(c => c.columnKey === colKey);
      if (colProfile && colProfile.nullRate > 0) {
        lines.push(`「${colProfile.title}」列存在空值，对应行计算结果可能为空。`);
      }
    }
  }

  return lines;
}

function buildUpdateDetails(plan: any): string[] {
  const lines: string[] = [];
  lines.push(`批量更新列「${plan.column}」。`);
  lines.push(`更新值为：${plan.value}`);
  if (plan.conditions?.length > 0) {
    lines.push(`仅更新满足条件的行。`);
  }
  return lines;
}

function buildProjectionDetails(plan: any): string[] {
  const lines: string[] = [];
  if (plan.includeColumns?.length) {
    lines.push(`仅保留 ${plan.includeColumns.length} 列。`);
  }
  if (plan.excludeColumns?.length) {
    lines.push(`排除 ${plan.excludeColumns.length} 列。`);
  }
  if (plan.renameColumns) {
    const renames = Object.entries(plan.renameColumns);
    lines.push(`重命名 ${renames.length} 列。`);
  }
  return lines;
}
