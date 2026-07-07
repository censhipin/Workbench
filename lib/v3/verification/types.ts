// ============================================================
// Verification Types — V3 验证层统一类型定义
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';

/** 单条验证检查结果 */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
  /** 可选：置信度 0~1 */
  confidence?: number;
}

/** 整体验证结果 */
export interface VerificationResult {
  /** 是否通过 */
  passed: boolean;
  /** 整体验证置信度 0~1 */
  confidence: number;
  /** 逐条检查 */
  checks: VerificationCheck[];
  /** 操作统计 */
  stats?: OperationStats;
  /** 差异摘要 */
  diff?: DiffSummary;
}

/** 操作统计（每种操作共用的统计字段） */
export interface OperationStats {
  rowCount: number;
  columnCount: number;
  inputRowCount?: number;
  outputRowCount?: number;
  nullCount?: number;
  duplicateCount?: number;
  uniqueCount?: number;
  /** Filter */
  removedCount?: number;
  removedPct?: number;
  /** Aggregate */
  groupCount?: number;
  aggColumnCount?: number;
  /** Match */
  matchCount?: number;
  unmatchedCount?: number;
  matchRate?: number;
  leftTableRows?: number;
  rightTableRows?: number;
  /** Formula */
  formulaAttempted?: number;
  formulaFailed?: number;
  /** Update */
  modifiedCount?: number;
  unmodifiedCount?: number;
  /** Clean */
  deletedCount?: number;
  invalidCellCount?: number;
  /** Dedup */
  dedupRemoved?: number;
}

/** 差异摘要 */
export interface DiffSummary {
  rowsAdded: number;
  rowsRemoved: number;
  rowsUpdated: number;
  columnsAdded: number;
  columnsRemoved: number;
  columnsRenamed: number;
}

/**
 * V3 Verifier 接口
 * 每个 Operation 一个实现
 */
export interface Verifier {
  readonly type: string;
  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult;
}

/** 验证引擎配置 */
export interface VerificationEngineConfig {
  /** 公式随机抽样数 */
  formulaSampleSize?: number;
  /** 匹配率警告阈值 */
  matchRateWarning?: number;
  /** 删除比例警告阈值 */
  removalWarningPct?: number;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationEngineConfig = {
  formulaSampleSize: 100,
  matchRateWarning: 0.8,
  removalWarningPct: 0.95,
};
