// ============================================================
// Schema Resolver — 表结构理解层
// ============================================================
// 职责：将语义目标（如"销售额"）映射到实际表结构中的列
//   - 概念匹配：语义概念 → 列名关键词注册表
//   - 列类型验证
//   - 多候选排序与评分
//   - 输出：SchemaResolution（候选列表 + 是否已明确 + 说明）
// ============================================================

import { ColumnDef } from '../types';
import {
  SchemaCandidate, SchemaResolution,
  ConceptPattern, DEFAULT_CONCEPT_REGISTRY
} from './types';

/* =========================== Schema Resolver =========================== */

export class SchemaResolver {
  private concepts: Map<string, ConceptPattern>;

  constructor(concepts?: ConceptPattern[]) {
    this.concepts = new Map();
    const registry = concepts ?? DEFAULT_CONCEPT_REGISTRY;
    for (const c of registry) {
      this.concepts.set(c.concept, c);
    }
  }

  /**
   * 注册或覆盖一个语义概念
   */
  registerConcept(concept: ConceptPattern): void {
    this.concepts.set(concept.concept, concept);
  }

  /**
   * 获取所有已注册的概念名
   */
  getConcepts(): string[] {
    return Array.from(this.concepts.keys());
  }

  /**
   * 解析语义目标到列候选
   *
   * @param target 语义目标（如"销售额"、"工资"）
   * @param columns 当前表的实际列定义
   * @returns SchemaResolution
   */
  resolve(target: string, columns: ColumnDef[]): SchemaResolution {
    if (!target || !columns.length) {
      return { target, candidates: [], isResolved: false, message: '无目标或可用列' };
    }

    const candidates: SchemaCandidate[] = [];

    // === Phase 1: 概念匹配（精确概念名） ===
    const concept = this.concepts.get(target);
    if (concept) {
      for (const col of columns) {
        const matchResult = this.matchColumnToConcept(col, concept);
        if (matchResult) candidates.push(matchResult);
      }
    }

    // === Phase 1b: 概念匹配（模糊——target 包含关键词或关键词包含 target） ===
    if (candidates.length === 0) {
      for (const [, pattern] of this.concepts) {
        const matched = pattern.columnKeywords.some(
          (kw) => target.includes(kw) || kw.includes(target) || target.includes(pattern.concept) || pattern.concept.includes(target)
        );
        if (matched) {
          for (const col of columns) {
            const matchResult = this.matchColumnToConcept(col, pattern);
            if (matchResult) {
              // 模糊匹配降权
              matchResult.confidence = Math.min(matchResult.confidence, 0.7);
              matchResult.reason = `模糊语义"${target}"→概念"${pattern.concept}"匹配列"${col.title}"`;
              candidates.push(matchResult);
            }
          }
        }
      }
    }

    // === Phase 2: 如果概念匹配没命中，做直接列名模糊匹配 ===
    if (candidates.length === 0) {
      for (const col of columns) {
        const score = this.fuzzyMatch(target, col.title);
        if (score >= 0.3) {
          candidates.push({
            key: col.key, title: col.title,
            confidence: score, matchMethod: 'fuzzy',
            reason: `列名"${col.title}"与目标"${target}"相似`,
          });
        }
      }
    }

    // 按置信度降序
    candidates.sort((a, b) => b.confidence - a.confidence);

    // === Phase 3: 判断是否明确 ===
    const isResolved = candidates.length === 1 && candidates[0].confidence >= 0.7;

    let message: string;
    if (candidates.length === 0) {
      message = `在当前表中未找到与"${target}"匹配的列`;
    } else if (isResolved) {
      message = `"${target}" → 列"${candidates[0].title}"（置信度 ${(candidates[0].confidence * 100).toFixed(0)}%）`;
    } else if (candidates.length === 1) {
      message = `"${target}" 可能匹配列"${candidates[0].title}"，但置信度较低（${(candidates[0].confidence * 100).toFixed(0)}%）`;
    } else {
      const topNames = candidates.slice(0, 3).map(c => c.title).join('、');
      message = `"${target}" 匹配到多个候选列：${topNames}${candidates.length > 3 ? '...' : ''}，请确认`;
    }

    return { target, candidates, isResolved, message };
  }

  /**
   * 将列与概念进行匹配
   */
  private matchColumnToConcept(col: ColumnDef, concept: ConceptPattern): SchemaCandidate | null {
    const colName = col.title.toLowerCase();
    let bestScore = 0;
    let bestKeyword = '';

    // 检查列名是否包含概念的关键词
    for (const keyword of concept.columnKeywords) {
      const kw = keyword.toLowerCase();

      // 精确包含
      if (colName === kw) {
        bestScore = Math.max(bestScore, 1.0);
        bestKeyword = keyword;
        continue;
      }

      // 列名包含关键词
      if (colName.includes(kw)) {
        const score = Math.min(0.92, 0.7 + kw.length / colName.length * 0.3);
        if (score > bestScore) { bestScore = score; bestKeyword = keyword; }
        continue;
      }

      // 关键词包含列名（反向）
      if (kw.includes(colName) && colName.length >= 2) {
        const score = Math.min(0.85, 0.5 + colName.length / kw.length * 0.4);
        if (score > bestScore) { bestScore = score; bestKeyword = keyword; }
        continue;
      }

      // 最长公共子串
      const common = longestCommonSubstring(colName, kw);
      if (common.length >= 2) {
        const score = Math.min(0.7, 0.3 + common.length / Math.max(colName.length, kw.length) * 0.4);
        if (score > bestScore) { bestScore = score; bestKeyword = keyword; }
      }
    }

    if (bestScore < 0.3) return null;

    // 类型检查惩罚
    if (concept.expectedType && concept.expectedType !== col.type) {
      bestScore *= 0.85;
    }

    return {
      key: col.key, title: col.title,
      confidence: Math.min(1, bestScore),
      matchMethod: 'semantic',
      reason: bestKeyword
        ? `语义"${concept.concept}"的关键词"${bestKeyword}"匹配列"${col.title}"`
        : `语义"${concept.concept}"匹配列"${col.title}"`,
    };
  }

