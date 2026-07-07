// ============================================================
// Join Repair — Join 键模糊匹配与映射
// ============================================================
// 职责：在 Match/Join 操作前，对两表的 Join 键值做模糊匹配
//
// 左表 "杭州" → 右表 "杭州市" 自动映射
// 左表 3 值 右表 2 值 → 不失败，输出未匹配项
// ============================================================

import type { MatchPlan } from '../../v2/execution-plan';
import type { ColumnDef, RowData } from '../../types';
import type { DataProfile } from '../profile/types';
import { normalizeValue, valueSimilarity } from './value-repair';
import type { RepairRecord } from './repair-types';

/** Join 键映射 */
export interface JoinKeyMapping {
  sourceValue: string;
  targetValue: string | null;
  confidence: number;
}

/** Join 修复结果 */
export interface JoinRepairResult {
  mappings: JoinKeyMapping[];
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    matchRate: number;
  };
  repairs: RepairRecord[];
}

/**
 * 构建 Join 键值映射
 *
 * 多阶段匹配策略：
 *   Phase 1: 精确匹配（normalize 后 ===）
 *   Phase 2: 包含匹配（一方包含另一方）
 *   Phase 3: Levenshtein 模糊匹配（距离 ≤ 2）
 *   Phase 4: 前缀匹配（如 "北京" → "北京市"）
 *
 *  未匹配的源值 → targetValue = null
 */
export function buildJoinMapping(
  leftValues: string[],
  rightValues: string[],
): JoinRepairResult {
  const repairs: RepairRecord[] = [];

  // 对右表值建立规范化索引
  const rightIndex = new Map<string, string[]>();
  for (const rv of rightValues) {
    const norm = normalizeValue(rv);
    if (!rightIndex.has(norm)) {
      rightIndex.set(norm, []);
    }
    rightIndex.get(norm)!.push(rv);
  }

  const rightNormSet = new Set(rightIndex.keys());
  const usedRightKeys = new Set<string>();

  const mappings: JoinKeyMapping[] = [];

  for (const lv of leftValues) {
    const normLv = normalizeValue(lv);

    // Phase 1: 精确匹配（normalize 后 ===）
    if (rightNormSet.has(normLv)) {
      // 取第一个未使用的匹配
      const candidates = rightIndex.get(normLv)!;
      const bestMatch = candidates.find((c) => !usedRightKeys.has(c)) || candidates[0];
      usedRightKeys.add(bestMatch);
      mappings.push({ sourceValue: lv, targetValue: bestMatch, confidence: 1.0 });
      continue;
    }

    // Phase 2: 包含匹配
    let matched = false;
    for (const rv of rightValues) {
      if (usedRightKeys.has(rv)) continue;
      const normRv = normalizeValue(rv);
      if (normLv.includes(normRv) || normRv.includes(normLv)) {
        usedRightKeys.add(rv);
        const sim = Math.min(normLv.length, normRv.length) / Math.max(normLv.length, normRv.length);
        const confidence = 0.7 + sim * 0.15;
        repairs.push({
          action: 'JOIN_KEY_MAP',
          target: lv,
          original: lv,
          repaired: rv,
          confidence,
          category: confidence >= 0.7 ? 'auto' : 'suggest',
          detail: `"${lv}" → "${rv}"（包含匹配，相似度 ${(confidence * 100).toFixed(0)}%）`,
        });
        mappings.push({ sourceValue: lv, targetValue: rv, confidence });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Phase 3: Levenshtein 模糊匹配
    let bestFuzzy: { value: string; score: number } | null = null;
    for (const rv of rightValues) {
      if (usedRightKeys.has(rv)) continue;
      const sim = valueSimilarity(lv, rv);
      if (sim >= 0.6 && (!bestFuzzy || sim > bestFuzzy.score)) {
        bestFuzzy = { value: rv, score: sim };
      }
    }

    if (bestFuzzy) {
      usedRightKeys.add(bestFuzzy.value);
      const confidence = Math.min(0.8, bestFuzzy.score);
      repairs.push({
        action: 'JOIN_KEY_MAP',
        target: lv,
        original: lv,
        repaired: bestFuzzy.value,
        confidence,
        category: confidence >= 0.7 ? 'auto' : 'suggest',
        detail: `"${lv}" → "${bestFuzzy.value}"（模糊匹配，相似度 ${(confidence * 100).toFixed(0)}%）`,
      });
      mappings.push({ sourceValue: lv, targetValue: bestFuzzy.value, confidence });
      continue;
    }

    // Phase 4: 前缀匹配（如 "北京" → "北京市"）
    for (const rv of rightValues) {
      if (usedRightKeys.has(rv)) continue;
      const normRv = normalizeValue(rv);
      if (normRv.startsWith(normLv) || normLv.startsWith(normRv)) {
        usedRightKeys.add(rv);
        const lenRatio = Math.min(normLv.length, normRv.length) / Math.max(normLv.length, normRv.length);
        const confidence = 0.65 + lenRatio * 0.1;
        repairs.push({
          action: 'JOIN_KEY_MAP',
          target: lv,
          original: lv,
          repaired: rv,
          confidence,
          category: 'suggest',
          detail: `"${lv}" → "${rv}"（前缀匹配）`,
        });
        mappings.push({ sourceValue: lv, targetValue: rv, confidence });
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 未匹配
    mappings.push({ sourceValue: lv, targetValue: null, confidence: 0 });
  }

  const total = mappings.length;
  const matched = mappings.filter((m) => m.targetValue !== null).length;
  const unmatched = total - matched;

  return {
    mappings,
    stats: {
      total,
      matched,
      unmatched,
      matchRate: total > 0 ? matched / total : 0,
    },
    repairs,
  };
}

/**
 * 从 MatchPlan 和 DataProfile 修复 Join 需求
 * 注意：当前 MatchExecutor 自动检测共同列名，因此在 Phase 4 阶段
 * join-repair 主要作为分析工具，待 Phase 7 集成时接入执行链
 */
export function repairJoinPlan(
  plan: MatchPlan,
  _profile: DataProfile,
  _columns: ColumnDef[],
  _allFiles: Array<{ name: string; columns: ColumnDef[]; rows: RowData[] }>,
): { plan: MatchPlan; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];

  // 当前阶段只做列引用修复(委托给 column-repair)，
  // 值级别的模糊匹配在集成阶段通过 buildJoinMapping 使用
  return { plan, repairs };
}
