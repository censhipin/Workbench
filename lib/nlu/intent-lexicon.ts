// ============================================================
// Intent Lexicon — 操作意图词典
// ============================================================
// 职责：定义所有支持的操作及其同义词映射
// 设计：可配置化，支持 JSON 导入导出，便于后续扩展
// ============================================================

import type { LexiconEntry, IntentLexiconConfig } from './types';

/* =========================== 内置词典 =========================== */

/**
 * 核心操作词典
 * 每个操作为 canonical 加入其所有同义词变体
 */
const DEFAULT_ENTRIES: LexiconEntry[] = [
  // ---- 求和 ----
  {
    operation: 'sum',
    synonyms: [
      '求和', '求总和', '求一下总和', '总和',
      '统计', '统计一下', '统计出',
      '汇总', '汇总一下', '累计', '累计一下', '累加',
      '总计', '合计',
      '算一下', '算个总数', '算一算',
      '全部加起来', '加起来',
      '一共多少', '总共有多少', '一共',
      '总数', '总额', '总共',
    ],
    description: '对指定数值列求和',
  },

  // ---- 排序 ----
  {
    operation: 'sort',
    synonyms: [
      '排序', '排一下', '排个序', '排列', '排一排',
      '从大到小', '从小到大',
      '升序', '降序',
      '按顺序', '整理',
    ],
    description: '按指定列排序',
  },

  // ---- 筛选 ----
  {
    operation: 'filter',
    synonyms: [
      '筛选', '筛选出',
      '过滤', '过滤出',
      '只要',
      '找出', '找到',
      '符合', '满足',
      '查一下', '查询', '查看',
    ],
    description: '按条件筛选数据行',
  },

  // ---- 去重 ----
  {
    operation: 'dedup',
    synonyms: [
      '去重', '去一下重', '去重复',
      '删除重复', '移除重复', '去掉重复',
      '重复删除', '去除重复',
      '去重一下',
    ],
    description: '删除重复数据行',
  },

  // ---- 匹配 ----
  {
    operation: 'match',
    synonyms: [
      '匹配', '匹配一下',
      '关联', '关联起来', '对应起来',
      '对应', '对齐',
      'VLOOKUP', 'vlookup',
    ],
    description: '按关键字段匹配合并多个表',
  },

  // ---- 合并 ----
  {
    operation: 'merge',
    synonyms: [
      '合并', '合并一下',
      '拼接', '拼接起来',
      '组合', '整合',
      '拼到一起', '合到一起',
    ],
    description: '纵向合并多个表',
  },

  // ---- 清洗 ----
  {
    operation: 'clean',
    synonyms: [
      '清洗', '清洗一下',
      '清理', '清理一下',
      '清除空白', '清除异常',
      '修复', '修正', '修复一下',
      '净化', '整理数据',
    ],
    description: '清洗数据（移除空行、修复异常值）',
  },

  // ---- 更新/填充 ----
  {
    operation: 'update',
    synonyms: [
      '填充', '填上', '填入', '填为', '填写',
      '修改', '改为', '改成', '设置', '设为',
      '更新', '更新为', '替换', '替换为', '替换成',
      '全部改成', '都改成', '全部改为', '都改为',
      '批量修改', '批量更新', '批量替换',
    ],
    description: '批量修改/填充列值',
  },

  // ---- 公式/计算 ----
  // 注意：不要在这里放常见列名（金额、利润、合计等），
  // 否则会导致 "按产品统计金额总和" 被误判为 formula。
  // formula 检测由 detectFormula() 的关键词检测 + = 号检测独立完成。
  {
    operation: 'formula',
    synonyms: [
      '计算出', '算出来', '计算',
      '新增列', '添加列', '增加列', '新列',
      '乘以', '除以', '加上', '减去',
      '加起来',
      '保留', '四舍五入', '取整',
      '绝对值',
    ],
    description: '公式计算新增列',
  },
];

/* =========================== 词典管理 =========================== */

export class IntentLexicon {
  private entryMap: Map<string, LexiconEntry>;
  /** 反向索引：同义词 → canonical operation */
  private reverseIndex: Map<string, string>;

  constructor(entries?: LexiconEntry[]) {
    this.entryMap = new Map();
    this.reverseIndex = new Map();
    this.load(entries ?? DEFAULT_ENTRIES);
  }

  /** 加载词典条目 */
  load(entries: LexiconEntry[]): void {
    for (const entry of entries) {
      this.entryMap.set(entry.operation, entry);
      for (const syn of entry.synonyms) {
        // 短同义词不参与反向索引（避免误匹配）
        if (syn.length >= 2) {
          this.reverseIndex.set(syn, entry.operation);
        }
      }
    }
  }

  /** 从可配置的 JSON 对象加载 */
  loadConfig(config: IntentLexiconConfig): void {
    this.load(config.entries);
  }

  /** 获取所有 canonical operation */
  getOperations(): string[] {
    return Array.from(this.entryMap.keys());
  }

  /** 获取某个操作的所有同义词 */
  getSynonyms(operation: string): string[] {
    return this.entryMap.get(operation)?.synonyms ?? [];
  }

  /** 查询单个词对应的 canonical operation */
  lookup(word: string): string | null {
    return this.reverseIndex.get(word) ?? null;
  }

  /** 从一组关键词中识别操作 */
  identifyOperation(keywords: string[]): { operation: string | null; matchWord: string | null; confidence: number } {
    if (keywords.length === 0) {
      return { operation: null, matchWord: null, confidence: 0 };
    }

    const scores = new Map<string, { matchWord: string; score: number }>();

    for (const keyword of keywords) {
      const op = this.reverseIndex.get(keyword);
      if (op) {
        const prev = scores.get(op);
        // 多个同义词命中时累积分数，鼓励长词匹配
        const increment = Math.min(1, keyword.length / 4);
        const newScore = (prev?.score ?? 0) + increment;
        scores.set(op, { matchWord: keyword, score: newScore });
      }
    }

    if (scores.size === 0) {
      return { operation: null, matchWord: null, confidence: 0 };
    }

    // 按分数降序排列
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);
    const top = sorted[0][1];

    // 置信度 = 实际分数 / 理论最大单次匹配分数
    const confidence = Math.min(1, top.score / 1.5);

    return { operation: sorted[0][0], matchWord: top.matchWord, confidence };
  }

  /** 获取词典配置（可用于序列化/导出） */
  toConfig(): IntentLexiconConfig {
    return {
      entries: Array.from(this.entryMap.values()),
    };
  }
}

/** 默认单例 */
export const defaultLexicon = new IntentLexicon();
