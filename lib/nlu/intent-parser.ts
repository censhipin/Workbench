// ============================================================
// Intent Parser — 意图解析器
// ============================================================
// 职责：将用户原始文本解析为标准化 TaskIntent
//   - 分词 → 停用词过滤
//   - 操作识别（通过 intent-lexicon）
//   - 列名解析（精确 + 模糊匹配）
//   - 参数提取
//   - 输出：统一 TaskIntent
// ============================================================
// 设计：
//   当前为 RuleBasedIntentParser（基于规则）
//   以后可替换为 DeepSeekIntentParser / OpenAIIntentParser
//   接口不变：parse(prompt, availableColumns, fileNames) => TaskIntent
// ============================================================

import { ColumnDef, ColumnMatch, RowData } from '../types';
import { tokenize } from './tokenizer';
import { IntentLexicon } from './intent-lexicon';
import type { TaskIntent, Operation } from '../types';

/* =========================== IntentParser 接口 =========================== */

export interface IntentParser {
  parse(
    prompt: string,
    availableColumns: ColumnDef[],
    fileNames: string[]
  ): TaskIntent;
}

/* =========================== 基于规则的实现 =========================== */

export class RuleBasedIntentParser implements IntentParser {
  private lexicon: IntentLexicon;

  constructor(lexicon?: IntentLexicon) {
    this.lexicon = lexicon ?? new IntentLexicon();
  }

  parse(prompt: string, availableColumns: ColumnDef[], fileNames: string[]): TaskIntent {
    // Step 1: 分词 — 同时传入列名和操作同义词作为已知词表
    const columnTitles = availableColumns.map(c => c.title).filter(Boolean);
    const operationTerms = this.lexicon.getOperations()
      .flatMap(op => this.lexicon.getSynonyms(op))
      .filter(s => s.length >= 2);
    const extraLexicon = [...new Set([...columnTitles, ...operationTerms])];
    const tokenized = tokenize(prompt, extraLexicon);

    // Step 2: 识别操作
    const { operation: op, matchWord: _matchWord, confidence: opConfidence } =
      this.lexicon.identifyOperation(tokenized.keywords);

    // Step 3: 解析列名
    const targetColumns = resolveColumns(prompt, availableColumns);

    // Step 4: 提取参数
    const params = extractParams(prompt, op as Operation, targetColumns, availableColumns, tokenized);

    // Step 5: 综合置信度
    const confidence = op ? Math.min(1, (opConfidence + (targetColumns[0]?.confidence ?? 0.5)) / 1.5) : 0;

    return {
      operation: op as Operation,
      target: '',
      targetColumns,
      resolvedColumns: undefined,
      scope: 'all',
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      params,
      targetFiles: fileNames,
      rawPrompt: prompt,
      confidence,
    };
  }
}

/* =========================== 列名解析 =========================== */

/**
 * 从 prompt 中解析匹配的列
 * 保留原有 TaskIntentAnalyzer.resolveColumns 的所有逻辑
 */
function resolveColumns(prompt: string, columns: ColumnDef[]): ColumnMatch[] {
  const matches: ColumnMatch[] = [];

  for (const col of columns) {
    if (!col.title) continue;

    // 精确匹配
    if (prompt.includes(col.title)) {
      matches.push({ key: col.key, title: col.title, confidence: 1.0, matchMethod: 'exact' });
      continue;
    }

    // 模糊匹配
    const tokens = prompt.split(/[\s,，、和与按从到]+/).filter(Boolean);
    let bestScore = 0;

    for (const token of tokens) {
      if (token.length < 2) continue;

      // token 包含列名
      if (token.includes(col.title) && col.title.length >= 2) {
        const score = Math.min(0.9, col.title.length / token.length);
        bestScore = Math.max(bestScore, score);
      }

      // 列名包含 token
      if (col.title.includes(token) && token.length >= 2) {
        const score = Math.min(0.85, token.length / col.title.length);
        bestScore = Math.max(bestScore, score);
      }

      // 最长公共子串
      const common = longestCommonSubstring(token, col.title);
      if (common.length >= 2) {
        const score = Math.min(0.8, common.length / Math.max(token.length, col.title.length));
        bestScore = Math.max(bestScore, score);
      }
    }

    if (bestScore >= 0.3) {
      matches.push({ key: col.key, title: col.title, confidence: bestScore, matchMethod: 'fuzzy' });
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

/** 最长公共子串（用于模糊匹配评分） */
function longestCommonSubstring(a: string, b: string): string {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  let maxLen = 0, endIdx = 0;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIdx = i;
        }
      }
    }
  }
  return a.slice(endIdx - maxLen, endIdx);
}

/* =========================== 参数提取 =========================== */

/**
 * 从 prompt 中提取操作参数
 * 注意：sort/filter 等具体参数提取保持与原有逻辑兼容
 */
function extractParams(
  prompt: string,
  operation: Operation,
  targetColumns: ColumnMatch[],
  columns: ColumnDef[],
  _tokenized: { keywords: string[]; original: string }
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const primaryKey = targetColumns[0]?.key ?? null;

  if (operation === 'sort') {
    params.asc = Boolean(
      prompt.includes('升序') || prompt.includes('从低到高') || prompt.includes('从小到大')
    );
  }

  if (operation === 'filter') {
    const dateMatch = prompt.match(/(\d{4})年(\d{1,2})月/);
    if (dateMatch) {
      params.dateRange = {
        start: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-01`,
        end: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-31`,
      };
      params.operator = 'dateRange';
    } else {
      params.operator = prompt.includes('包含') ? 'contains' : 'eq';
      const cleaned = prompt.replace(/筛选|过滤|包含|等于|的/g, '').trim();
      params.filterValue = cleaned || '';
    }
  }

  if (operation === 'sum') {
    params.columnKey = primaryKey;
  }

  if (operation === 'dedup') {
    if (targetColumns.length > 0) {
      params.dedupKeys = targetColumns.map(c => c.key);
    }
  }

  if (operation === 'match') {
    const match = prompt.match(/按(.+?)匹配/);
    if (match) params.matchKeyHint = match[1].trim();
  }

  return params;
}
