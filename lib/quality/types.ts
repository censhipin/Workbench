// ============================================================
// 数据质量模块核心类型定义
// ============================================================

/** 异常严重等级 */
export type Severity = 'critical' | 'error' | 'warning' | 'suggestion';

/** 异常来源层级 */
export type AnomalyLayer = 'rule' | 'inference' | 'business';

/** 统一异常结构 */
export interface Anomaly {
  id: string;
  severity: Severity;
  layer: AnomalyLayer;
  columnKey?: string;
  columnTitle?: string;
  rowIndex?: number;
  title: string;
  detail: string;
  originalValue?: string;
  suggestedValue?: string;
  canAutoFix: boolean;
  ruleId?: string;
}

/** 列类型注册项 — 只包含校验和修复逻辑，不包含推断逻辑 */
export interface ColumnType {
  id: string;
  name: string;
  category: 'string' | 'numeric' | 'date' | 'boolean';
  description?: string;
  validate: (value: string) => { valid: boolean; severity?: Severity; message?: string };
  autoFix?: (value: string) => string;
}

/** 推断结果 */
export interface InferenceResult {
  columnKey: string;
  columnTitle: string;
  typeId: string | null;
  typeName: string;
  confidence: number;
}

/** 业务规则模板 */
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  expression?: string;
  enabled: boolean;
}

/** 规则映射缓存 */
export interface RuleMapping {
  ruleId: string;
  fieldMappings: Record<string, string>;
}

/** 质量检测报告（简化版） */
export interface QualityReport {
  anomalies: Anomaly[];
  inferences: InferenceResult[];
}
