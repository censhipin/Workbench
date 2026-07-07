// ============================================================
// Type Repair — 类型转换修复
// ============================================================
// 职责：数字/日期/Boolean 格式统一，条件值类型自动修复
//
// 所有 Executor 不应自己转类型，全部交给 Repair
// ============================================================

import type { ColumnDef } from '../../types';
import type { DataProfile, ColumnProfile } from '../profile/types';
import type {
  ExecutionPlan,
  FilterPlan,
  UpdatePlan,
  FormulaPlan,
  PipelinePlan,
} from '../../v2/execution-plan';
import type { RepairRecord } from './repair-types';

/** 类型转换结果 */
export interface TypeConversionResult {
  converted: unknown;
  targetType: 'number' | 'string' | 'boolean' | 'date';
  confidence: number;
  warning?: string;
}

// ============================================================
// 数字解析
// ============================================================

/**
 * 解析数字格式
 *
 * "100" → 100 (confidence 1.0)
 * "100.0" → 100 (confidence 1.0)
 * "100元" → 100 (confidence 0.9)
 * "￥100" → 100 (confidence 0.9)
 * "¥100" → 100 (confidence 0.9)
 * "1,000" → 1000 (confidence 0.95)
 * "100%" → 1 (confidence 0.95)
 * "50％" → 0.5 (confidence 0.95)
 * "abc" → confidence 0
 */
export function parseNumeric(value: string): TypeConversionResult {
  if (value == null || value === '') {
    return { converted: value, targetType: 'number', confidence: 0 };
  }

  let trimmed = value.trim();

  // 去除前后的括号表示负数： (100) → -100
  const parenNegative = /^\((.+)\)$/.exec(trimmed);
  if (parenNegative) {
    const inner = parseNumeric(parenNegative[1]);
    if (inner.confidence > 0) {
      return { converted: -(inner.converted as number), targetType: 'number', confidence: inner.confidence };
    }
  }

  // 百分比处理
  const isPercent = /[％%]$/.test(trimmed);
  if (isPercent) {
    trimmed = trimmed.replace(/[％%]$/, '').trim();
    const base = tryParseNumber(trimmed);
    if (base !== null) {
      return { converted: base / 100, targetType: 'number', confidence: 0.95 };
    }
    return { converted: value, targetType: 'number', confidence: 0 };
  }

  // 去除货币前缀/后缀
  trimmed = trimmed.replace(/^[￥¥$€£]/, '');
  trimmed = trimmed.replace(/[元美元欧元英镑]$/, '');
  trimmed = trimmed.replace(/^[US]*D[^a-z]*/, ''); // USD, HKD

  // 去除千分位逗号（保留小数点）
  trimmed = trimmed.replace(/,/g, '');

  const result = tryParseNumber(trimmed);
  if (result !== null) {
    const hadPrefix = /^[￥¥$€£]/.test(value.trim());
    const hadSuffix = /[元美元]$/.test(value.trim());
    const hadComma = /,/.test(value);
    const confidence = hadPrefix || hadSuffix ? 0.9 : hadComma ? 0.95 : 1.0;
    return { converted: result, targetType: 'number', confidence };
  }

  return { converted: value, targetType: 'number', confidence: 0 };
}

function tryParseNumber(str: string): number | null {
  // 去除空格
  str = str.trim();
  if (str === '') return null;

  const n = Number(str);
  if (!isNaN(n) && isFinite(n)) return n;

  return null;
}

// ============================================================
// 日期解析
// ============================================================

/**
 * 解析日期字符串为统一格式 YYYY-MM-DD
 *
 * "2024/1/1" → "2024-01-01"
 * "2024-01-01" → "2024-01-01"
 * "2024年1月1日" → "2024-01-01"
 * "01/01/2024" → "2024-01-01"
 * "2024.1.1" → "2024-01-01"
 */
export function parseDate(value: string): TypeConversionResult {
  if (value == null || value === '') {
    return { converted: value, targetType: 'date', confidence: 0 };
  }

  const trimmed = value.trim();

  // Excel 序列号
  const serialNum = Number(trimmed);
  if (!isNaN(serialNum) && serialNum > 59 && serialNum < 2_000_000) {
    // 粗略转换（精确需 Excel 基准日，此处只标记为日期）
    return { converted: trimmed, targetType: 'date', confidence: 0.7, warning: 'Excel 序列号格式' };
  }

  // YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY年MM月DD日
  const datePatterns: Array<{ regex: RegExp; format: (m: RegExpMatchArray) => string }> = [
    { regex: /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, format: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, format: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/, format: (m) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
    { regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/, format: (m) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{4})(\d{2})(\d{2})$/, format: (m) => `${m[1]}-${m[2]}-${m[3]}` },
  ];

  for (const { regex, format } of datePatterns) {
    const match = trimmed.match(regex);
    if (match) {
      const formatted = format(match);
      // 验证是否为有效日期
      const d = new Date(formatted);
      if (!isNaN(d.getTime())) {
        return { converted: formatted, targetType: 'date', confidence: 0.95 };
      }
    }
  }

  // Date.parse fallback
  const ts = Date.parse(trimmed.replace(/\s+/g, ' '));
  if (!isNaN(ts)) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { converted: `${y}-${m}-${day}`, targetType: 'date', confidence: 0.8 };
  }

  return { converted: value, targetType: 'date', confidence: 0 };
}

