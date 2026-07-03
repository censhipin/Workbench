// ============================================================
// 业务规则引擎（第三层）
// 规则模板注册制，跨列业务逻辑校验
// 内置 3 个模板：乘积校验、时序校验、身份证出生日期校验
// ============================================================

import type { ColumnDef, RowData } from '../types';
import type { Anomaly, Severity } from './types';

let idCounter = 0;

function nextId(): string {
  return 'biz-' + (++idCounter) + '-' + Date.now();
}

/* ============================================================
   类型定义
   ============================================================ */

/** 规则模板参数角色 */
export interface RuleParamDef {
  role: string;
  label: string;
  synonyms: string[];
}

/** 规则模板 */
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  params: RuleParamDef[];
  validate: (rows: RowData[], mapping: Record<string, string>, columns: ColumnDef[]) => Anomaly[];
}

/** 列匹配结果 */
export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  mapping: Record<string, string>;
  confidence: number;
}

/* ============================================================
   注册表
   ============================================================ */

const registry = new Map<string, RuleTemplate>();

export function registerRuleTemplate(t: RuleTemplate): void {
  registry.set(t.id, t);
}

export function getRuleTemplate(id: string): RuleTemplate | undefined {
  return registry.get(id);
}

export function getAllRuleTemplates(): RuleTemplate[] {
  return Array.from(registry.values());
}

/* ============================================================
   列匹配器
   基于列名同义词匹配，返回每模板的匹配结果与置信度
   ============================================================ */

function scoreColumnName(columnTitle: string, synonyms: string[]): number {
  const lower = columnTitle.replace(/\s/g, '').toLowerCase();
  for (const syn of synonyms) {
    const sl = syn.replace(/\s/g, '').toLowerCase();
    if (sl === lower) return 1.0;
  }
  for (const syn of synonyms) {
    const sl = syn.replace(/\s/g, '').toLowerCase();
    if (lower.includes(sl) || sl.includes(lower)) return 0.7;
  }
  return 0;
}

function matchColumnsForRule(
  template: RuleTemplate,
  columns: ColumnDef[],
): { matched: boolean; mapping: Record<string, string>; confidence: number } {
  const mapping: Record<string, string> = {};
  const usedColumns = new Set<string>();

  for (const param of template.params) {
    let bestKey = '';
    let bestScore = 0;

    for (const col of columns) {
      if (usedColumns.has(col.key)) continue;
      const score = scoreColumnName(col.title, param.synonyms);
      if (score > bestScore) {
        bestScore = score;
        bestKey = col.key;
      }
    }

    if (bestScore >= 0.7 && bestKey) {
      mapping[param.role] = bestKey;
      usedColumns.add(bestKey);
    } else {
      return { matched: false, mapping: {}, confidence: 0 };
    }
  }

  // 置信度 = 最低的角色匹配分
  let minConfidence = 1;
  for (const param of template.params) {
    const colKey = mapping[param.role];
    const col = columns.find(c => c.key === colKey);
    const score = col ? scoreColumnName(col.title, param.synonyms) : 0;
    minConfidence = Math.min(minConfidence, score);
  }

  return { matched: true, mapping, confidence: minConfidence };
}

/* ============================================================
   主入口：对所有已注册规则模板执行匹配 + 校验
   ============================================================ */

export function matchAndRunRules(
  rows: RowData[],
  columns: ColumnDef[],
): { anomalies: Anomaly[]; matches: RuleMatch[] } {
  const result: Anomaly[] = [];
  const matches: RuleMatch[] = [];
  const templates = getAllRuleTemplates();

  for (const template of templates) {
    const match = matchColumnsForRule(template, columns);
    matches.push({
      ruleId: template.id,
      ruleName: template.name,
      matched: match.matched,
      mapping: match.mapping,
      confidence: match.confidence,
    });

    if (match.matched && rows.length > 0) {
      const anomalies = template.validate(rows, match.mapping, columns);
      for (const a of anomalies) {
        a.ruleId = template.id;
        a.layer = 'business';
      }
      result.push(...anomalies);
    }
  }

  return { anomalies: result, matches };
}

/* ============================================================
   辅助：日期解析
   ============================================================ */

