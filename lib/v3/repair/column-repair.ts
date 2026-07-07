// ============================================================
// Column Repair — 列修复
// ============================================================
// 职责：
//   1. 列名模糊匹配（用户写错列名时自动纠正）
//   2. 值→列反推（用户说"杭州的数据"，自动推断"城市=杭州"）
//   3. 遍历 ExecutionPlan 修复所有列引用
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type {
  ExecutionPlan,
  FilterPlan,
  SortPlan,
  AggregatePlan,
  AggregationDef,
  DedupPlan,
  MatchPlan,
  MergePlan,
  CleanPlan,
  ProjectionPlan,
  UpdatePlan,
  FormulaPlan,
  PipelinePlan,
} from '../../v2/execution-plan';
import { getAggregations } from '../../v2/execution-plan';
import { Operator } from '../../v2/types';
import { normalizeValue, levenshteinDistance } from './value-repair';
import type { ColumnValueIndex, RepairRecord } from './repair-types';

// ============================================================
// 列名模糊匹配
// ============================================================

export interface FuzzyMatchResult {
  matched: ColumnDef | null;
  candidates: Array<{ column: ColumnDef; score: number }>;
  confidence: number;
}

/**
 * 列名模糊匹配
 *
 * 匹配优先级：
 *   1. 列名/key 完全匹配 → 1.0
 *   2. 大小写不敏感完全匹配 → 0.95
 *   3. 包含匹配（hint 在标题中 或 标题包含 hint）→ 0.7~0.85
 *   4. Levenshtein 距离 ≤ 2 → 0.5~0.8
 *   5. 列关键词匹配 → 0.5~0.7
 */
export function fuzzyMatchColumn(
  hint: string,
  columns: ColumnDef[],
  threshold = 0.4,
): FuzzyMatchResult {
  const candidates: Array<{ column: ColumnDef; score: number }> = [];
  const lowerHint = hint.toLowerCase();
  const normHint = normalizeValue(hint);

  for (const col of columns) {
    const colTitleLower = col.title.toLowerCase();
    const colKeyLower = col.key.toLowerCase();
    let score = 0;

    // 1) 完全匹配
    if (col.key === hint || col.title === hint) {
      score = 1.0;
    }
    // 2) 大小写不敏感完全匹配
    else if (col.key.toLowerCase() === lowerHint || col.title.toLowerCase() === lowerHint) {
      score = 0.95;
    }
    // 3) 包含匹配
    else if (colTitleLower.includes(lowerHint) || lowerHint.includes(colTitleLower)) {
      // 短提示匹配长标题（如 "工资" → "基本工资"）比反向更可靠
      if (colTitleLower.includes(lowerHint)) {
        score = 0.8 + (lowerHint.length / colTitleLower.length) * 0.05;
      } else {
        score = 0.7;
      }
    }
    // 4) Levenshtein 距离 ≤ 2
    else {
      const normTitle = normalizeValue(col.title);
      const dist = levenshteinDistance(normHint, normTitle);
      if (dist > 0 && dist <= 2) {
        score = Math.min(0.8, 1 - dist / Math.max(normHint.length, normTitle.length));
      }
    }

    if (score >= threshold) {
      candidates.push({ column: col, score });
    }
  }

  // 按得分降序排列
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return { matched: null, candidates: [], confidence: 0 };
  }

  const best = candidates[0];
  return {
    matched: best.column,
    candidates,
    confidence: best.score,
  };
}

// ============================================================
// 值→列反推
// ============================================================

/**
 * 构建列值索引
 * 遍历所有行，为每列建立唯一值集合
 */
