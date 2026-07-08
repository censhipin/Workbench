// ============================================================
// 歧义检测 — 在语义解析 → Schema Resolver 后、执行前
// ============================================================
// 职责：检测 Schema Resolution 是否有歧义，决定是否让用户确认
// ============================================================

import { ColumnDef, TaskIntent } from './types';
import type { SchemaCandidate } from './nlu/types';

export type AmbiguityType = 'multi_candidate' | 'low_confidence' | 'no_match';

export interface ColumnCandidate {
  key: string;
  title: string;
  confidence: number;
  matchMethod: 'semantic' | 'exact' | 'fuzzy';
  selected: boolean;
}

export interface AmbiguityReport {
  hasAmbiguity: boolean;
  type: AmbiguityType | null;
  columnCandidates: ColumnCandidate[];
  target: string;
  title: string;
  description: string;
}

export interface ExecutionPlanPreview {
  operationLabel: string;
  operation: string;
  target: string;
  primaryColumn: { key: string; title: string; confidence: number } | null;
  targetFiles: string[];
  isDangerous: boolean;
}

const CONFIDENCE_THRESHOLD = 0.7;
const MULTI_CANDIDATE_GAP = 0.25;

export class AmbiguityDetector {
  /**
   * 检测 Schema Resolution 的歧义
   *
   * 1. no_match — 无候选列，提示用户输入目标
   * 2. multi_candidate — 多个候选且分数接近
   * 3. low_confidence — 最佳置信度不足
   */
  static detect(
    intent: TaskIntent,
    candidates: SchemaCandidate[]
  ): AmbiguityReport | null {
    const target = intent.target || intent.rawPrompt;

    // === 1. no_match ===
    if (candidates.length === 0) {
      return {
        hasAmbiguity: true,
        type: 'no_match',
        columnCandidates: [],
        target,
        title: '未找到匹配列',
        description: `在当前表中未找到与"${target}"相关的列，请重新描述或手动选择`,
      };
    }

    // === 2. multi_candidate ===
    if (candidates.length > 1) {
      const top = candidates[0];
      const second = candidates[1];
      const gapSmall = top.confidence - second.confidence < MULTI_CANDIDATE_GAP;

      if (gapSmall) {
        return {
          hasAmbiguity: true,
          type: 'multi_candidate',
          columnCandidates: candidates.map((c, i) => ({
            key: c.key, title: c.title, confidence: c.confidence, matchMethod: c.matchMethod, selected: i === 0,
          })),
          target,
          title: '请确认目标列',
          description: `"${target}"匹配到多个候选列，请选择你要处理的列`,
        };
      }
    }

    // === 3. low_confidence ===
    if (candidates.length > 0) {
      const top = candidates[0];
      if (top.confidence < CONFIDENCE_THRESHOLD) {
        return {
          hasAmbiguity: true,
          type: 'low_confidence',
          columnCandidates: candidates.map((c, i) => ({
            key: c.key, title: c.title, confidence: c.confidence, matchMethod: c.matchMethod, selected: i === 0,
          })),
          target,
          title: '匹配度不足',
          description: `"${target}"与"${top.title}"的匹配度不够高，请确认或选择其他列`,
        };
      }
    }

    return null;
  }

  static buildPreviewPlan(
    intent: TaskIntent,
    mainFileRows: number,
    taskFileCount: number
  ): ExecutionPlanPreview {
    const labels: Record<string, string> = {
      sort: '数据排序', filter: '数据筛选', sum: '数据求和',
      dedup: '数据去重', match: '多表匹配', merge: '多表合并', clean: '数据清洗',
      select: '列选择', remove: '删除列',
    };
    const targetCols = intent.resolvedColumns ?? intent.targetColumns;
    return {
      operationLabel: intent.operation ? labels[intent.operation] || intent.operation : '数据处理',
      operation: intent.operation || '',
      target: intent.target || '',
      primaryColumn: targetCols[0]
        ? { key: targetCols[0].key, title: targetCols[0].title, confidence: targetCols[0].confidence }
        : null,
      targetFiles: intent.targetFiles,
      isDangerous: intent.operation === 'dedup',
    };
  }
}
