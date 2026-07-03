// ============================================================
// FieldResolver — 语义字段 → 列名映射器（纯映射，不推理）
// ============================================================
// 职责：
//   将 SemanticInterpreter 输出的 semanticField 映射到实际列
//   - 不做推理、不做猜测
//   - 只做 exact/synonym/concept 三层查找
//   - 找不到列时保留 semanticField 作为 fallback（不报错）
// ============================================================

import type { ColumnDef, RowData } from '../types';
import type { TaskPlan, TaskPlanCondition } from '@/lib/nlu/taskplan-types';
import { DEFAULT_CONCEPT_REGISTRY } from '@/lib/nlu/types';

export interface FieldResolverResult {
  success: boolean;
  plan: TaskPlan;
  warnings: string[];
}

/**
 * Strategy 1: 精确匹配
 * hint → column title/key 精确匹配
 */
function strategyExact(hint: string, columns: ColumnDef[]): string | null {
  const lowerHint = hint.toLowerCase();
  for (const col of columns) {
    if (col.key === hint) return col.key;
    if (col.title === hint) return col.key;
    if (col.title.toLowerCase() === lowerHint) return col.key;
  }
  // 模糊匹配：包含关系
  for (const col of columns) {
    const titleLower = col.title.toLowerCase();
    if (titleLower.includes(lowerHint) || lowerHint.includes(titleLower)) {
      return col.key;
    }
  }
  return null;
}

/**
 * Strategy 2: 概念匹配
 * 通过 ConceptRegistry 将 semanticField 映射到列
 */
function strategyConcept(hint: string, columns: ColumnDef[]): { columnKey: string; columnTitle: string } | null {
  const lowerHint = hint.toLowerCase();

  for (const concept of DEFAULT_CONCEPT_REGISTRY) {
    const keywordMatch = concept.columnKeywords.some(
      kw => kw.toLowerCase() === lowerHint
        || kw.toLowerCase().includes(lowerHint)
        || lowerHint.includes(kw.toLowerCase())
    );
    if (!keywordMatch && lowerHint !== concept.concept.toLowerCase()
      && !concept.concept.toLowerCase().includes(lowerHint)
      && !lowerHint.includes(concept.concept.toLowerCase())) {
      continue;
    }

    for (const col of columns) {
      const colLower = col.title.toLowerCase();
      for (const kw of concept.columnKeywords) {
        const kwLower = kw.toLowerCase();
        if (colLower === kwLower || colLower.includes(kwLower) || kwLower.includes(colLower)) {
          return { columnKey: col.key, columnTitle: col.title };
        }
      }
      if (colLower === concept.concept.toLowerCase()) {
        return { columnKey: col.key, columnTitle: col.title };
      }
    }
  }

  return null;
}

/**
 * 解析单个 semanticField → 列
 * 只做两层映射，不做推理和值反转
 */
function resolveField(
  hint: string,
  columns: ColumnDef[],
): { columnTitle: string; columnKey: string } | null {
  if (!hint || hint.length === 0) return null;

  // S1: 精确匹配 hint → column
  const exactKey = strategyExact(hint, columns);
  if (exactKey) {
    const col = columns.find(c => c.key === exactKey)!;
    return { columnTitle: col.title, columnKey: col.key };
  }

  // S2: 概念匹配 semanticField → column
  const conceptMatch = strategyConcept(hint, columns);
  if (conceptMatch) {
    return { columnTitle: conceptMatch.columnTitle, columnKey: conceptMatch.columnKey };
  }

  // 找不到 → 返回 null（不报错，调用方用 semanticField 做 fallback）
  return null;
}

/**
 * 修正 TaskPlan 中的一个筛选条件
 * 只做映射，语义已在 SemanticInterpreter 完成
 */
function resolveCondition(
  cond: TaskPlanCondition,
  columns: ColumnDef[],
): { condition: TaskPlanCondition; warnings: string[] } {
  const warnings: string[] = [];
  const hint = cond.columnHint;
  if (!hint) return { condition: cond, warnings };

  const resolved = resolveField(hint, columns);
  if (!resolved) {
    // 找不到列 → 保留原 hint（不报错，compile 层会语义兜底匹配）
    return { condition: cond, warnings };
  }

  const updated: TaskPlanCondition = {
    ...cond,
    columnHint: resolved.columnTitle,
  };

  return { condition: updated, warnings };
}

/**
 * 解析 TaskPlan 中的所有 columnHint 字段
 * 纯映射，不做任何推理或值猜测
 */
export function resolveTaskPlan(
  plan: TaskPlan,
  columns: ColumnDef[],
  _rows?: RowData[],
): FieldResolverResult {
  const warnings: string[] = [];
  const updated = { ...plan };

  // 处理 conditions[]
  if (updated.conditions && updated.conditions.length > 0) {
    updated.conditions = updated.conditions.map(cond => {
      const result = resolveCondition(cond, columns);
      warnings.push(...result.warnings);
      return result.condition;
    });
  }

  // 处理子步骤（pipeline）
  if (updated.steps && updated.steps.length > 0) {
    updated.steps = updated.steps.map(step => {
      const result = resolveTaskPlan(step as TaskPlan, columns);
      warnings.push(...result.warnings);
      return result.plan as TaskPlan;
    });
  }

  return {
    success: true,
    plan: updated,
    warnings,
  };
}
