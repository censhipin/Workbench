// ============================================================
// Value Repair — 值规范化
// ============================================================
// 职责：所有字符串比较前的统一规范化
//
// 所有比较路径（Filter/Join/Update/Aggregate）都应使用规范化后的值
// ============================================================

/** 值规范化选项 */
export interface NormalizeOptions {
  trim?: boolean;
  fullwidth?: boolean;
  unicodeNF?: boolean;
  collapseWhitespace?: boolean;
  lowercase?: boolean;
}

const DEFAULT_OPTIONS: Required<NormalizeOptions> = {
  trim: true,
  fullwidth: true,
  unicodeNF: true,
  collapseWhitespace: true,
  lowercase: true,
};

/**
 * 规范化字符串
 *
 * " 杭州 " → "杭州"
 * "杭州　" → "杭州"  (全角空格)
 * "Ｈｅｌｌｏ" → "hello"
 * "Hangzhou" → "hangzhou"
 * "Hello  World" → "hello world"
 */
export function normalizeValue(
  value: string,
  options: NormalizeOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let result = value;

  if (opts.unicodeNF) {
    result = result.normalize('NFKC');
  }

  if (opts.fullwidth) {
    result = fullwidthToHalfwidth(result);
  }

  if (opts.trim) {
    result = result.trim();
  }

  if (opts.collapseWhitespace) {
    result = result.replace(/[\s　]+/g, ' ');
  }

  if (opts.lowercase) {
    result = result.toLowerCase();
  }

  return result;
}

/**
 * 全角字符 → 半角
 * 涵盖：字母、数字、符号、空格
 */
function fullwidthToHalfwidth(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0x3000) {
      // 全角空格 → 半角空格
      result += ' ';
    } else if (code >= 0xff01 && code <= 0xff5e) {
      // 全角字母/数字/符号 → 半角
      result += String.fromCharCode(code - 0xfee0);
    } else {
      result += str[i];
    }
  }
  return result;
}

/**
 * 规范化后比较两个值是否相等
 * 非字符串值直接 === 比较
 */
export function valuesAreEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return normalizeValue(a) === normalizeValue(b);
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  return String(a) === String(b);
}

/**
 * 计算两个字符串的 Levenshtein 距离
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bn; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[an][bn];
}

/**
 * 值相似度评分 (0~1)
 * 基于 Levenshtein 距离的正则化
 * 1.0 = 完全相等, 0.0 = 完全不同
 */
export function valueSimilarity(a: string, b: string): number {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);

  if (normA === normB) return 1.0;
  if (normA.length === 0 && normB.length === 0) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(normA, normB);
  return 1 - dist / maxLen;
}

/**
 * Dice 系数相似度（用于 Token 级别匹配）
 */
export function diceSimilarity(a: string, b: string): number {
  const normA = normalizeValue(a);
  const normB = normalizeValue(b);

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1.0;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0.0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2));
  }
  return bigrams;
}
