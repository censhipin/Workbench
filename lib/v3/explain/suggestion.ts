// ============================================================
// Suggestion — 可操作建议生成
// ============================================================
// 根据执行结果和错误生成用户可以直接操作的建议
// ============================================================

import type { ExecutionPlan } from '../../v2/execution-plan';
import type { DataProfile } from '../profile/types';

export function buildSuggestions(
  plan: ExecutionPlan | null,
  profile: DataProfile | null,
  error: string | null,
): string[] {
  const suggestions: string[] = [];

  if (error) {
    suggestions.push(...buildErrorSuggestions(error, plan));
  }

  if (profile) {
    suggestions.push(...buildProfileSuggestions(profile));
  }

  if (plan) {
    suggestions.push(...buildPlanSuggestions(plan, profile));
  }

  return suggestions;
}

function buildErrorSuggestions(error: string, plan: ExecutionPlan | null): string[] {
  const s: string[] = [];
  if (error.includes('列') && (error.includes('找不到') || error.includes('不存在') || error.includes('not found'))) {
    s.push('请检查输入的列名是否与数据表标题完全一致。');
    s.push('可以在数据预览中查看可用的列名列表。');
  }
  if (error.includes('类型') || error.includes('类型不匹配')) {
    s.push('请确保操作的数据类型正确（数值列用于计算，文本列用于筛选）。');
  }
  if (error.includes('匹配')) {
    s.push('检查两张表中的匹配键列是否存在相同值。');
    s.push('尝试删除空格或统一数据格式后重试。');
  }
  return s;
}

function buildProfileSuggestions(profile: DataProfile): string[] {
  const s: string[] = [];

  for (const col of profile.columns) {
    if (col.nullRate > 0.3) {
      s.push(`「${col.title}」列空值较多（${(col.nullRate * 100).toFixed(0)}%），建议先补充或删除空值。`);
    }
  }

  const highNullCols = profile.columns.filter(c => c.nullRate > 0.5);
  if (highNullCols.length > 1) {
    s.push(`共有 ${highNullCols.length} 列空值率超过 50%，建议先进行数据清洗。`);
  }

  return s;
}

function buildPlanSuggestions(plan: ExecutionPlan, profile: DataProfile | null): string[] {
  const s: string[] = [];

  if (plan.type === 'aggregate' && profile) {
    const aggCols = plan.columns ?? [];
    const planMethod = plan.method;
    for (const colKey of aggCols) {
      const colProfile = profile.columns.find(c => c.columnKey === colKey);
      if (colProfile && colProfile.type !== 'number' && planMethod !== 'COUNT') {
        const methodNames: Record<string, string> = { SUM: '求和', AVG: '平均值', MAX: '最大值', MIN: '最小值' };
        s.push(`「${colProfile.title}」列不是数值类型，${methodNames[planMethod || 'SUM'] || planMethod}可能无效，建议更换为数值列。`);
      }
    }
  }

  if (plan.type === 'filter') {
    s.push('如未筛选到数据，请检查筛选条件值是否正确。');
    s.push('可以尝试放宽筛选条件。');
  }

  if (plan.type === 'match') {
    s.push('如匹配结果不理想，请检查两张表中的匹配键列名是否一致。');
  }

  return s;
}
