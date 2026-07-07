// ============================================================
// Repair Summary — 修复结果翻译
// ============================================================
// 把 RepairReport 转换成人类可读的说明
// ============================================================

import type { RepairReport, RepairRecord } from '../repair/repair-types';

export function buildRepairSummary(repairReport: RepairReport | null): string[] {
  if (!repairReport || repairReport.repairs.length === 0) return [];

  const lines: string[] = [];

  // 按 action 分组显示
  const autoRepairs = repairReport.repairs.filter(r => r.category === 'auto');
  const suggestRepairs = repairReport.repairs.filter(r => r.category === 'suggest');

  if (autoRepairs.length > 0) {
    lines.push(`系统自动修复了 ${autoRepairs.length} 个问题：`);
    for (const r of autoRepairs) {
      lines.push(...formatRepairRecord(r));
    }
  }

  if (suggestRepairs.length > 0) {
    lines.push(`发现 ${suggestRepairs.length} 个待确认问题：`);
    for (const r of suggestRepairs) {
      lines.push(...formatRepairRecord(r));
    }
  }

  return lines;
}

function formatRepairRecord(r: RepairRecord): string[] {
  const confidence = (r.confidence * 100).toFixed(0);
  const lines: string[] = [];

  switch (r.action) {
    case 'COLUMN_FUZZY_MATCH':
      lines.push(`  • 列名「${r.original}」${r.category === 'auto' ? '修正' : '疑似'}为「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    case 'VALUE_TO_COLUMN':
      lines.push(`  • 值「${r.original}」反推为列「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    case 'VALUE_NORMALIZE':
      lines.push(`  • 值「${r.original}」${r.category === 'auto' ? '标准化' : '疑似标准化'}为「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    case 'TYPE_CONVERT':
      lines.push(`  • 将「${r.original}」转换为${r.repaired}类型（置信度 ${confidence}%）`);
      break;
    case 'JOIN_KEY_MAP':
      lines.push(`  • 匹配键「${r.original}」${r.category === 'auto' ? '映射' : '疑似映射'}为「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    case 'FORMULA_PARSE':
      lines.push(`  • 公式「${r.original}」${r.category === 'auto' ? '解析' : '疑似'}为「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    case 'NULL_HANDLE':
      lines.push(`  • 「${r.target}」列空值${r.category === 'auto' ? '已自动处理' : '建议处理'}（置信度 ${confidence}%）`);
      break;
    case 'COLUMN_INFER':
      lines.push(`  • 推断列「${r.original}」→「${r.repaired}」（置信度 ${confidence}%）`);
      break;
    default:
      lines.push(`  • ${r.detail}（${confidence}%）`);
  }

  return lines;
}
