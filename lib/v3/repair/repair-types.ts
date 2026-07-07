// ============================================================
// EIC Repair — 共享类型定义
// ============================================================
// 所有修复模块共享的类型，无外部依赖（除基础 TypeScript）
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { DataProfile } from '../profile/types';

/** 修复操作类型 */
export type RepairAction =
  | 'COLUMN_FUZZY_MATCH'
  | 'VALUE_TO_COLUMN'
  | 'VALUE_NORMALIZE'
  | 'TYPE_CONVERT'
  | 'JOIN_KEY_MAP'
  | 'FORMULA_PARSE'
  | 'NULL_HANDLE'
  | 'COLUMN_INFER';

/** 单条修复记录 */
export interface RepairRecord {
  action: RepairAction;
  target: string;
  original: unknown;
  repaired: unknown;
  confidence: number;
  category: 'auto' | 'suggest';
  detail: string;
}

/** 修复报告 */
export interface RepairReport {
  repairs: RepairRecord[];
  successCount: number;
  failCount: number;
  summary: string;
}

/** 枚举列的值统计（用于值→列反推） */
export interface ColumnValueIndex {
  columnKey: string;
  columnTitle: string;
  uniqueValues: Set<string>;
  valueMap: Map<string, string>;
}

/** 修复编排上下文 */
export interface RepairContext {
  columns: ColumnDef[];
  rows: RowData[];
  profile: DataProfile;
  columnIndex: ColumnValueIndex[];
  allFiles?: { name: string; columns: ColumnDef[]; rows: RowData[] }[];
}

/** 修复编排选项 */
export interface RepairOptions {
  columnRepair?: boolean;
  valueRepair?: boolean;
  typeRepair?: boolean;
  joinRepair?: boolean;
  formulaRepair?: boolean;
  nullRepair?: boolean;
  confidenceThreshold?: number;
}

/** 修复编排结果 */
export interface RepairResult {
  plan: import('../../v2/execution-plan').ExecutionPlan;
  report: RepairReport;
  autoFixApplied: boolean;
}

/** EIC 上下文 — 贯穿执行链的统一结构 */
export interface EICContext {
  profile: DataProfile | null;
  repairResult: RepairResult | null;
  repairedPlan: import('../../v2/execution-plan').ExecutionPlan | null;
}