// ============================================================
// Boolean 解析
// ============================================================

const BOOLEAN_TRUE_VALUES = new Set(['是', 'true', 'yes', 'y', 't', '1', '对', '正确', '通过', '完成', '成功']);
const BOOLEAN_FALSE_VALUES = new Set(['否', 'false', 'no', 'n', 'f', '0', '错', '错误', '不通过', '未完成', '失败']);

/**
 * Boolean 统一
 *
 * "是" / "true" / "1" / "Y" / "yes" → true
 * "否" / "false" / "0" / "N" / "no" → false
 */
export function parseBoolean(value: string): TypeConversionResult {
  if (value == null) {
    return { converted: value, targetType: 'boolean', confidence: 0 };
  }

  const trimmed = String(value).trim().toLowerCase();

  if (BOOLEAN_TRUE_VALUES.has(trimmed)) {
    return { converted: true, targetType: 'boolean', confidence: 0.95 };
  }

  if (BOOLEAN_FALSE_VALUES.has(trimmed)) {
    return { converted: false, targetType: 'boolean', confidence: 0.95 };
  }

  return { converted: value, targetType: 'boolean', confidence: 0 };
}

// ============================================================
// 条件值类型自动修复
// ============================================================

/**
 * 获取列的 DataProfile
 */
function getColProfile(colKey: string, profile: DataProfile): ColumnProfile | undefined {
  return profile.columns.find((c) => c.columnKey === colKey || c.title === colKey);
}

/**
 * 修复单个值以匹配列类型
 */
function repairValueForColumn(
  value: unknown,
  colKey: string,
  columns: ColumnDef[],
  profile: DataProfile,
  repairs: RepairRecord[],
): unknown {
  const colDef = columns.find((c) => c.key === colKey);
  if (!colDef) return value;

  const colProfile = getColProfile(colKey, profile);
  const targetType = colDef.type === 'text' ? 'string' : colDef.type === 'number' ? 'number' : 'string';

  if (targetType === 'number' && typeof value === 'string') {
    const result = parseNumeric(value);
    if (result.confidence >= 0.7) {
      repairs.push({
        action: 'TYPE_CONVERT',
        target: colKey,
        original: value,
        repaired: result.converted,
        confidence: result.confidence,
        category: result.confidence >= 0.7 ? 'auto' : 'suggest',
        detail: `"${value}" → ${result.converted}（${colDef.title}列为数值类型）`,
      });
      return result.converted;
    }
  }

  if (targetType === 'number' && colProfile && colProfile.type === 'number' && typeof value === 'string') {
    // 即使 columnDef 不是 number，但 profile 推断为 number
    const result = parseNumeric(value);
    if (result.confidence >= 0.7) {
      repairs.push({
        action: 'TYPE_CONVERT',
        target: colKey,
        original: value,
        repaired: result.converted,
        confidence: result.confidence,
        category: 'auto',
        detail: `"${value}" → ${result.converted}（根据数据推断${colDef.title}列为数值类型）`,
      });
      return result.converted;
    }
  }

  return value;
}

/**
 * 遍历 plan 的条件值，自动修复类型不匹配
 */
export function convertConditionValues(
  plan: ExecutionPlan,
  profile: DataProfile,
  columns: ColumnDef[],
): { plan: ExecutionPlan; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];
  const repairedPlan = convertInPlan(plan, profile, columns, repairs);
  return { plan: repairedPlan, repairs };
}

function convertInPlan(
  plan: ExecutionPlan,
  profile: DataProfile,
  columns: ColumnDef[],
  repairs: RepairRecord[],
): ExecutionPlan {
  switch (plan.type) {
    case 'filter':
      return convertFilterPlan(plan, profile, columns, repairs);
    case 'update':
      return convertUpdatePlan(plan, profile, columns, repairs);
    case 'pipeline':
      return convertPipelinePlan(plan, profile, columns, repairs);
    default:
      return plan;
  }
}

function convertFilterPlan(
  plan: FilterPlan,
  profile: DataProfile,
  columns: ColumnDef[],
  repairs: RepairRecord[],
): FilterPlan {
  const newConditions = plan.conditions.map((c) => {
    const newValue = repairValueForColumn(c.value, c.columnKey, columns, profile, repairs);
    return newValue !== c.value ? { ...c, value: newValue } : c;
  });
  return { ...plan, conditions: newConditions };
}

function convertUpdatePlan(
  plan: UpdatePlan,
  profile: DataProfile,
  columns: ColumnDef[],
  repairs: RepairRecord[],
): UpdatePlan {
  const newValue = repairValueForColumn(plan.value, plan.column, columns, profile, repairs);
  const conditions = plan.conditions?.map((c) => {
    const newCondValue = repairValueForColumn(c.value, c.columnKey, columns, profile, repairs);
    return newCondValue !== c.value ? { ...c, value: newCondValue } : c;
  });
  return { ...plan, value: newValue as string | number, conditions };
}

function convertPipelinePlan(
  plan: PipelinePlan,
  profile: DataProfile,
  columns: ColumnDef[],
  repairs: RepairRecord[],
): PipelinePlan {
  const newSteps = plan.steps.map((step) => convertInPlan(step, profile, columns, repairs));
  return { ...plan, steps: newSteps };
}