export function buildColumnValueIndex(
  columns: ColumnDef[],
  rows: RowData[],
): ColumnValueIndex[] {
  return columns.map((col) => {
    const valueMap = new Map<string, string>();
    const uniqueValues = new Set<string>();

    for (const row of rows) {
      const raw = row[col.key];
      if (raw == null) continue;

      const strVal = String(raw).trim();
      if (strVal === '') continue;

      const normVal = normalizeValue(strVal);
      if (!uniqueValues.has(normVal)) {
        uniqueValues.add(normVal);
        valueMap.set(normVal, strVal);
      }
    }

    return {
      columnKey: col.key,
      columnTitle: col.title,
      uniqueValues,
      valueMap,
    };
  });
}

/**
 * 基于唯一值索引推断列
 *
 * 检查某个值属于哪一列的唯一值集合。
 * 返回匹配的列（可能有多个候选时选置信度最高的）。
 */
export function inferColumnFromValue(
  value: string,
  columnIndex: ColumnValueIndex[],
): { columnKey: string; columnTitle: string; confidence: number } | null {
  const normValue = normalizeValue(value);

  const matches: Array<{
    columnKey: string;
    columnTitle: string;
    confidence: number;
  }> = [];

  for (const idx of columnIndex) {
    // Phase 1: 精确匹配
    if (idx.uniqueValues.has(normValue)) {
      matches.push({
        columnKey: idx.columnKey,
        columnTitle: idx.columnTitle,
        confidence: 0.95,
      });
      continue;
    }

    // Phase 2: 部分匹配（值包含在某个唯一值中，或唯一值包含该值）
    for (const uv of idx.uniqueValues) {
      if (uv.includes(normValue) || normValue.includes(uv)) {
        const lenRatio = Math.min(uv.length, normValue.length) / Math.max(uv.length, normValue.length);
        matches.push({
          columnKey: idx.columnKey,
          columnTitle: idx.columnTitle,
          confidence: 0.6 + lenRatio * 0.25,
        });
        break;
      }
    }
  }

  if (matches.length === 0) return null;

  // 去重（同一列可能有多条匹配，保留最高置信度的）
  const bestPerColumn = new Map<string, typeof matches[0]>();
  for (const m of matches) {
    const existing = bestPerColumn.get(m.columnKey);
    if (!existing || m.confidence > existing.confidence) {
      bestPerColumn.set(m.columnKey, m);
    }
  }

  const unique = Array.from(bestPerColumn.values());
  unique.sort((a, b) => b.confidence - a.confidence);

  return unique[0];
}

// ============================================================
// ExecutionPlan 列引用修复
// ============================================================

/**
 * 检查列名是否在 columns 列表中
 */
function columnExists(key: string, columns: ColumnDef[]): boolean {
  return columns.some((c) => c.key === key || c.title === key);
}

/**
 * 尝试解析列引用
 * 1. 直接存在 → 返回 columnKey
 * 2. 模糊匹配 → 返回匹配的 columnKey + 修复记录
 * 3. 值→列反推 → 返回匹配的 columnKey + 修复记录（仅当没有匹配到列时）
 */
function resolveColRef(
  hint: string,
  columns: ColumnDef[],
  columnIndex?: ColumnValueIndex[],
): { key: string | null; repair?: RepairRecord } {
  // 检查是否已经是有效的 columnKey
  const exactKey = columns.find((c) => c.key === hint);
  if (exactKey) return { key: hint };

  // 检查是否匹配 column title（已在编译器中解析过，但 safety check）
  const exactTitle = columns.find((c) => c.title === hint);
  if (exactTitle) return { key: exactTitle.key };

  // 模糊匹配
  const fuzzy = fuzzyMatchColumn(hint, columns);
  if (fuzzy.matched && fuzzy.confidence >= 0.5) {
    return {
      key: fuzzy.matched.key,
      repair: {
        action: 'COLUMN_FUZZY_MATCH',
        target: hint,
        original: hint,
        repaired: fuzzy.matched.title,
        confidence: fuzzy.confidence,
        category: fuzzy.confidence >= 0.7 ? 'auto' : 'suggest',
        detail: `列"${hint}"未找到，自动匹配到"${fuzzy.matched.title}"（置信度 ${(fuzzy.confidence * 100).toFixed(0)}%）`,
      },
    };
  }

  // 值→列反推
  if (columnIndex) {
    const inferred = inferColumnFromValue(hint, columnIndex);
    if (inferred && inferred.confidence >= 0.5) {
      return {
        key: inferred.columnKey,
        repair: {
          action: 'VALUE_TO_COLUMN',
          target: hint,
          original: hint,
          repaired: inferred.columnTitle,
          confidence: inferred.confidence,
          category: inferred.confidence >= 0.7 ? 'auto' : 'suggest',
          detail: `"${hint}"不是一个列名，而是"${inferred.columnTitle}"列中的一个值，已自动匹配到该列`,
        },
      };
    }
  }

  return { key: null };
}