  /**
   * 根据 columnHint 解析列
   * columnHint 是来自 DeepSeek TaskPlan 的列提示，
   * 可能是列名、列名的一部分、或者语义概念
   *
   * 策略：先精确匹配 → 模糊匹配 → 概念匹配
   */
  resolveByHint(hint: string, columns: ColumnDef[]): SchemaResolution {
    if (!hint || !columns.length) {
      return { target: hint, candidates: [], isResolved: false, message: '无提示或可用列' };
    }

    const candidates: SchemaCandidate[] = [];
    const lowerHint = hint.toLowerCase();

    for (const col of columns) {
      const colLower = col.title.toLowerCase();
      let bestScore = 0;
      let method: 'exact' | 'fuzzy' | 'semantic' = 'fuzzy';
      let reason = '';

      // Phase 1: 精确匹配
      if (colLower === lowerHint) {
        candidates.push({
          key: col.key, title: col.title,
          confidence: 1.0, matchMethod: 'exact',
          reason: `精确匹配列名"${col.title}"`,
        });
        continue;
      }

      // Phase 2: 列名包含 hint 或 hint 包含列名
      if (colLower.includes(lowerHint) && lowerHint.length >= 2) {
        const score = Math.min(0.92, 0.7 + lowerHint.length / colLower.length * 0.3);
        if (score > bestScore) { bestScore = score; reason = `列名包含"${hint}"`; }
      } else if (lowerHint.includes(colLower) && colLower.length >= 2) {
        const score = Math.min(0.85, 0.5 + colLower.length / lowerHint.length * 0.4);
        if (score > bestScore) { bestScore = score; reason = `提示包含列名"${col.title}"`; }
      }

      // Phase 3: 最长公共子串
      if (bestScore < 0.5) {
        const common = longestCommonSubstring(colLower, lowerHint);
        if (common.length >= 2) {
          const score = Math.min(0.7, 0.3 + common.length / Math.max(colLower.length, lowerHint.length) * 0.4);
          if (score > bestScore) { bestScore = score; reason = `公共子串"${common}"`; }
        }
      }

      // Phase 4: 概念匹配（如果上述都不够好）
      if (bestScore < 0.6) {
        for (const [conceptName, pattern] of this.concepts) {
          if (lowerHint === conceptName.toLowerCase() || pattern.columnKeywords.some(k => k.includes(hint) || hint.includes(k))) {
            const conceptResult = this.matchColumnToConcept(col, pattern);
            if (conceptResult && conceptResult.confidence > bestScore) {
              bestScore = conceptResult.confidence;
              method = 'semantic';
              reason = conceptResult.reason;
            }
          }
        }
      }

      if (bestScore >= 0.3) {
        candidates.push({
          key: col.key, title: col.title,
          confidence: Math.min(1, bestScore),
          matchMethod: method || 'fuzzy',
          reason,
        });
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const isResolved = candidates.length === 1 && candidates[0].confidence >= 0.7;

    let message: string;
    if (candidates.length === 0) {
      message = `未找到与"${hint}"匹配的列`;
    } else if (isResolved) {
      message = `"${hint}" → "${candidates[0].title}"（${(candidates[0].confidence * 100).toFixed(0)}%）`;
    } else if (candidates.length > 1) {
      const topNames = candidates.slice(0, 3).map(c => c.title).join('、');
      message = `"${hint}" 匹配到多个列：${topNames}${candidates.length > 3 ? '...' : ''}`;
    } else {
      message = `"${hint}" 低置信度匹配"${candidates[0].title}"`;
    }

    return { target: hint, candidates, isResolved, message };
  }

  /**
   * 直接模糊匹配（用于无概念注册时的后备）
   */
  private fuzzyMatch(target: string, colTitle: string): number {
    const t = target.toLowerCase();
    const c = colTitle.toLowerCase();
    if (c === t) return 1.0;
    if (c.includes(t) && t.length >= 2) return Math.min(0.85, t.length / c.length);
    if (t.includes(c) && c.length >= 2) return Math.min(0.8, c.length / t.length);
    const common = longestCommonSubstring(t, c);
    if (common.length >= 2) return Math.min(0.6, common.length / Math.max(t.length, c.length));
    return 0;
  }
}

/** 最长公共子串 */
function longestCommonSubstring(a: string, b: string): string {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  let maxLen = 0, endIdx = 0;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) { maxLen = dp[i][j]; endIdx = i; }
      }
    }
  }
  return a.slice(endIdx - maxLen, endIdx);
}

/** 默认 Schema Resolver 实例 */
export const defaultSchemaResolver = new SchemaResolver();
