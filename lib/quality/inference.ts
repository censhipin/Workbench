// ============================================================
// 集中式列类型推断引擎
// 分析数据模式 + 列名，返回推断结果
// ============================================================

import type { ColumnDef, RowData } from '../types';
import type { InferenceResult } from './types';
import { getAllColumnTypes } from './column-types';

/** 列名同义词体系 — 用于列名匹配加分 */
const SYNONYMS: Record<string, string[]> = {
  phone: ['手机', '电话', '手机号', '联系电话', '手机号码', 'tel', 'phone', 'mobile', 'contact', 'cellular'],
  email: ['邮箱', '邮件', 'email', 'e-mail', 'mail', '电子邮箱'],
  idcard: ['身份证', '证件', '证件号', '身份证号', '身份证号码', 'idcard', 'id_card', 'identity', '证件号码'],
  date: ['日期', '时间', '日', 'date', 'time', 'day', '年月日', '入职日期', '出生日期', '创建时间', '更新时间'],
  amount: ['金额', '工资', '收入', '价格', '奖金', '补贴', '单价', '总额', '合计', 'amount', 'price', 'total', 'salary', 'money', 'sum', '小计'],
};

/** 推断单列类型 */
function inferSingleColumn(
  samples: string[],
  columnName: string,
  nonNullSamples: string[],
): { typeId: string | null; confidence: number } {
  const validSamples = nonNullSamples.filter(v => v && v !== '');
  if (validSamples.length === 0) return { typeId: 'text', confidence: 0.5 };

  // 对每种类型跑匹配器
  const matches: { typeId: string; score: number }[] = [];
  const candidates = getAllColumnTypes().filter(t => t.id !== 'text' && t.id !== 'numeric');
  const lowerName = columnName.toLowerCase();

  for (const ct of candidates) {
    let score = 0;
    let matchCount = 0;
    let totalCount = Math.min(validSamples.length, 50);

    // 检查数据模式
    for (let i = 0; i < totalCount; i++) {
      const v = validSamples[i];
      const result = ct.validate(v);
      if (result.valid) matchCount++;
    }
    const dataScore = totalCount > 0 ? matchCount / totalCount : 0;

    // 检查列名匹配
    const syns = SYNONYMS[ct.id] || [];
    let nameScore = 0;
    for (const syn of syns) {
      if (lowerName === syn) { nameScore = 0.25; break; }
      if (lowerName.includes(syn) || syn.includes(lowerName)) { nameScore = Math.max(nameScore, 0.15); }
    }

    score = dataScore * 0.7 + nameScore * 0.3;

    if (score > 0.3) {
      matches.push({ typeId: ct.id, score });
    }
  }

  // 按置信度排序取最优
  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    // 检查是否大多数为数字
    const numericCount = validSamples.filter(v => !isNaN(Number(v)) && v !== '').length;
    if (numericCount / validSamples.length > 0.8) {
      return { typeId: 'numeric', confidence: 0.7 };
    }
    return { typeId: 'text', confidence: 0.8 };
  }

  const best = matches[0];
  const confidence = Math.round(best.score * 100) / 100;
  return { typeId: best.typeId, confidence: Math.min(confidence, 0.99) };
}

/** 获取某列的样本数据 */
function getColumnSamples(rows: RowData[], colKey: string, maxSamples = 100): string[] {
  const samples: string[] = [];
  for (let i = 0; i < Math.min(rows.length, maxSamples); i++) {
    const v = rows[i]?.[colKey];
    samples.push(v != null ? String(v) : '');
  }
  return samples;
}

/** 主推断入口：对表格所有列执行类型推断 */
export function inferColumnTypes(
  rows: RowData[],
  columns: ColumnDef[],
): InferenceResult[] {
  return columns.map(col => {
    const samples = getColumnSamples(rows, col.key);
    const nonNullSamples = samples.filter(v => v && v !== '');
    const { typeId, confidence } = inferSingleColumn(samples, col.title, nonNullSamples);
    const ct = typeId ? getAllColumnTypes().find(t => t.id === typeId) : undefined;
    return {
      columnKey: col.key,
      columnTitle: col.title,
      typeId,
      typeName: ct?.name || '文本',
      confidence,
    };
  });
}
