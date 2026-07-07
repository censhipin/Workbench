// ============================================================
// Explain Types — 智能解释层统一类型定义
// ============================================================
// ExecutionExplanation 是整个系统展示给用户的唯一解释格式
// ============================================================

import type { ExecutionPlan } from '../../v2/execution-plan';
import type { DataProfile } from '../profile/types';
import type { RepairReport } from '../repair/repair-types';
import type { ExecutionResult, VerificationReport } from '../../execution-engine';

/** 统一解释输出 — UI 永远只读取这个 */
export interface ExecutionExplanation {
  /** 一句话标题，如"成功完成筛选"、"执行失败" */
  title: string;

  /** 总体总结，如"共处理 12000 行，保留 2350 行" */
  summary: string;

  /** 详细过程说明，每行一个要点 */
  detail: string[];

  /** 人类可读的警告 */
  warnings: string[];

  /** 可操作建议 */
  suggestions: string[];

  /** 自动修复摘要 */
  autoFixSummary: string[];
}

/** Builder 输入 — 聚合整个执行链路上下文 */
export interface ExplainInput {
  plan: ExecutionPlan | null | undefined;
  profile: DataProfile | null | undefined;
  repairReport: RepairReport | null | undefined;
  executionResult: ExecutionResult | null | undefined;
  verificationReport: VerificationReport | null | undefined;
  error: string | null | undefined;
  operationLabel: string;
  groupBy?: string[];
  aggregation?: string;
}

/** Join 匹配统计 */
export interface JoinStatistics {
  leftRows: number;
  rightRows: number;
  matched: number;
  unmatched: number;
  duplicateMatches: number;
  matchRate: number;
}

/** 建议类型 */
export interface ExplainSuggestion {
  category: 'column' | 'value' | 'type' | 'operation' | 'data';
  message: string;
  priority: 'high' | 'medium' | 'low';
}