function parseDateStr(s: string): Date | null {
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d2 = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function formatDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function birthDateFromIdCard(idCard: string): string | null {
  const cleaned = idCard.replace(/\s/g, '');
  let year: number, month: number, day: number;
  if (/^\d{17}[\dXx]$/.test(cleaned)) {
    year = parseInt(cleaned.substring(6, 10), 10);
    month = parseInt(cleaned.substring(10, 12), 10);
    day = parseInt(cleaned.substring(12, 14), 10);
  } else if (/^\d{15}$/.test(cleaned)) {
    year = 1900 + parseInt(cleaned.substring(6, 8), 10);
    month = parseInt(cleaned.substring(8, 10), 10);
    day = parseInt(cleaned.substring(10, 12), 10);
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/* ============================================================
   内置规则模板
   ============================================================ */

/**
 * 1. 乘积校验
 * 检查 A × B 是否与 C 一致（偏差 > 1% 即为异常）
 * 典型场景：数量 × 单价 ≠ 金额
 */
registerRuleTemplate({
  id: 'arithmetic_multiply',
  name: '乘积校验',
  description: '检查 A × B 是否等于 C，用于数量×单价=金额等场景',
  severity: 'error',
  params: [
    { role: 'factorA', label: '乘数', synonyms: ['数量', '个数', '件数', '份数', 'qty', 'quantity'] },
    { role: 'factorB', label: '被乘数', synonyms: ['单价', '价格', 'unit_price', 'unit price', 'unit'] },
    { role: 'product', label: '积', synonyms: ['金额', '总价', '合计', '总额', 'total', 'sum', '小计', '总和'] },
  ],
  validate(rows, mapping, columns) {
    const anomalies: Anomaly[] = [];
    const getTitle = (key: string) => columns.find(c => c.key === key)?.title || key;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rawA = row[mapping.factorA];
      const rawB = row[mapping.factorB];
      const rawP = row[mapping.product];
      if (rawA == null || rawB == null || rawP == null) continue;
      if (rawA === '' || rawB === '' || rawP === '') continue;

      const a = parseFloat(String(rawA).replace(/[￥¥$,，\s]/g, ''));
      const b = parseFloat(String(rawB).replace(/[￥¥$,，\s]/g, ''));
      const p = parseFloat(String(rawP).replace(/[￥¥$,，\s]/g, ''));
      if (isNaN(a) || isNaN(b) || isNaN(p)) continue;

      const expected = a * b;
      if (expected === 0 && p === 0) continue;

      const maxVal = Math.max(Math.abs(expected), Math.abs(p), 1);
      const deviation = Math.abs(expected - p) / maxVal;

      if (deviation > 0.01) {
        anomalies.push({
          id: nextId(),
          severity: 'error',
          layer: 'business',
          rowIndex: ri,
          columnKey: mapping.product,
          columnTitle: getTitle(mapping.product),
          title: '乘积不一致',
          detail: `${getTitle(mapping.factorA)}(${rawA}) × ${getTitle(mapping.factorB)}(${rawB}) = ${expected.toFixed(2)}，但${getTitle(mapping.product)}为${rawP}`,
          originalValue: String(rawP),
          suggestedValue: expected.toFixed(2),
          canAutoFix: false,
        });
      }
    }
    return anomalies;
  },
});

/**
 * 2. 时序校验
 * 检查 startDate ≤ endDate
 * 典型场景：开始日期 > 结束日期
 */
registerRuleTemplate({
  id: 'temporal_order',
  name: '时序校验',
  description: '检查开始日期是否早于或等于结束日期',
  severity: 'error',
  params: [
    { role: 'startDate', label: '开始日期', synonyms: ['开始日期', '开始时间', '生效日期', 'start_date', 'start date', 'start', '入职日期'] },
    { role: 'endDate', label: '结束日期', synonyms: ['结束日期', '结束时间', '失效日期', 'end_date', 'end date', 'end', '离职日期'] },
  ],
  validate(rows, mapping, columns) {
    const anomalies: Anomaly[] = [];
    const getTitle = (key: string) => columns.find(c => c.key === key)?.title || key;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rawStart = row[mapping.startDate];
      const rawEnd = row[mapping.endDate];
      if (rawStart == null || rawEnd == null) continue;
      if (rawStart === '' || rawEnd === '') continue;

      const start = parseDateStr(String(rawStart));
      const end = parseDateStr(String(rawEnd));
      if (!start || !end) continue;

      if (start > end) {
        anomalies.push({
          id: nextId(),
          severity: 'error',
          layer: 'business',
          rowIndex: ri,
          columnKey: mapping.endDate,
          columnTitle: getTitle(mapping.endDate),
          title: '日期矛盾',
          detail: `${getTitle(mapping.startDate)}(${formatDate(start)}) 晚于 ${getTitle(mapping.endDate)}(${formatDate(end)})`,
          originalValue: String(rawEnd),
          canAutoFix: false,
        });
      }
    }
    return anomalies;
  },
});

/**
 * 3. 身份证出生日期一致性校验
 * 检查身份证号中提取的出生日期是否与填写的出生日期一致
 */
registerRuleTemplate({
  id: 'idcard_consistency',
  name: '身份证出生日期校验',
  description: '检查身份证号中的出生日期与填写的是否一致',
  severity: 'error',
  params: [
    { role: 'idCard', label: '身份证号', synonyms: ['身份证', '身份证号', '身份证号码', '证件号', '证件号码', 'idcard', 'id_card', 'identity'] },
    { role: 'birthDate', label: '出生日期', synonyms: ['出生日期', '出生年月', '生日', '出生', 'birth', 'birthday'] },
  ],
  validate(rows, mapping, columns) {
    const anomalies: Anomaly[] = [];
    const getTitle = (key: string) => columns.find(c => c.key === key)?.title || key;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rawId = row[mapping.idCard];
      const rawBirth = row[mapping.birthDate];
      if (rawId == null || rawBirth == null) continue;
      if (rawId === '' || rawBirth === '') continue;

      const extractedBirth = birthDateFromIdCard(String(rawId));
      if (!extractedBirth) continue;

      const birthDate = parseDateStr(String(rawBirth));
      if (!birthDate) continue;
      const birthStr = formatDate(birthDate);

      if (extractedBirth !== birthStr) {
        anomalies.push({
          id: nextId(),
          severity: 'error',
          layer: 'business',
          rowIndex: ri,
          columnKey: mapping.birthDate,
          columnTitle: getTitle(mapping.birthDate),
          title: '出生日期不一致',
          detail: `身份证号提取出生日期为${extractedBirth}，但填写的${getTitle(mapping.birthDate)}为${birthStr}`,
          originalValue: String(rawBirth),
          suggestedValue: extractedBirth,
          canAutoFix: false,
        });
      }
    }
    return anomalies;
  },
});
