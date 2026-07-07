// ============================================================
// Repair Report — 修复报告构建器
// ============================================================
// 职责：将 RepairRecord[] 聚合为可读的 RepairReport
// ============================================================

import type { RepairRecord, RepairReport } from './repair-types';

/**
 * 构建修复报告
 */
export function buildRepairReport(repairs: RepairRecord[]): RepairReport {
  const successCount = repairs.filter(
    (r) => r.category === 'auto' && r.confidence >= 0.5,
  ).length;
  const failCount = repairs.filter(
    (r) => r.confidence < 0.5 || r.category === 'suggest',
  ).length;

  const summary = buildSummary(repairs, successCount, failCount);

  return {
    repairs,
    successCount,
    failCount,
    summary,
  };
}

function buildSummary(
  repairs: RepairRecord[],
  successCount: number,
  failCount: number,
): string {
  if (repairs.length === 0) {
    return '无需修复';
  }

  const parts: string[] = [];
  const actionCounts = new Map<string, number>();
  for (const r of repairs) {
    const key = repairActionLabel(r.action);
    actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
  }

  for (const [action, count] of actionCounts) {
    parts.push(`${count} 个${action}`);
  }

  const autoStr = successCount > 0 ? `${successCount} 项已自动修复` : '';
  const suggestStr = failCount > 0 ? `${failCount} 项需确认` : '';
  const status = [autoStr, suggestStr].filter(Boolean).join('，');

  return `发现 ${repairs.length} 个问题：${parts.join('、')}（${status}）`;
}

function repairActionLabel(action: string): string {
  const labels: Record<string, string> = {
    COLUMN_FUZZY_MATCH: '列名模糊匹配',
    VALUE_TO_COLUMN: '值→列反推',
    VALUE_NORMALIZE: '值规范化',
    TYPE_CONVERT: '类型转换',
    JOIN_KEY_MAP: 'Join 映射',
    FORMULA_PARSE: '公式解析',
    NULL_HANDLE: '空值处理',
    COLUMN_INFER: '列推断',
  };
  return labels[action] || action;
}

/**
 * 格式化修复报告为结构化文本
 */
export function formatRepairReport(report: RepairReport): string {
  if (report.repairs.length === 0) return '无需修复';

  const lines: string[] = [report.summary, ''];

  for (const r of report.repairs) {
    const tag = r.category === 'auto' ? '✓ 自动修复' : '○ 需确认';
    lines.push(`${tag} [${(r.confidence * 100).toFixed(0)}%] ${r.detail}`);

    // 展示原始→修复的变更
    if (r.original !== r.repaired) {
      const origStr = typeof r.original === 'string' ? r.original : JSON.stringify(r.original);
      const repStr = typeof r.repaired === 'string' ? r.repaired : JSON.stringify(r.repaired);
      if (origStr !== repStr) {
        lines.push(`  ${origStr} → ${repStr}`);
      }
    }
  }

  lines.push('', `总结：${report.successCount} 项自动修复，${report.failCount} 项需确认`);
  return lines.join('\n');
}
