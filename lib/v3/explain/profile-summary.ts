// ============================================================
// Profile Summary — 数据画像翻译
// ============================================================
// 把 DataProfile 转换成用户能理解的数据描述
// ============================================================

import type { DataProfile, ColumnProfile } from '../profile/types';

export function buildProfileDetails(profile: DataProfile | null): string[] {
  if (!profile) return [];

  const lines: string[] = [];

  lines.push(`数据概况：共 ${profile.rowCount} 行，${profile.columns.length} 列。`);

  if (profile.globalStats.nullRate > 0) {
    const nullPct = (profile.globalStats.nullRate * 100).toFixed(1);
    lines.push(`整体空值率 ${nullPct}%。`);
  }

  // 每列简要描述
  for (const col of profile.columns) {
    lines.push(...describeColumn(col, profile.rowCount));
  }

  return lines;
}

function describeColumn(col: ColumnProfile, totalRows: number): string[] {
  const lines: string[] = [];

  if (col.nullCount > 0) {
    const nullPct = (col.nullRate * 100).toFixed(0);
    lines.push(`「${col.title}」列共有 ${totalRows} 行，其中 ${col.nullCount} 行为空（${nullPct}%）。`);
  }

  if (col.type === 'number' && col.avg !== undefined) {
    lines.push(`「${col.title}」列数值范围 ${col.min} ~ ${col.max}，平均值 ${col.avg.toFixed(2)}。`);
  }

  if (col.uniqueRate !== undefined && col.uniqueRate < 0.1 && col.uniqueRate > 0) {
    lines.push(`「${col.title}」列重复值较多（唯一值率 ${(col.uniqueRate * 100).toFixed(0)}%），可能有大量重复数据。`);
  }

  return lines;
}
