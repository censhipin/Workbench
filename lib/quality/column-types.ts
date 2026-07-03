// ============================================================
// ColumnType 注册表
// 所有内置列类型在此注册，新增类型只需 registerColumnType()
// 不包含推断逻辑（由 inferColumnType 集中处理）
// ============================================================

import type { ColumnType, Severity } from './types';

const registry = new Map<string, ColumnType>();

export function registerColumnType(t: ColumnType): void {
  registry.set(t.id, t);
}

export function getColumnType(id: string): ColumnType | undefined {
  return registry.get(id);
}

export function getAllColumnTypes(): ColumnType[] {
  return Array.from(registry.values());
}

// ---- 内置类型注册 ----

registerColumnType({
  id: 'phone',
  name: '手机号',
  category: 'string',
  description: '中国大陆手机号，11位数字，1开头',
  validate(v) {
    const cleaned = v.replace(/[\s\-()（）]/g, '');
    if (/^1\d{10}$/.test(cleaned)) return { valid: true };
    if (/^\d+$/.test(cleaned)) return { valid: false, severity: 'error', message: '手机号应为11位数字' };
    return { valid: false, severity: 'error', message: '手机号格式不正确' };
  },
  autoFix(v) {
    const cleaned = v.replace(/[\s\-()（）]/g, '');
    if (/^1\d{10}$/.test(cleaned)) return cleaned;
    return v;
  },
});

registerColumnType({
  id: 'email',
  name: '邮箱',
  category: 'string',
  description: '标准邮箱地址',
  validate(v) {
    const s = v.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { valid: true };
    return { valid: false, severity: 'error', message: '邮箱格式不正确' };
  },
});

registerColumnType({
  id: 'idcard',
  name: '身份证号',
  category: 'string',
  description: '中国大陆18位身份证号（末位可为X）',
  validate(v) {
    const cleaned = v.replace(/\s/g, '');
    if (/^\d{17}[\dXx]$/.test(cleaned)) return { valid: true };
    if (/^\d{15}$/.test(cleaned)) return { valid: false, severity: 'warning', message: '身份证号应为18位' };
    return { valid: false, severity: 'error', message: '身份证号格式不正确' };
  },
});

registerColumnType({
  id: 'date',
  name: '日期',
  category: 'date',
  description: '标准日期格式 YYYY-MM-DD 或 YYYY/MM/DD',
  validate(v) {
    if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) {
      // 尝试宽松匹配
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v)) {
        return { valid: false, severity: 'warning', message: '日期格式不完整，建议使用 YYYY-MM-DD' };
      }
      return { valid: false, severity: 'error', message: '日期格式不正确，期望 YYYY-MM-DD' };
    }
    const d = new Date(v).getTime();
    if (isNaN(d)) return { valid: false, severity: 'error', message: '日期值不合法（如月份超出1-12）' };
    return { valid: true };
  },
  autoFix(v) {
    const fixed = v.replace(/\//g, '-');
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(fixed) && !isNaN(new Date(fixed).getTime())) return fixed;
    return v;
  },
});

registerColumnType({
  id: 'amount',
  name: '金额',
  category: 'numeric',
  description: '金额数值（含货币符号、千分位等）',
  validate(v) {
    const cleaned = v.replace(/[￥¥$,，\s]/g, '').replace(/,/g, '');
    if (cleaned === '') return { valid: true };
    const n = parseFloat(cleaned);
    if (isNaN(n)) return { valid: false, severity: 'error', message: '金额不是有效数字' };
    if (n < 0) return { valid: false, severity: 'warning', message: '金额为负数' };
    return { valid: true };
  },
  autoFix(v) {
    return v.replace(/[￥¥$,，\s]/g, '').replace(/,/g, '');
  },
});

registerColumnType({
  id: 'text',
  name: '文本',
  category: 'string',
  description: '通用文本',
  validate() {
    return { valid: true };
  },
});

registerColumnType({
  id: 'numeric',
  name: '数值',
  category: 'numeric',
  description: '通用数值',
  validate(v) {
    if (v === '' || v === null || v === undefined) return { valid: true };
    return isNaN(Number(v)) ? { valid: false, severity: 'error', message: '不是有效数值' } : { valid: true };
  },
});
