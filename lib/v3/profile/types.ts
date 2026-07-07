// ============================================================
// EIC Profile — 数据画像类型定义
// ============================================================

import type { ColumnDef } from '../../types';

/** 列画像 */
export interface ColumnProfile {
  columnKey: string;
  title: string;

  /** 推断的类型 */
  type: 'number' | 'string' | 'date' | 'unknown';

  /** 声明类型（来自 ColumnDef） */
  declaredType: 'text' | 'number' | 'date';

  nullCount: number;
  nullRate: number;

  uniqueCount: number;
  uniqueRate: number;

  /** 数值列的范围 */
  min?: number;
  max?: number;
  avg?: number;

  /** 样本值（最多 5 个） */
  sampleValues: unknown[];

  /** 类型可信度 0~1 */
  confidence: number;
}

/** 全局统计 */
export interface GlobalStats {
  totalNullCells: number;
  nullRate: number;
  duplicateRowRate: number;
}

/** 警告 */
export interface ProfileWarning {
  columnKey: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
}

/** 数据画像 — 执行前生成 */
export interface DataProfile {
  columns: ColumnProfile[];
  rowCount: number;
  globalStats: GlobalStats;
  warnings: ProfileWarning[];
}
