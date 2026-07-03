// ============================================================
// 通用规则检测（第一层）
// 不依赖列的业务含义，纯统计
// ============================================================

import type { ColumnDef, RowData } from '../types';
import type { Anomaly } from './types';
import { getColumnType } from './column-types';
import { inferColumnTypes } from './inference';

let anomalyIdCounter = 0;
function nextId(): string {
  return 'anomaly-' + (++anomalyIdCounter) + '-' + Date.now();
}

// ========== 空值检测 ==========

export function detectNulls(rows: RowData[], columns: ColumnDef[]): Anomaly[] {
  const result: Anomaly[] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    for (const col of columns) {
      const v = rows[ri][col.key];
      if (v === null || v === undefined || String(v).trim() === '') {
        result.push({
          id: nextId(),
          severity: 'warning',
          layer: 'rule',
          rowIndex: ri,
          columnKey: col.key,
          columnTitle: col.title,
          title: '空值',
          detail: `${col.title}缺失`,
          canAutoFix: false,
        });
      }
    }
  }
  return result;
}

// ========== 重复行检测 ==========

export function detectDuplicates(rows: RowData[], columns: ColumnDef[], keyColumns?: string[]): Anomaly[] {
  const result: Anomaly[] = [];
  const seen = new Map<string, number>();

  for (let ri = 0; ri < rows.length; ri++) {
    const keys = keyColumns || columns.map(c => c.key);
    const sig = keys.map(k => String(rows[ri][k] ?? '')).join('|');
    const prev = seen.get(sig);
    if (prev !== undefined) {
      result.push({
        id: nextId(),
        severity: 'error',
        layer: 'rule',
        rowIndex: ri,
        title: '重复值',
        detail: `第${ri + 1}行与第${prev + 1}行重复`,
        canAutoFix: false,
      });
    } else {
      seen.set(sig, ri);
    }
  }
  return result;
}

// ========== 类型混合检测 ==========

export function detectMixedTypes(rows: RowData[], columns: ColumnDef[]): Anomaly[] {
  const result: Anomaly[] = [];
  for (const col of columns) {
    const types = new Set<string>();
    for (let ri = 0; ri < Math.min(rows.length, 200); ri++) {
      const v = rows[ri][col.key];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const sv = String(v);
      if (!isNaN(Number(sv)) && sv !== '') types.add('number');
      else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(sv)) types.add('date');
      else types.add('text');
    }
    if (types.size > 1) {
      result.push({
        id: nextId(),
        severity: 'warning',
        layer: 'rule',
        columnKey: col.key,
        columnTitle: col.title,
        title: '类型混合',
        detail: `${col.title}列包含多种数据类型：${Array.from(types).join(', ')}`,
        canAutoFix: false,
      });
    }
  }
  return result;
}

// ========== 格式不统一检测 ==========

export function detectFormatInconsistency(rows: RowData[], columns: ColumnDef[]): Anomaly[] {
  const result: Anomaly[] = [];
  for (const col of columns) {
    // 对日期类列检查格式统一性
    if (col.type !== 'date') continue;
    const formats = new Map<string, number>();
    for (let ri = 0; ri < Math.min(rows.length, 200); ri++) {
      const v = String(rows[ri][col.key] ?? '');
      if (!v) continue;
      let fmt = 'unknown';
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) fmt = 'YYYY-MM-DD';
      else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(v)) fmt = 'YYYY/MM/DD';
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) fmt = 'MM/DD/YYYY';
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) fmt = 'MM-DD-YYYY';
      else fmt = '其他';
      formats.set(fmt, (formats.get(fmt) || 0) + 1);
    }
    if (formats.size > 1) {
      const fmtList = Array.from(formats.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([f, c]) => `${f}(${c}条)`)
        .join(', ');
      result.push({
        id: nextId(),
        severity: 'suggestion',
        layer: 'rule',
        columnKey: col.key,
        columnTitle: col.title,
        title: '日期格式不统一',
        detail: `${col.title}列存在多种日期格式：${fmtList}`,
        canAutoFix: false,
      });
    }
  }
  return result;
}

// ========== 数值异常检测（±3σ） ==========

export function detectNumericOutliers(rows: RowData[], columns: ColumnDef[]): Anomaly[] {
  const result: Anomaly[] = [];
  for (const col of columns) {
    const vals: number[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const v = Number(rows[ri][col.key]);
      if (!isNaN(v)) vals.push(v);
    }
    if (vals.length < 5) continue;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) continue;
    for (let ri = 0; ri < rows.length; ri++) {
      const v = Number(rows[ri][col.key]);
      if (isNaN(v)) continue;
      if (Math.abs(v - mean) > 3 * stdDev) {
        result.push({
          id: nextId(),
          severity: 'warning',
          layer: 'rule',
          rowIndex: ri,
          columnKey: col.key,
          columnTitle: col.title,
          title: '数值异常',
          detail: `${col.title}值为${v}，超出正常范围（均值${mean.toFixed(0)}±${(3 * stdDev).toFixed(0)}）`,
          canAutoFix: false,
        });
      }
    }
  }
  return result;
}

// ========== 空行检测 ==========

export function detectBlankRows(rows: RowData[], columns: ColumnDef[]): Anomaly[] {
  const result: Anomaly[] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const allBlank = columns.every(col => {
      const v = rows[ri][col.key];
      return v === null || v === undefined || String(v).trim() === '';
    });
    if (allBlank) {
      result.push({
        id: nextId(),
        severity: 'warning',
        layer: 'rule',
        rowIndex: ri,
        title: '空白行',
        detail: `第${ri + 1}行为空白行`,
        canAutoFix: false,
      });
    }
  }
  return result;
}

// ========== 第二层：类型推断后校验 ==========

export function detectTypeAnomalies(
  rows: RowData[],
  columns: ColumnDef[],
): { anomalies: Anomaly[]; inferences: import('./types').InferenceResult[] } {
  const inferences = inferColumnTypes(rows, columns);
  const anomalies: Anomaly[] = [];

  for (let ri = 0; ri < rows.length; ri++) {
    for (const col of columns) {
      const v = rows[ri][col.key];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      const inference = inferences.find(inf => inf.columnKey === col.key);
      if (!inference || !inference.typeId) continue;
      const ct = getColumnType(inference.typeId);
      if (!ct) continue;
      const raw = String(v);
      const result = ct.validate(raw);
      if (!result.valid) {
        anomalies.push({
          id: nextId(),
          severity: result.severity || 'error',
          layer: 'inference',
          rowIndex: ri,
          columnKey: col.key,
          columnTitle: col.title,
          title: `${ct.name}格式异常`,
          detail: result.message || `${col.title}格式不正确`,
          originalValue: raw,
          canAutoFix: !!ct.autoFix,
          suggestedValue: ct.autoFix ? ct.autoFix(raw) : undefined,
        });
      }
    }
  }
  return { anomalies, inferences };
}

// ========== 统一入口 ==========

export function runGeneralDetection(
  rows: RowData[],
  columns: ColumnDef[],
): { anomalies: Anomaly[]; inferences: import('./types').InferenceResult[] } {
  const ruleAnomalies: Anomaly[] = [
    ...detectBlankRows(rows, columns),
    ...detectNulls(rows, columns),
    ...detectDuplicates(rows, columns),
    ...detectMixedTypes(rows, columns),
    ...detectFormatInconsistency(rows, columns),
    ...detectNumericOutliers(rows, columns),
  ];

  const { anomalies: typeAnomalies, inferences } = detectTypeAnomalies(rows, columns);

  return {
    anomalies: [...ruleAnomalies, ...typeAnomalies],
    inferences,
  };
}
