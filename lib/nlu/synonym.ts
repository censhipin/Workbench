// ============================================================
// Synonym Registry — 可配置的同义词注册表
// ============================================================
// 职责：
//   - 管理同义词 ↔ canonical 映射
//   - 支持运行时动态注册/注销
//   - 支持批量配置化加载（JSON）
//   - 解耦：intent-lexicon 使用此注册表
// ============================================================

import type { SynonymEntry } from './types';

export class SynonymRegistry {
  /** canonical → 所有同义词 */
  private forward: Map<string, Set<string>>;
  /** 同义词 → canonical */
  private reverse: Map<string, string>;

  constructor(entries?: SynonymEntry[]) {
    this.forward = new Map();
    this.reverse = new Map();
    if (entries) {
      this.load(entries);
    }
  }

  /** 注册一组同义词映射 */
  register(canonical: string, variants: string[]): void {
    if (!this.forward.has(canonical)) {
      this.forward.set(canonical, new Set());
    }
    const set = this.forward.get(canonical)!;
    for (const variant of variants) {
      set.add(variant);
      this.reverse.set(variant, canonical);
    }
  }

  /** 批量加载 */
  load(entries: SynonymEntry[]): void {
    for (const entry of entries) {
      this.register(entry.canonical, entry.variants);
    }
  }

  /** 取消注册一组同义词 */
  unregister(canonical: string): void {
    const set = this.forward.get(canonical);
    if (set) {
      for (const variant of set) {
        this.reverse.delete(variant);
      }
      this.forward.delete(canonical);
    }
  }

  /** 查询同义词对应的 canonical */
  lookup(word: string): string | null {
    return this.reverse.get(word) ?? null;
  }

  /** 获取某个 canonical 的所有同义词 */
  getVariants(canonical: string): string[] {
    return Array.from(this.forward.get(canonical) ?? []);
  }

  /** 获取所有注册的 canonical */
  getAll(): string[] {
    return Array.from(this.forward.keys());
  }

  /** 清除所有 */
  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }

  /** 导出配置 */
  toEntries(): SynonymEntry[] {
    return Array.from(this.forward.entries()).map(
      ([canonical, variants]) => ({ canonical, variants: Array.from(variants) })
    );
  }
}

/** 默认全局同义词注册表 */
export const defaultSynonymRegistry = new SynonymRegistry();