/**
 * 遍历 ExecutionPlan 修复所有列引用
 *
 * 处理所有计划类型中的列引用，对不存在的列尝试模糊匹配或值→列反推。
 * 返回修复后的 plan 副本（不修改原始 plan）。
 */
export function resolveColumnReferences(
  plan: ExecutionPlan,
  columns: ColumnDef[],
  columnIndex?: ColumnValueIndex[],
): { plan: ExecutionPlan; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];

  const repairedPlan = resolveInPlan(plan, columns, columnIndex, repairs);

  return { plan: repairedPlan, repairs };
}

function resolveInPlan(
  plan: ExecutionPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): ExecutionPlan {
  switch (plan.type) {
    case 'filter':
      return resolveFilterPlan(plan, columns, columnIndex, repairs);
    case 'sort':
      return resolveSortPlan(plan, columns, columnIndex, repairs);
    case 'aggregate':
      return resolveAggregatePlan(plan, columns, columnIndex, repairs);
    case 'dedup':
      return resolveDedupPlan(plan, columns, columnIndex, repairs);
    case 'match':
      return resolveMatchPlan(plan, columns, columnIndex, repairs);
    case 'projection':
      return resolveProjectionPlan(plan, columns, columnIndex, repairs);
    case 'update':
      return resolveUpdatePlan(plan, columns, columnIndex, repairs);
    case 'formula':
      return resolveFormulaPlan(plan, columns, columnIndex, repairs);
    case 'pipeline':
      return resolvePipelinePlan(plan, columns, columnIndex, repairs);
    case 'merge':
    case 'clean':
    default:
      return plan;
  }
}

function resolveSingleKey(
  hint: string,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): string | null {
  if (columnExists(hint, columns)) return hint;

  const { key, repair } = resolveColRef(hint, columns, columnIndex);
  if (repair) repairs.push(repair);
  return key;
}

function resolveKeys(
  hints: string[],
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): (string | null)[] {
  return hints.map((h) => resolveSingleKey(h, columns, columnIndex, repairs));
}

function resolveFilterPlan(
  plan: FilterPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): FilterPlan {
  const newConditions = plan.conditions.map((c) => {
    const resolvedKey = resolveSingleKey(c.columnKey, columns, columnIndex, repairs);
    if (!resolvedKey) return c;

    // 值→列反推：如果原始 hint 被解析为列，且该值存在于某列中，
    // 自动将操作符修正为 EQ，原始"hint"成为条件值
    const wasValueInfer = repairs.some(
      (r) => r.action === 'VALUE_TO_COLUMN' && r.target === c.columnKey,
    );

    if (wasValueInfer) {
      return {
        ...c,
        columnKey: resolvedKey,
        operator: Operator.EQ,
        value: c.columnKey, // 原始"hint"成为条件值
        logic: c.logic,
      };
    }

    return { ...c, columnKey: resolvedKey };
  });

  return { ...plan, conditions: newConditions };
}

function resolveSortPlan(
  plan: SortPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): SortPlan {
  const newSorts = plan.sorts.map((s) => {
    const resolvedKey = resolveSingleKey(s.columnKey, columns, columnIndex, repairs);
    return { ...s, columnKey: resolvedKey ?? s.columnKey };
  });
  return { ...plan, sorts: newSorts };
}

