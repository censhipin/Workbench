// ============================================================
// Performance Tracker — 性能统计
// ============================================================
import { logger } from './logger';

export interface PerfRecord {
  stage: string;
  label: string;
  durationMs: number;
  timestamp: string;
}

class PerfTracker {
  private records: PerfRecord[] = [];
  private marks: Map<string, number> = new Map();

  /** 标记开始时间 */
  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  /** 记录阶段耗时 */
  measure(stage: string, label: string, markName: string) {
    const start = this.marks.get(markName);
    if (start === undefined) {
      logger.warn(`PerfTracker: mark "${markName}" not found`);
      return;
    }
    const durationMs = Math.round(performance.now() - start);
    this.records.push({ stage, label, durationMs, timestamp: new Date().toISOString() });
    this.marks.delete(markName);
    logger.info(`[Perf] ${label}: ${durationMs}ms`);
  }

  /** 添加外部耗时记录 */
  addRecord(stage: string, label: string, durationMs: number) {
    this.records.push({ stage, label, durationMs, timestamp: new Date().toISOString() });
  }

  /** 获取所有记录 */
  getRecords(): PerfRecord[] {
    return [...this.records];
  }

  /** 计算总耗时 */
  getTotal(): number {
    return this.records.reduce((sum, r) => sum + r.durationMs, 0);
  }

  /** 按阶段分组统计 */
  getStageSummary(): { stage: string; label: string; count: number; totalMs: number; avgMs: number }[] {
    const grouped = new Map<string, { label: string; totalMs: number; count: number }>();
    for (const r of this.records) {
      const g = grouped.get(r.stage) || { label: r.label, totalMs: 0, count: 0 };
      g.totalMs += r.durationMs;
      g.count++;
      grouped.set(r.stage, g);
    }
    return Array.from(grouped.entries()).map(([stage, g]) => ({
      stage,
      label: g.label,
      count: g.count,
      totalMs: g.totalMs,
      avgMs: Math.round(g.totalMs / g.count),
    }));
  }

  /** 生成性能报告 */
  generateReport(): string {
    const summary = this.getStageSummary();
    const total = this.getTotal();
    const lines: string[] = [
      '# Performance Report',
      '',
      `Total: ${total}ms`,
      `Records: ${this.records.length}`,
      '',
      '## Stage Summary',
      '',
      '| Stage | Label | Count | Total (ms) | Avg (ms) | % of Total |',
      '|---|---|---|---|---|---|',
    ];
    for (const s of summary) {
      const pct = total > 0 ? ((s.totalMs / total) * 100).toFixed(1) : '0.0';
      lines.push(`| ${s.stage} | ${s.label} | ${s.count} | ${s.totalMs} | ${s.avgMs} | ${pct}% |`);
    }
    lines.push('', '---', '', `Generated: ${new Date().toISOString()}`);
    return lines.join('\n');
  }

  /** 重置 */
  reset() {
    this.records = [];
    this.marks.clear();
  }
}

export const perfTracker = new PerfTracker();
export type { PerfRecord as PerfRecordType };
