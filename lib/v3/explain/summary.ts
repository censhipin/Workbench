// ============================================================
// Summary — 总体总结生成
// ============================================================
// 根据操作类型和结果生成一句总体总结
// ============================================================

import type { ExecutionPlan } from '../../v2/execution-plan';
import type { ExecutionResult } from '../../execution-engine';

export function buildSummary(
  plan: ExecutionPlan | null,
  operationLabel: string,
  execution: ExecutionResult | null,
): string {
  if (!execution || !execution.success) {
    return '执行未完成，请查看错误详情。';
  }
  if (!plan) return '执行成功。';

  switch (plan.type) {
    case 'filter':
      return buildFilterSummary(plan, execution);
    case 'aggregate':
      return buildAggregateSummary(plan, execution);
    case 'match':
      return buildMatchSummary(plan, execution);
    case 'sort':
      return '排序完成。';
    case 'dedup':
      return buildDedupSummary(execution);
    case 'formula':
      return buildFormulaSummary(plan, execution);
    case 'clean':
      return '数据清洗完成。';
    case 'update':
      return `批量更新完成。`;
    case 'projection':
      return '字段选择完成。';
    case 'merge':
      return '多表合并完成。';
    case 'pipeline':
      return '多步流水线执行完成。';
    default:
      return `${operationLabel}完成。`;
  }
}

function buildFilterSummary(plan: any, execution: ExecutionResult): string {
  const total = execution.summary?.beforeCount ?? execution.summary?.totalRecords;
  const after = execution.data?.rows.length;
  if (after !== undefined && total !== undefined) {
    const removed = total - after;
    return `成功完成筛选。共处理 ${total} 行，保留 ${after} 行，删除 ${removed} 行。`;
  }
  return '筛选完成。';
}

function buildAggregateSummary(plan: any, execution: ExecutionResult): string {
  const groups = plan.groupBy?.length ?? 0;
  const resultRows = execution.data?.rows.length ?? 0;
  if (groups > 0) {
    return `成功完成聚合。按照 ${plan.groupBy.join('、')} 分为 ${resultRows} 个组。`;
  }
  return `成功完成聚合。共输出 ${resultRows} 行结果。`;
}

function buildMatchSummary(plan: any, execution: ExecutionResult): string {
  const after = execution.data?.rows.length ?? 0;
  return `成功完成匹配。共输出 ${after} 行结果。`;
}

function buildDedupSummary(execution: ExecutionResult): string {
  const after = execution.data?.rows.length ?? 0;
  return `去重完成。共保留 ${after} 行唯一数据。`;
}

function buildFormulaSummary(plan: any, execution: ExecutionResult): string {
  const after = execution.data?.rows.length ?? 0;
  return `公式计算完成。新增列「${plan.targetColumn}」，共 ${after} 行。`;
}