function resolveAggregatePlan(
  plan: AggregatePlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): AggregatePlan {
  const oldAggs = getAggregations(plan);
  const newAggs = oldAggs
    .map(agg => {
      const key = resolveSingleKey(agg.column, columns, columnIndex, repairs);
      return key ? { column: key, method: agg.method } : null;
    })
    .filter((a): a is AggregationDef => a !== null);
  const newGroupBy = plan.groupBy
    ? resolveKeys(plan.groupBy, columns, columnIndex, repairs)
        .filter((k): k is string => k !== null)
    : undefined;
  return { ...plan, aggregations: newAggs, groupBy: newGroupBy };
}

function resolveDedupPlan(
  plan: DedupPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): DedupPlan {
  const newColumns = resolveKeys(plan.columns, columns, columnIndex, repairs)
    .filter((k): k is string => k !== null);
  return { ...plan, columns: newColumns };
}

function resolveMatchPlan(
  plan: MatchPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): MatchPlan {
  const newMatchColumns = resolveKeys(plan.matchColumns, columns, columnIndex, repairs)
    .filter((k): k is string => k !== null);
  return { ...plan, matchColumns: newMatchColumns };
}

function resolveProjectionPlan(
  plan: ProjectionPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): ProjectionPlan {
  const includeColumns = plan.includeColumns
    ? resolveKeys(plan.includeColumns, columns, columnIndex, repairs)
        .filter((k): k is string => k !== null)
    : undefined;

  const excludeColumns = plan.excludeColumns
    ? resolveKeys(plan.excludeColumns, columns, columnIndex, repairs)
        .filter((k): k is string => k !== null)
    : undefined;

  // renameColumns 中的 key 也做模糊匹配
  let renameColumns = plan.renameColumns;
  if (renameColumns) {
    const newRename: Record<string, string> = {};
    for (const [oldKey, newTitle] of Object.entries(renameColumns)) {
      const resolved = resolveSingleKey(oldKey, columns, columnIndex, repairs);
      newRename[resolved ?? oldKey] = newTitle;
    }
    renameColumns = newRename;
  }

  const reorderColumns = plan.reorderColumns
    ? resolveKeys(plan.reorderColumns, columns, columnIndex, repairs)
        .filter((k): k is string => k !== null)
    : undefined;

  return { ...plan, includeColumns, excludeColumns, renameColumns, reorderColumns };
}

function resolveUpdatePlan(
  plan: UpdatePlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): UpdatePlan {
  const column = resolveSingleKey(plan.column, columns, columnIndex, repairs);
  const conditions = plan.conditions?.map((c) => {
    const resolvedKey = resolveSingleKey(c.columnKey, columns, columnIndex, repairs);
    return { ...c, columnKey: resolvedKey ?? c.columnKey };
  });

  return { ...plan, column: column ?? plan.column, conditions };
}

function resolveFormulaPlan(
  plan: FormulaPlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): FormulaPlan {
  const sourceColumns = resolveKeys(plan.sourceColumns, columns, columnIndex, repairs)
    .filter((k): k is string => k !== null);

  const conditionColumn = plan.conditionColumn
    ? resolveSingleKey(plan.conditionColumn, columns, columnIndex, repairs)
    : undefined;

  return {
    ...plan,
    sourceColumns,
    conditionColumn: conditionColumn ?? plan.conditionColumn,
  };
}

function resolvePipelinePlan(
  plan: PipelinePlan,
  columns: ColumnDef[],
  columnIndex: ColumnValueIndex[] | undefined,
  repairs: RepairRecord[],
): PipelinePlan {
  const newSteps = plan.steps.map((step) =>
    resolveInPlan(step, columns, columnIndex, repairs),
  );
  return { ...plan, steps: newSteps };
}
