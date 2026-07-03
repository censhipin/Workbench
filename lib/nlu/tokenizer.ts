// ============================================================
// Tokenizer — 中文分词（基于词典的最长匹配）
// ============================================================
// 职责：将用户输入的原始文本分词，去停用词，提取关键词
// 策略：最长优先匹配已知词表，剩余单字按需分组
// ============================================================

import type { Token, TokenizedPrompt } from './types';

/* =========================== 停用词表 =========================== */

const STOP_WORDS = new Set([
  // 语气/助词
  '的', '了', '是', '在', '把', '被', '将', '就', '都', '也', '还',
  '对', '给', '让', '从', '到', '和', '与', '或', '跟',
  '这', '那', '哪', '它', '他', '她', '们',
  '什么', '怎么', '如何', '哪些', '那些', '这些',
  '一个', '一些', '一下', '这个', '那个', '哪个',
  '看看', '想要', '需要', '可以', '能', '会', '应该', '必须', '可能',
  '已经', '正在', '通过', '进行', '做', '弄', '搞',
  // 礼貌用语
  '帮', '请', '麻烦', '帮忙', '帮我', '您好', '你好',
  '谢谢', '感谢', '请帮我',
  // 标点符号（中文 + 英文）
  '，', '。', '？', '！', '、', '；', '：', '…',
  ',', '.', '?', '!', ';', ':', '(', ')', '（', '）',
  ' ', '\t', '\n', '\r',
  // 常见前缀
  '把', '将', '对', '按', '根据', '按照', '依照',
]);

/** 判断是否为停用词 */
export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(word);
}

/* =========================== 核心分词函数 =========================== */

/**
 * 中文分词 - 基于已知词表的最长优先匹配
 * @param prompt 用户原始输入
 * @param extraLexicon 额外的自定义词表（如列名）
 * @returns 结构化分词结果
 */
export function tokenize(prompt: string, extraLexicon: string[] = []): TokenizedPrompt {
  if (!prompt.trim()) {
    return { original: prompt, tokens: [], keywords: [], operationHints: [] };
  }

  // 合并已知词表：操作词 + 停用词 + 外部传入词（如列名）
  // 按长度降序排列保证最长匹配优先
  const knownTerms = buildTermSet(extraLexicon);
  const tokens = tokenizeGreedy(prompt, knownTerms);

  const keywords = tokens
    .filter(t => !t.isStopWord && t.text.trim().length > 0)
    .map(t => t.text);

  const operationHints = tokens
    .filter(t => t.isOperation)
    .map(t => t.text);

  return { original: prompt, tokens, keywords, operationHints };
}

/* =========================== 内部实现 =========================== */

/** 构建分词用词表 */
function buildTermSet(extraLexicon: string[]): TermInfo[] {
  const allTerms = new Map<string, boolean>();

  // 停用词全部标记为 isStopWord
  for (const w of STOP_WORDS) {
    allTerms.set(w, true);
  }

  // 额外词（如列名）也纳入词表
  for (const w of extraLexicon) {
    if (w.length >= 2 && !allTerms.has(w)) {
      allTerms.set(w, false);
    }
  }

  return Array.from(allTerms.entries())
    .map(([text, isStopWord]) => ({ text, isStopWord }))
    .sort((a, b) => b.text.length - a.text.length);
}

interface TermInfo {
  text: string;
  isStopWord: boolean;
}

/** 贪心最长匹配分词 */
function tokenizeGreedy(prompt: string, terms: TermInfo[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < prompt.length) {
    let matched = false;

    // 先尝试匹配已知词表中的最长词
    for (const term of terms) {
      if (prompt.slice(i, i + term.text.length) === term.text) {
        tokens.push({
          text: term.text,
          isStopWord: term.isStopWord,
          isOperation: false, // 由 intent-parser 阶段识别
        });
        i += term.text.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 未匹配 → 尝试向左合并未知字符形成词组
      const start = i;
      while (i < prompt.length) {
        const char = prompt[i];

        // 检查当前字符是否是已知词的开头
        const isStartOfKnown = terms.some(t => prompt.startsWith(t.text, i));
        if (isStartOfKnown && i > start) break;
        if (isStartOfKnown) { i++; break; }

        // 标点或空格作为分隔符
        if (/^[\s,，、.。?？!！;；:：()（）]$/.test(char) && i > start) break;
        if (/^[\s,，、.。?？!！;；:：()（）]$/.test(char)) { i++; break; }

        i++;
      }

      const text = prompt.slice(start, i);
      if (text) {
        tokens.push({
          text,
          isStopWord: text.length === 1 && STOP_WORDS.has(text),
          isOperation: false,
        });
      }
    }
  }

  return tokens;
}
