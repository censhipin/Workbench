// ============================================================
// 数据质量模块统一入口
// ============================================================

import type { ColumnDef, RowData } from '../types';
import type { QualityReport } from './types';
import { runGeneralDetection } from './rules';
import { matchAndRunRules } from './biz-rules';

export * from './types';
export * from './column-types';
export * from './inference';
export * from './rules';
export * from './biz-rules';

/**
 * 全量质量检测入口
 * 规则检测 + 类型推断校验 + 业务规则
 */
export function runQualityCheck(
  rows: RowData[],
  columns: ColumnDef[],
  _fileName?: string,
  _sheetName?: string,
): QualityReport {
  // 第一层 + 第二层
  const { anomalies: ruleAnomalies, inferences } = runGeneralDetection(rows, columns);

  // 第三层：业务规则
  const { anomalies: bizAnomalies } = matchAndRunRules(rows, columns);

  return {
    anomalies: [...ruleAnomalies, ...bizAnomalies],
    inferences,
  };
}
