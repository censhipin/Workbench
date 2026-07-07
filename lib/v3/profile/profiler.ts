// ============================================================
// Profiler — 数据画像主入口
// ============================================================
// 职责：在 Executor 执行前生成 DataProfile
// 让系统"知道数据长什么样"再执行操作
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import { analyzeColumn } from './column-analyzer';
import { computeGlobalStats } from './stats';
import type { DataProfile, ProfileWarning } from './types';

/**
 * 构建数据画像
 *
 * 遍历每一列 → 调用 column analyzer → 汇总全局统计 → 输出 DataProfile
 */
export function buildDataProfile(
  columns: ColumnDef[],
  rows: RowData[],
): DataProfile {
  const columnProfiles = columns.map((col) => analyzeColumn(col, rows));
  const globalStats = computeGlobalStats(columnProfiles, rows);
  const warnings = generateWarnings(columnProfiles, globalStats);

  return {
    columns: columnProfiles,
    rowCount: rows.length,
    globalStats,
    warnings,
  };
}

/**
 * 生成画像警告
 */
function generateWarnings(
  columns: DataProfile['columns'],
  globalStats: DataProfile['globalStats'],
): ProfileWarning[] {
  const warnings: ProfileWarning[] = [];

  for (const col of columns) {
    // 空值过多
    if (col.nullRate > 0.3) {
      warnings.push({
        columnKey: col.columnKey,
        message: `"${col.title}" 列空值率 ${(col.nullRate * 100).toFixed(0)}%，可能导致结果异常`,
        severity: 'warning',
        code: 'PROFILE_HIGH_NULL_RATE',
      });
    } else if (col.nullRate > 0.1) {
      warnings.push({
        columnKey: col.columnKey,
        message: `"${col.title}" 列存在 ${col.nullCount} 个空值 (${(col.nullRate * 100).toFixed(0)}%)`,
        severity: 'info',
        code: 'PROFILE_NULL_EXISTS',
      });
    }

    // 类型可信度低
    if (col.confidence < 0.6) {
      warnings.push({
        columnKey: col.columnKey,
        message: `"${col.title}" 列类型推断可信度低 (${(col.confidence * 100).toFixed(0)}%)，包含混合类型数据`,
        severity: 'warning',
        code: 'PROFILE_LOW_TYPE_CONFIDENCE',
      });
    }

    // 声明类型 vs 推断类型不匹配
    const declared = col.declaredType === 'text' ? 'string' : col.declaredType;
    if (declared !== col.type && col.type !== 'unknown' && col.confidence >= 0.7) {
      warnings.push({
        columnKey: col.columnKey,
        message: `"${col.title}" 列声明类型为 ${col.declaredType}，但实际数据推断为 ${col.type} 类型`,
        severity: 'info',
        code: 'PROFILE_TYPE_MISMATCH',
      });
    }
  }

  // 整体重复行率
  if (globalStats.duplicateRowRate > 0.3) {
    warnings.push({
      columnKey: '*',
      message: `数据整体重复行率 ${(globalStats.duplicateRowRate * 100).toFixed(0)}%，包含大量重复数据`,
      severity: 'warning',
      code: 'PROFILE_HIGH_DUPLICATE_RATE',
    });
  }

  // 整体空值率
  if (globalStats.nullRate > 0.2) {
    warnings.push({
      columnKey: '*',
      message: `数据整体空值率 ${(globalStats.nullRate * 100).toFixed(0)}%，数据质量较低`,
      severity: 'warning',
      code: 'PROFILE_HIGH_GLOBAL_NULL_RATE',
    });
  }

  return warnings;
}
