'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AuditReport, AuditStats,
  DuplicateFinding, NullFinding, AnomalyFinding, AnomalyRecord,
  FixResult, ColumnDef, RowData,
} from '@/lib/types';
import { autoFixRows, chineseToNumber } from '@/lib/audit-engine';
import { getColumnType, type InferenceResult } from '@/lib/quality';

/* ============================================================
   Props
   ============================================================ */
interface DataAuditProps {
  onClose: () => void;
  onFix: (fixType: string, fixResults: FixResult[], fixedRows?: RowData[], fixedColumns?: ColumnDef[]) => void;
  onFilterRows?: (rowIndices: number[]) => void;
  onCellEdit?: (rowIndex: number, colKey: string, newValue: string) => void;
  onReAudit?: () => void;
  onLocate?: (rowIndex: number, colKey: string) => void;
  runAuditFn: () => AuditReport;
  rows: RowData[];
  columns: ColumnDef[];
  inferences: InferenceResult[];
}

/* ============================================================
   扫描步骤
   ============================================================ */
const SCAN_STEPS = ['读取数据', '基础统计', '检测重复', '检测空值', '检测异常', '生成报告'];
const STEP_MS = 380;

/* ============================================================
   辅助工具
   ============================================================ */
/** 取行主标识（优先姓名，否则 person / name，否则第一列） */
function getRowLabel(rowIndex: number, row: RowData, columns: ColumnDef[]): string {
  if (!row) return '第' + (rowIndex + 1) + '行';
  const nameKeys = ['姓名', '名称', 'name', 'person'];
  for (const k of nameKeys) {
    const val = row[k];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  const first = columns[0];
  if (first) {
    const val = row[first.key];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return '第' + (rowIndex + 1) + '行';
}

/* ============================================================
   按行聚合异常
   ============================================================ */
interface RowIssue {
  rowIndex: number;
  label: string;
  issues: { fieldLabel: string; issueType: string; issueReason: string; fieldKey: string; originalValue: string }[];
}
type Severity = 'all' | 'severe' | 'medium' | 'light';

function buildRowIssues(report: AuditReport, rows: RowData[], columns: ColumnDef[]): RowIssue[] {
  const map = new Map<number, RowIssue['issues']>();

  for (const nf of report.nulls) {
    for (const nr of nf.records) {
      const list = map.get(nr.rowIndex) || [];
      list.push({ fieldLabel: nr.fieldLabel, issueType: '空值', issueReason: nr.fieldLabel + '缺失', fieldKey: nr.fieldKey, originalValue: '-' });
      map.set(nr.rowIndex, list);
    }
  }
  for (const af of report.anomalies) {
    for (const ar of af.records) {
      const list = map.get(ar.rowIndex) || [];
      list.push({ fieldLabel: ar.fieldLabel, issueType: ar.issueType, issueReason: ar.issueReason, fieldKey: ar.fieldKey, originalValue: ar.originalValue });
      map.set(ar.rowIndex, list);
    }
  }

  const result: RowIssue[] = [];
  map.forEach((issues, rowIndex) => {
    // 去重（同字段同类型只保留一条）
    const seen = new Set<string>();
    const deduped = issues.filter((iss) => {
      const k = iss.fieldKey + '|' + iss.issueType;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    result.push({
      rowIndex,
      label: getRowLabel(rowIndex, rows[rowIndex] || {}, columns),
      issues: deduped,
    });
  });
  result.sort((a, b) => b.issues.length - a.issues.length || a.rowIndex - b.rowIndex);
  return result;
}

function getSeverity(issueCount: number): Severity {
  if (issueCount >= 3) return 'severe';
  if (issueCount >= 2) return 'medium';
  return 'light';
}
const severityColors: Record<Severity, { dot: string; badge: string; badgeBg: string }> = {
  severe:  { dot: '#ef4444', badge: 'text-red-700',  badgeBg: 'bg-red-50 border-red-200' },
  medium:  { dot: '#f59e0b', badge: 'text-amber-700', badgeBg: 'bg-amber-50 border-amber-200' },
  light:   { dot: '#3b82f6', badge: 'text-blue-700',  badgeBg: 'bg-blue-50 border-blue-200' },
  all:     { dot: '#6b7280', badge: 'text-zinc-700',  badgeBg: 'bg-zinc-50 border-zinc-200' },
};
const severityLabels: Record<Severity, string> = { severe: '严重', medium: '中等', light: '轻微', all: '全部' };

/* ============================================================
   编辑时列类型校验（不依赖旧 issueType）
   ============================================================ */
function validateCellByType(value: string, colKey: string, inferences: InferenceResult[]): { valid: boolean; message?: string } {
  const inference = inferences.find(inf => inf.columnKey === colKey);
  if (inference && inference.typeId && inference.typeId !== 'text' && inference.typeId !== 'numeric') {
    const ct = getColumnType(inference.typeId);
    if (ct && value) return ct.validate(value);
  }
  return { valid: true };
}

function getValidateFnForColumn(colKey: string, inferences: InferenceResult[]): ((v: string) => boolean) | null {
  const inference = inferences.find(inf => inf.columnKey === colKey);
  if (inference && inference.typeId && inference.typeId !== 'text' && inference.typeId !== 'numeric') {
    const ct = getColumnType(inference.typeId);
    if (ct) return function (v: string) { return ct.validate(v).valid; };
  }
  return null;
}

/* ============================================================
   StatGrid
   ============================================================ */
function StatGrid(props: { stats: AuditStats }) {
  const s = props.stats;
  const items: { label: string; value: number; warn?: boolean }[] = [
    { label: '总记录', value: s.totalRows }, { label: '总列数', value: s.totalCols },
    { label: '空白单元格', value: s.blankCells, warn: s.blankCells > 0 }, { label: '空白行', value: s.blankRows, warn: s.blankRows > 0 },
    { label: '数值列', value: s.numericCols }, { label: '文本列', value: s.textCols }, { label: '日期列', value: s.dateCols },
  ];
  return React.createElement('div', { className: 'grid grid-cols-3 gap-2' },
    items.map(function (it) {
      return React.createElement('div', { key: it.label, className: 'bg-zinc-50 rounded-lg px-3 py-2 text-center' },
        React.createElement('p', { className: 'text-lg font-semibold ' + (it.warn ? 'text-amber-600' : 'text-zinc-800') }, String(it.value)),
        React.createElement('p', { className: 'text-[10px] text-zinc-400' }, it.label)
      );
    })
  );
}

/* ============================================================
   异常数据编辑弹窗
   - 居中弹窗（非全屏），带圆角和阴影
   - 异常字段红色高亮，修复后变绿色
   - 问题列移到行尾，修复后显示"已处理"
   - 左上角计数随修复更新
   - 支持双击编辑、Enter确认、Tab切换、批量保存
   ============================================================ */
function AnomalyEditTable(props: {
  allRows: RowData[];
  allColumns: ColumnDef[];
  rowIssues: RowIssue[];
  onClose: () => void;
  onCellEdit?: (rowIndex: number, colKey: string, newValue: string) => void;
  onSaveAll: (editedRows: Record<string, Record<string, string>>) => void;
  onReAudit?: () => void;
  persistedEdits: Record<string, Record<string, string>>;
  inferences: InferenceResult[];
}) {
  const [showAllRows, setShowAllRows] = useState(false);
  const [showAllCols, setShowAllCols] = useState(true);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  // 合并持久化编辑 + 本地编辑
  const [localEdits, setLocalEdits] = useState<Record<string, Record<string, string>>>(props.persistedEdits);
  const [savedMsg, setSavedMsg] = useState('');
  const [localFixed, setLocalFixed] = useState<Set<number>>(new Set());
  // 用户确认负数金额为正常的行
  const [dismissedNegativeRows, setDismissedNegativeRows] = useState<Set<number>>(new Set());
  const [showNegativeDetail, setShowNegativeDetail] = useState(false);
  // 中文数字转换弹窗
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  // 按列分组可转换的格式异常
  const convertibleMap = useMemo(() => {
    const map = new Map<string, { fieldKey: string; fieldLabel: string; items: { rowIndex: number; originalValue: string }[] }>();
    for (const ri of props.rowIssues) {
      for (const iss of ri.issues) {
        if (iss.issueType === '格式异常' && iss.issueReason === '包含中文数字') {
          let group = map.get(iss.fieldKey);
          if (!group) { group = { fieldKey: iss.fieldKey, fieldLabel: iss.fieldLabel, items: [] }; map.set(iss.fieldKey, group); }
          group.items.push({ rowIndex: ri.rowIndex, originalValue: iss.originalValue });
        }
      }
    }
    return map;
  }, [props.rowIssues]);
  const convertibleColKeys = useMemo(() => Array.from(convertibleMap.keys()), [convertibleMap]);
  // 组件挂载时，如果有可转换项，弹出选择转换窗
  useEffect(function () {
    if (convertibleColKeys.length > 0) {
      setSelectedCols(new Set(convertibleColKeys));
      setShowConvertDialog(true);
    }
  }, []);
  // 按选中列应用转换
  function applySelectedConvert(colSet: Set<string>) {
    setLocalEdits(function (prev) {
      const next: Record<string, Record<string, string>> = {};
      for (const k of Object.keys(prev)) next[k] = { ...prev[k] };
      for (const [fieldKey, group] of convertibleMap) {
        if (!colSet.has(fieldKey)) continue;
        for (const item of group.items) {
          const cn = chineseToNumber(item.originalValue);
          if (cn !== null) {
            const rk = String(item.rowIndex);
            if (!next[rk]) next[rk] = {};
            next[rk][fieldKey] = String(cn);
          }
        }
      }
      return next;
    });
    setShowConvertDialog(false);
  }
  function openConvertDialog() {
    setSelectedCols(new Set(convertibleColKeys));
    setShowConvertDialog(true);
  }
  // 编辑后新发现的异常：实时校验编辑值，不依赖旧的 rowIssues
  const localAnomalies = useMemo<Record<number, Record<string, string>>>(() => {
    const result: Record<number, Record<string, string>> = {};
    for (const [rowKey, rowEdits] of Object.entries(localEdits)) {
      const rowIndex = Number(rowKey);
      for (const [colKey, newVal] of Object.entries(rowEdits)) {
        const res = validateCellByType(newVal, colKey, props.inferences);
        if (!res.valid) {
          if (!result[rowIndex]) result[rowIndex] = {};
          result[rowIndex][colKey] = res.message || '格式不正确';
        }
      }
    }
    return result;
  }, [localEdits, props.inferences]);

  const anomalyRowIndices = new Set(props.rowIssues.map(function (r) { return r.rowIndex; }));
  // 每行的异常字段集合: rowIndex → Set<fieldKey>
  const anomalyFieldsByRow = new Map<number, Set<string>>();
  props.rowIssues.forEach(function (ri) {
    const fieldSet = new Set<string>();
    ri.issues.forEach(function (iss) { fieldSet.add(iss.fieldKey); });
    anomalyFieldsByRow.set(ri.rowIndex, fieldSet);
  });
  // 每行因"负值金额"标记为异常的字段
  const negativeFieldKeysByRow = new Map<number, Set<string>>();
  props.rowIssues.forEach(function (ri) {
    var negSet = new Set<string>();
    ri.issues.forEach(function (iss) { if (iss.issueType === '负值金额') negSet.add(iss.fieldKey); });
    if (negSet.size > 0) negativeFieldKeysByRow.set(ri.rowIndex, negSet);
  });
  // 全局异常字段（仅用于表头标红）
  const anomalyFieldKeys = new Set<string>();
  props.rowIssues.forEach(function (ri) { ri.issues.forEach(function (iss) { anomalyFieldKeys.add(iss.fieldKey); }); });

  // 剩余异常行数（实时计算：旧异常 + 编辑后新发现的异常）
  const remainingCount = useMemo(function () {
    // 1. 编辑后校验失败的行
    const localAnomalyRows = new Set<number>();
    for (const riStr of Object.keys(localAnomalies)) {
      const ri = Number(riStr);
      if (Object.keys(localAnomalies[ri]).length > 0) localAnomalyRows.add(ri);
    }
    let count = localAnomalyRows.size;
    // 2. 旧的 rowIssues 中尚未修复的
    for (const ri of props.rowIssues) {
      if (localAnomalyRows.has(ri.rowIndex)) continue; // 已计入
      const unfixed = ri.issues.filter(function (iss) {
        if (iss.issueType === '负值金额' && dismissedNegativeRows.has(ri.rowIndex)) return false;
        const curVal = getCellVal(ri.rowIndex, iss.fieldKey);
        return !checkFieldFixed(curVal, iss.issueType, iss.fieldLabel, iss.fieldKey);
      });
      if (unfixed.length > 0) count++;
    }
    return count;
  }, [props.rowIssues, localEdits, dismissedNegativeRows, localAnomalies]);

  // 存在负值异常且未被确认的行索引
  const negativeRows: number[] = [];
  props.rowIssues.forEach(function (ri) {
    const hasNegative = ri.issues.some(function (iss) { return iss.issueType === '负值金额'; });
    if (hasNegative) negativeRows.push(ri.rowIndex);
  });

  const displayRows: number[] = [];
  for (let ri = 0; ri < props.allRows.length; ri++) {
    const hasLocalAnomalyRow = localAnomalies[ri] && Object.keys(localAnomalies[ri]).length > 0;
    if (!showAllRows && !anomalyRowIndices.has(ri) && !hasLocalAnomalyRow) continue;
    displayRows.push(ri);
  }
  const displayCols = showAllCols
    ? props.allColumns
    : props.allColumns.filter(function (c) { return anomalyFieldKeys.has(c.key); });

  function getCellVal(rowIndex: number, colKey: string): string {
    const editedRow = localEdits[rowIndex];
    if (editedRow && editedRow[colKey] !== undefined) return editedRow[colKey];
    return String(props.allRows[rowIndex][colKey] ?? '');
  }

  /** 校验某字段新值是否合法（使用列类型推断，不依赖旧 issueType） */
  function checkFieldFixed(curVal: string, issueType: string, fieldLabel: string, fieldKey: string): boolean {
    if (issueType === '空值') return !!(curVal && curVal !== '-');
    if (issueType === '负值金额') {
      const n = parseFloat(curVal);
      return !isNaN(n) && n >= 0;
    }
    // 用列类型校验
    if (curVal) {
      const res = validateCellByType(curVal, fieldKey, props.inferences);
      return res.valid;
    }
    return true;
  }

  /** 检查某行是否全部修复（包括 localAnomalies） */
  function evaluateRow(rowIndex: number): boolean {
    // 编辑后新发现的异常未修复
    if (localAnomalies[rowIndex] && Object.keys(localAnomalies[rowIndex]).length > 0) return false;
    if (!anomalyRowIndices.has(rowIndex)) return false;
    const ri = props.rowIssues.find(function (r) { return r.rowIndex === rowIndex; });
    if (!ri) return false;
    for (const iss of ri.issues) {
      if (iss.issueType === '负值金额' && dismissedNegativeRows.has(rowIndex)) continue;
      const curVal = getCellVal(rowIndex, iss.fieldKey);
      if (!checkFieldFixed(curVal, iss.issueType, iss.fieldLabel, iss.fieldKey)) return false;
    }
    return true;
  }

  /** 取某行指定字段的异常是否已修复 */
  function isFieldFixed(rowIndex: number, fieldKey: string): boolean {
    // 编辑后校验失败的字段算未修复
    if (localAnomalies[rowIndex]?.[fieldKey]) return false;
    const ri = props.rowIssues.find(function (r) { return r.rowIndex === rowIndex; });
    if (!ri) return true;
    const issuesForField = ri.issues.filter(function (iss) { return iss.fieldKey === fieldKey; });
    if (issuesForField.length === 0) return true;
    const curVal = getCellVal(rowIndex, fieldKey);
    return issuesForField.every(function (iss) { return checkFieldFixed(curVal, iss.issueType, iss.fieldLabel, iss.fieldKey); });
  }

  /** 取某行尚未修复的异常列表（含编辑后新发现的异常） */
  function getUnfixedIssues(rowIndex: number): {
    fieldKey: string;
    fieldLabel: string;
    issueType: string;
    issueReason: string;
    isLocal: boolean;
  }[] {
    const result: {
      fieldKey: string;
      fieldLabel: string;
      issueType: string;
      issueReason: string;
      isLocal: boolean;
    }[] = [];

    // 1. 编辑后校验失败的新异常
    const rowLocal = localAnomalies[rowIndex];
    if (rowLocal) {
      for (const [colKey, msg] of Object.entries(rowLocal)) {
        result.push({ fieldKey: colKey, fieldLabel: colKey, issueType: '格式异常', issueReason: msg, isLocal: true });
      }
    }

    // 2. 旧的 rowIssues 中尚未修复的
    const ri = props.rowIssues.find(function (r) { return r.rowIndex === rowIndex; });
    if (ri) {
      for (const iss of ri.issues) {
        if (iss.issueType === '负值金额' && dismissedNegativeRows.has(rowIndex)) continue;
        const curVal = getCellVal(rowIndex, iss.fieldKey);
        if (!checkFieldFixed(curVal, iss.issueType, iss.fieldLabel, iss.fieldKey)) {
          result.push({ ...iss, isLocal: false });
        }
      }
    }
    return result;
  }

  // 每次 localEdits / localAnomalies 变化后重新评估所有异常行的修复状态
  useEffect(function () {
    setLocalFixed(function (prev) {
      const next = new Set(prev);
      let changed = false;
      // 也检查有 localAnomalies 的行（原本可能不在 rowIssues 里）
      const allRowsToCheck = new Set(props.rowIssues.map(function (r) { return r.rowIndex; }));
      for (const riStr of Object.keys(localAnomalies)) {
        allRowsToCheck.add(Number(riStr));
      }
      for (const rowIndex of allRowsToCheck) {
        const wasFixed = prev.has(rowIndex);
        const nowFixed = evaluateRow(rowIndex);
        if (wasFixed && !nowFixed) { next.delete(rowIndex); changed = true; }
        if (!wasFixed && nowFixed) { next.add(rowIndex); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [localEdits, localAnomalies]);

  function handleStartEdit(rowIndex: number, colKey: string) {
    setEditingCell({ rowIndex, colKey });
    setEditVal(getCellVal(rowIndex, colKey));
  }

  function commitEdit() {
    if (!editingCell) return;
    const { rowIndex, colKey } = editingCell;
    // 只有编辑的是负值金额字段时才取消该行的"负数已确认"状态
    const negFields = negativeFieldKeysByRow.get(rowIndex);
    if (negFields && negFields.has(colKey)) {
      setDismissedNegativeRows(function (prev) { var next = new Set(prev); next.delete(rowIndex); return next; });
    }
    // 值有变化时同步到父组件（双击编辑 / 失焦自动保存）
    if (props.onCellEdit && editVal !== getCellVal(rowIndex, colKey)) {
      props.onCellEdit(rowIndex, colKey, editVal);
    }
    // 深拷贝整个 localEdits 以确保 React 检测变化
    setLocalEdits(function (prev) {
      const next: Record<string, Record<string, string>> = {};
      const rks = Object.keys(prev);
      for (let i = 0; i < rks.length; i++) {
        next[rks[i]] = { ...prev[rks[i]] };
      }
      const rk = String(rowIndex);
      if (!next[rk]) next[rk] = {};
      next[rk] = { ...next[rk], [colKey]: editVal };
      return next;
    });
    setEditingCell(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, colKey: string, colIdx: number) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextColIdx >= 0 && nextColIdx < displayCols.length) {
        const nextCol = displayCols[nextColIdx];
        setEditingCell({ rowIndex, colKey: nextCol.key });
        setEditVal(getCellVal(rowIndex, nextCol.key));
      }
    }
    if (e.key === 'Escape') { setEditingCell(null); }
  }

  function handleSave() {
    if (Object.keys(localEdits).length === 0) return;
    // 同步到父组件 files 状态
    const rks = Object.keys(localEdits);
    for (let i = 0; i < rks.length; i++) {
      const rowIndex = Number(rks[i]);
      const row = localEdits[rks[i]];
      const cks = Object.keys(row);
      for (let j = 0; j < cks.length; j++) {
        if (props.onCellEdit) props.onCellEdit(rowIndex, cks[j], row[cks[j]]);
      }
    }
    setSavedMsg('已保存 ' + rks.length + ' 行修改');
    setTimeout(function () { setSavedMsg(''); }, 3000);
  }

  // 重新检测回调：重置本地状态并重新运行检测
  function handleReAudit() {
    setLocalEdits({});
    setLocalFixed(new Set());
    if (props.onReAudit) props.onReAudit();
  }

  return React.createElement('div', { className: 'fixed inset-0 z-[60] flex items-center justify-center' },
    React.createElement('div', { className: 'absolute inset-0 bg-black/30', onClick: props.onClose }),
    React.createElement('div', { className: 'relative w-[95vw] max-w-[1400px] h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden', style: { animation: 'auditFadeIn 0.2s ease-out' } },
      // 顶部工具栏
      React.createElement('div', { className: 'flex items-center justify-between px-6 py-3.5 border-b border-zinc-200 shrink-0' },
        React.createElement('div', { className: 'flex items-center gap-4' },
          React.createElement('h2', { className: 'text-base font-semibold text-zinc-800' }, '异常数据编辑'),
          React.createElement('span', { className: 'text-xs px-2.5 py-1 rounded-full font-medium ' + (remainingCount > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200') },
            remainingCount > 0 ? remainingCount + ' 行异常' : '全部正常'),
          savedMsg ? React.createElement('span', { className: 'text-xs text-emerald-600 font-medium animate-pulse' }, savedMsg) : null,
        ),
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('button', {
            onClick: function () { setShowAllRows(function (v) { return !v; }); },
            className: 'text-xs px-3 py-1.5 rounded-md border transition-all duration-200 ' + (showAllRows ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'),
          }, showAllRows ? '全部行 ✓' : '仅异常行'),
          React.createElement('button', {
            onClick: function () { setShowAllCols(function (v) { return !v; }); },
            className: 'text-xs px-3 py-1.5 rounded-md border transition-all duration-200 ' + (showAllCols ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'),
          }, showAllCols ? '全部列 ✓' : '仅异常列'),
          React.createElement('button', {
            onClick: handleSave, disabled: Object.keys(localEdits).length === 0,
            className: 'text-xs px-4 py-1.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all duration-200 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed',
          }, '保存修改'),
          convertibleColKeys.length > 0 && !showConvertDialog ? React.createElement('button', {
            onClick: openConvertDialog,
            className: 'text-xs px-3 py-1.5 rounded-md bg-amber-500 text-white font-medium hover:bg-amber-600 transition-all duration-200',
          }, '格式转换') : null,
          props.onReAudit ? React.createElement('button', {
            onClick: handleReAudit,
            className: 'text-xs px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-all duration-200',
          }, '重新检测') : null,
          React.createElement('button', { onClick: props.onClose, className: 'w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors' },
            React.createElement('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
            )
          ),
        ),
      ),
      // 提示栏
      React.createElement('div', { className: 'px-5 py-1.5 bg-blue-50/80 border-b border-blue-100 shrink-0 flex items-center gap-6 text-xs' },
        React.createElement('span', { className: 'text-blue-700' }, '双击单元格编辑 · Tab 切换 · Enter 确认 · Esc 取消'),
        React.createElement('span', { className: 'flex items-center gap-1.5 text-zinc-500' },
          React.createElement('span', { className: 'w-3 h-3 rounded bg-red-200 inline-block' }), '异常字段'),
        React.createElement('span', { className: 'flex items-center gap-1.5 text-zinc-500' },
          React.createElement('span', { className: 'w-3 h-3 rounded bg-emerald-200 inline-block' }), '已修复'),
        React.createElement('span', { className: 'flex items-center gap-1.5 text-zinc-500' },
          React.createElement('span', { className: 'w-3 h-3 rounded bg-blue-200 inline-block' }), '已修改'),
      ),
      // 负数数据提示条（点击展开详情——该行所有列可编辑）
      negativeRows.length > 0 ? React.createElement('div', { className: 'shrink-0 border-b border-amber-200' },
        React.createElement('div', {
          onClick: function () { setShowNegativeDetail(function (v) { return !v; }); },
          className: 'px-5 py-2 bg-amber-50 flex items-center justify-between cursor-pointer hover:bg-amber-100/80 transition-colors',
        },
          React.createElement('span', { className: 'text-xs text-amber-800 font-medium' },
            '检测到 ' + negativeRows.length + ' 行负值数据' + (dismissedNegativeRows.size > 0 ? '（已确认 ' + dismissedNegativeRows.size + ' 行）' : '')),
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'text-[10px] text-amber-500' }, showNegativeDetail ? '收起 ▲' : '展开 ▼'),
            React.createElement('button', {
              onClick: function (e: React.MouseEvent) { e.stopPropagation(); setDismissedNegativeRows(new Set(negativeRows)); },
              className: 'text-xs px-3 py-1 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors',
            }, '全部标记为正常'),
          ),
        ),
        // 展开详情——内联表格形式展示该行所有列，可双击编辑
        showNegativeDetail ? React.createElement('div', { className: 'px-5 py-3 bg-amber-50/60 space-y-2 max-h-[260px] overflow-auto' },
          negativeRows.map(function (rowIndex) {
            var allCols = props.allColumns;
            var negFieldKeys = new Set<string>();
            var nri = props.rowIssues.find(function (r) { return r.rowIndex === rowIndex; });
            if (nri) nri.issues.forEach(function (iss) { if (iss.issueType === '负值金额') negFieldKeys.add(iss.fieldKey); });
            return React.createElement('div', { key: rowIndex, className: 'rounded-lg border ' + (dismissedNegativeRows.has(rowIndex) ? 'bg-blue-50/60 border-blue-200' : 'bg-white border-amber-200') },
              // 行号头
              React.createElement('div', { className: 'flex items-center justify-between px-3 py-1.5 border-b border-inherit bg-inherit rounded-t-lg' },
                React.createElement('span', { className: 'text-[11px] font-semibold ' + (dismissedNegativeRows.has(rowIndex) ? 'text-blue-700' : 'text-amber-700') },
                  '第 ' + (rowIndex + 1) + ' 行'),
                dismissedNegativeRows.has(rowIndex)
                  ? React.createElement('span', { className: 'text-[10px] text-blue-600 font-medium flex items-center gap-1' },
                      React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round' },
                        React.createElement('path', { d: 'M20 6L9 17l-5-5' })),
                      '负数已确认')
                  : React.createElement('button', {
                      onClick: function () { setDismissedNegativeRows(function (prev) { var next = new Set(prev); next.add(rowIndex); return next; }); },
                      className: 'text-[10px] text-amber-600 hover:text-amber-800 underline',
                    }, '确认正常'),
              ),
              // 该行所有列数据展示 - 横向表格（一行数据只占一行）
              React.createElement('div', { className: 'overflow-x-auto' },
                React.createElement('table', { className: 'w-full text-xs border-collapse' },
                  React.createElement('thead', null,
                    React.createElement('tr', null,
                      allCols.map(function (col) {
                        var isNegCol = negFieldKeys.has(col.key);
                        return React.createElement('th', {
                          key: col.key,
                          className: 'text-left px-2 py-1 text-[10px] font-medium ' + (isNegCol && !dismissedNegativeRows.has(rowIndex) ? 'text-red-500' : 'text-zinc-400') + ' border-b border-zinc-200 whitespace-nowrap bg-amber-50/80',
                        }, col.title);
                      }),
                      React.createElement('th', { className: 'px-2 py-1 border-b border-zinc-200 w-[70px] bg-amber-50/80' }),
                    ),
                  ),
                  React.createElement('tbody', null,
                    React.createElement('tr', null,
                      allCols.map(function (col) {
                        var cv = getCellVal(rowIndex, col.key);
                        var isNeg = negFieldKeys.has(col.key);
                        return React.createElement('td', { key: col.key, className: 'px-2 py-1 border-b border-zinc-100 align-middle' },
                          isNeg && !dismissedNegativeRows.has(rowIndex)
                            ? React.createElement('input', {
                                defaultValue: cv,
                                onBlur: function (e: React.FocusEvent<HTMLInputElement>) {
                                  var newVal = e.currentTarget.value;
                                  if (newVal !== cv) {
                                    if (props.onCellEdit) props.onCellEdit(rowIndex, col.key, newVal);
                                    setLocalEdits(function (prev) {
                                      var next = { ...prev };
                                      var rk = String(rowIndex);
                                      if (!next[rk]) next[rk] = {};
                                      next[rk] = { ...next[rk], [col.key]: newVal };
                                      return next;
                                    });
                                  }
                                },
                                className: 'w-full min-w-[60px] text-[11px] border border-red-300 bg-red-50 rounded px-1.5 py-0.5 text-red-700 font-medium outline-none focus:border-blue-400 focus:bg-blue-50 focus:text-blue-700',
                              })
                            : React.createElement('span', { className: 'text-[11px] ' + (isNeg ? 'text-blue-600 font-medium' : 'text-zinc-700') + ' truncate block max-w-[120px]' }, cv || '-'),
                        );
                      }),
                      React.createElement('td', { className: 'px-2 py-1 border-b border-zinc-100 align-middle' },
                        dismissedNegativeRows.has(rowIndex)
                          ? React.createElement('span', { className: 'text-[10px] text-blue-600 font-medium whitespace-nowrap flex items-center gap-1' },
                              React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round' },
                                React.createElement('path', { d: 'M20 6L9 17l-5-5' })),
                              '已确认')
                          : React.createElement('button', {
                              onClick: function () { setDismissedNegativeRows(function (prev) { var next = new Set(prev); next.add(rowIndex); return next; }); },
                              className: 'text-[10px] text-amber-600 hover:text-amber-800 underline whitespace-nowrap',
                            }, '确认正常'),
                      ),
                    ),
                  ),
                ),
              ),
            );
          })
        ) : null,
      ) : null,
      // 数据表格
      React.createElement('div', { className: 'flex-1 overflow-auto' },
        React.createElement('table', { className: 'w-full text-sm border-collapse table-fixed' },
          React.createElement('thead', { className: 'sticky top-0 z-10' },
            React.createElement('tr', { className: 'bg-zinc-50' },
              React.createElement('th', { className: 'text-center text-[11px] font-medium text-zinc-400 px-2 py-2.5 border-b border-zinc-200', style: { width: '52px' } }, '#'),
              displayCols.map(function (c) {
                return React.createElement('th', {
                  key: c.key,
                  className: 'text-center text-[11px] font-medium px-3 py-2.5 border-b border-zinc-200 text-zinc-500',
                }, c.title);
              }),
              React.createElement('th', { className: 'text-left text-[11px] font-medium text-zinc-500 px-3 py-2.5 border-b border-zinc-200', style: { width: '180px' } }, '状态'),
            )
          ),
          React.createElement('tbody', null,
            displayRows.map(function (rowIndex) {
              const ri = props.rowIssues.find(function (r) { return r.rowIndex === rowIndex; });
              const rowIsFixed = localFixed.has(rowIndex);
              const cols = displayCols;

              // 行底色：确认负数但仍有其他异常→微红；确认负数且全修→绿；未确认→红/白
              const hasLocalAnomalyRow = localAnomalies[rowIndex] && Object.keys(localAnomalies[rowIndex]).length > 0;
              var hasAnomaly = ri != null || hasLocalAnomalyRow;
              var hasOtherAnomaly = hasLocalAnomalyRow || (ri && (ri.issues.some(function (iss) { return iss.issueType !== '负值金额'; }) || !ri.issues.every(function (iss) { return iss.issueType === '负值金额' && dismissedNegativeRows.has(rowIndex); })));
              let rowBg = '';
              if (rowIsFixed) rowBg = 'bg-emerald-50/40';
              else if (dismissedNegativeRows.has(rowIndex)) rowBg = hasOtherAnomaly ? 'bg-amber-50/30' : 'bg-blue-50/40';
              else if (ri || hasLocalAnomalyRow) rowBg = 'bg-red-50/20';
              else rowBg = 'bg-white';

              return React.createElement('tr', {
                key: rowIndex,
                className: 'transition-colors duration-200 ' + rowBg,
              },
                // 行号
                React.createElement('td', { className: 'text-center text-[11px] text-zinc-400 px-2 py-1.5 border-b border-zinc-100' },
                  rowIndex + 1),
                // 数据列
                cols.map(function (col, colIdx) {
                  const cellVal = getCellVal(rowIndex, col.key);
                  const isEditing = editingCell && editingCell.rowIndex === rowIndex && editingCell.colKey === col.key;
                  const isAnomalyField = ri && (anomalyFieldsByRow.get(rowIndex) || new Set()).has(col.key);
                  const hasLocalAnomaly = localAnomalies[rowIndex]?.[col.key] !== undefined;
                  const cellFixed = isAnomalyField && isFieldFixed(rowIndex, col.key);
                  const fieldHasAnomaly = hasLocalAnomaly || (isAnomalyField && !cellFixed && !(dismissedNegativeRows.has(rowIndex) && (negativeFieldKeysByRow.get(rowIndex) || new Set()).has(col.key)));
                  const isEdited = localEdits[rowIndex] && localEdits[rowIndex][col.key] !== undefined;

                  if (isEditing) {
                    return React.createElement('td', { key: col.key, className: 'px-1 py-1 border-b border-zinc-200 bg-blue-50' },
                      React.createElement('input', {
                        autoFocus: true, value: editVal,
                        onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setEditVal(e.target.value); },
                        onBlur: commitEdit,
                        onKeyDown: function (e: React.KeyboardEvent) { handleKeyDown(e, rowIndex, col.key, colIdx); },
                        className: 'w-full text-[11px] border border-blue-400 rounded px-1.5 py-0.5 outline-none bg-white shadow-sm',
                      })
                    );
                  }

                  let cellClass = 'text-center text-[11px] px-3 py-2 border-b border-zinc-100 cursor-pointer transition-colors duration-150 ';
                  if (fieldHasAnomaly) {
                    cellClass += 'text-red-600 font-medium bg-red-100/60';
                  } else if (cellFixed) {
                    cellClass += 'text-emerald-600 bg-emerald-50/60';
                  } else if (isEdited) {
                    cellClass += 'text-blue-600 bg-blue-50/60';
                  } else {
                    cellClass += 'text-zinc-600';
                  }

                  return React.createElement('td', {
                    key: col.key,
                    className: cellClass,
                    onDoubleClick: function () { handleStartEdit(rowIndex, col.key); },
                    title: fieldHasAnomaly ? '异常值，双击修改' : isEdited ? '已修改（未保存）' : cellFixed ? '已修复' : '双击编辑',
                  }, cellVal || '-');
                }),
                // 问题列（移到行尾）
                React.createElement('td', { className: 'text-left text-[11px] px-3 py-2 border-b border-zinc-100', style: { width: '200px' } },
                  (function () {
                    var unfixedIssues = getUnfixedIssues(rowIndex);
                    var statusItems: React.ReactNode[] = [];
                    // 全修复→只显示"已处理"
                    if (unfixedIssues.length === 0 && ri) {
                      return React.createElement('span', { className: 'inline-flex items-center gap-1 text-emerald-600 font-medium' },
                        React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round' },
                          React.createElement('path', { d: 'M20 6L9 17l-5-5' })),
                        '已处理',
                      );
                    }
                    // 未修复行：仅显示尚未修复的异常
                    unfixedIssues.forEach(function (iss, ii) {
                      var label = '';
                      if (iss.issueType === '负值金额') {
                        label = (iss.fieldKey === iss.fieldLabel ? iss.fieldLabel : (iss.fieldLabel || iss.fieldKey)) + '为负数';
                      } else if (iss.issueType === '空值') {
                        label = (iss.fieldKey === iss.fieldLabel ? iss.fieldLabel : (iss.fieldLabel || iss.fieldKey)) + '缺失';
                      } else if (iss.issueType === '非法日期' || iss.issueType === '未来日期') {
                        label = (iss.fieldKey === iss.fieldLabel ? iss.fieldLabel : (iss.fieldLabel || iss.fieldKey)) + '日期异常';
                      } else if (iss.issueType === '格式异常') {
                        label = (iss.fieldKey === iss.fieldLabel ? iss.fieldLabel : (iss.fieldLabel || iss.fieldKey)) + iss.issueReason;
                      } else {
                        label = iss.issueType;
                      }
                      statusItems.push(React.createElement('div', { key: 'e-' + ii, className: 'text-red-600 text-[10px] leading-tight' }, label));
                    });
                    // 负数已确认标签
                    if (dismissedNegativeRows.has(rowIndex)) {
                      statusItems.push(React.createElement('span', { key: 'neg-ok', className: 'inline-flex items-center gap-1 text-blue-600 font-medium text-[10px]' },
                        React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round' },
                          React.createElement('path', { d: 'M20 6L9 17l-5-5' })),
                        '负数已确认',
                      ));
                    }
                    if (statusItems.length === 0) {
                      return React.createElement('span', { className: 'text-zinc-300' }, '-');
                    }
                    return React.createElement('div', { className: 'space-y-0.5' },
                      statusItems,
                      ri && ri.issues.some(function (iss) { return iss.issueType === '负值金额'; }) && !dismissedNegativeRows.has(rowIndex)
                        ? React.createElement('button', {
                            onClick: function (e: React.MouseEvent) { e.stopPropagation(); setDismissedNegativeRows(function (prev) { var next = new Set(prev); next.add(rowIndex); return next; }); },
                            className: 'text-[10px] text-blue-600 hover:text-blue-800 underline',
                          }, '✓ 确认正常')
                        : null,
                    );
                  })()
                ),
              );
            })
          )
        )
      ),
      // 格式转换选择弹窗
      showConvertDialog ? React.createElement('div', { className: 'absolute inset-0 z-[70] flex items-center justify-center' },
        React.createElement('div', { className: 'absolute inset-0 bg-black/20', onClick: function () { setShowConvertDialog(false); } }),
        React.createElement('div', { className: 'relative bg-white rounded-xl shadow-2xl border border-zinc-200 w-[400px] p-6' },
          React.createElement('h3', { className: 'text-sm font-semibold text-zinc-800 mb-3' }, '格式转换'),
          React.createElement('p', { className: 'text-xs text-zinc-600 mb-4 leading-relaxed' },
            '检测到以下列存在中文数字格式异常，是否需要转换为数字格式？'),
          React.createElement('div', { className: 'space-y-2 mb-5' },
            Array.from(convertibleMap.entries()).map(function (_a) {
              var fieldKey = _a[0], group = _a[1];
              return React.createElement('label', { key: fieldKey, className: 'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ' + (selectedCols.has(fieldKey) ? 'border-blue-300 bg-blue-50' : 'border-zinc-200 hover:bg-zinc-50') },
                React.createElement('input', {
                  type: 'checkbox', checked: selectedCols.has(fieldKey),
                  onChange: function (e: React.ChangeEvent<HTMLInputElement>) {
                    setSelectedCols(function (prev) { var next = new Set(prev); if (e.target.checked) next.add(fieldKey); else next.delete(fieldKey); return next; });
                  },
                  className: 'rounded border-zinc-300 text-blue-600 focus:ring-blue-500',
                }),
                React.createElement('div', { className: 'flex-1' },
                  React.createElement('div', { className: 'text-xs font-medium text-zinc-700' }, group.fieldLabel + '列' + '（' + group.items.length + ' 行）'),
                  React.createElement('div', { className: 'text-[10px] text-zinc-400 mt-0.5' },
                    group.items.map(function (it) { return it.originalValue; }).join('、')),
                ),
              );
            }),
          ),
          React.createElement('div', { className: 'flex items-center justify-between' },
            React.createElement('button', {
              onClick: function () { setSelectedCols(new Set(convertibleColKeys)); },
              className: 'text-[11px] text-blue-600 hover:text-blue-800 underline',
            }, '全选'),
            React.createElement('div', { className: 'flex items-center gap-2' },
              React.createElement('button', {
                onClick: function () { setShowConvertDialog(false); },
                className: 'px-4 py-2 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors',
              }, '取消'),
              React.createElement('button', {
                onClick: function () { applySelectedConvert(selectedCols); },
                disabled: selectedCols.size === 0,
                className: 'px-4 py-2 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              }, '转换'),
            ),
          ),
        ),
      ) : null,
    )
  );
}

/* ============================================================
   主组件 DataAudit
   ============================================================ */
export default function DataAudit(props: DataAuditProps) {
  const onClose = props.onClose;
  const onReAudit = props.onReAudit;
  const runAuditFn = props.runAuditFn;
  const allRows = props.rows;
  const allColumns = props.columns;

  const [phase, setPhase] = useState<string>('scanning');
  const [scanStep, setScanStep] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [fixResults, setFixResults] = useState<FixResult[] | null>(null);
  const [showEditTable, setShowEditTable] = useState(false);
  // 持久化编辑缓存：保存后不清空，关闭弹窗再打开时数据不丢失
  const [persistedEdits, setPersistedEdits] = useState<Record<string, Record<string, string>>>({});

  // 扫描动画
  useEffect(function () {
    let cancelled = false;
    let stepIdx = 0;
    const fn = runAuditFn;
    function advance() {
      if (cancelled) return;
      if (stepIdx >= SCAN_STEPS.length) { const r = fn(); if (!cancelled) { setReport(r); setPhase('done'); } return; }
      stepIdx++; setScanStep(stepIdx);
      if (stepIdx >= SCAN_STEPS.length) { setTimeout(function () { if (cancelled) return; const r = fn(); setReport(r); setPhase('done'); }, STEP_MS); return; }
      setTimeout(advance, STEP_MS);
    }
    setTimeout(advance, 300);
    return function () { cancelled = true; };
  }, [phase]);

  // 重新检测：委托父组件用最新数据重建 auditReport
  function handleFullReAudit() {
    if (props.onReAudit) {
      setPersistedEdits({});
      setPhase('scanning');
      setScanStep(0);
      setReport(null);
      setFixResults(null);
      setShowEditTable(false);
      props.onReAudit();
    }
  }

  // 按行聚合（主组件用）
  const rowIssues = useMemo(function () {
    if (!report) return [];
    return buildRowIssues(report, allRows, allColumns);
  }, [report, allRows, allColumns]);

  // 根据 persistedEdits 计算已修复的行
  const fixedRowSet = useMemo(function () {
    const fixed = new Set<number>();
    for (const ri of rowIssues) {
      let allOk = true;
      for (const iss of ri.issues) {
        const editedRow = persistedEdits[ri.rowIndex];
        const curVal = (editedRow && editedRow[iss.fieldKey] !== undefined) ? editedRow[iss.fieldKey] : String(allRows[ri.rowIndex]?.[iss.fieldKey] ?? '');
        if (iss.issueType === '空值') {
          if (!curVal || curVal === '-') { allOk = false; break; }
          continue;
        }
        if (iss.issueType === '负值金额') {
          const n = parseFloat(curVal);
          if (isNaN(n) || n < 0) { allOk = false; break; }
          continue;
        }
        // 使用列类型校验
        const res = validateCellByType(curVal, iss.fieldKey, props.inferences);
        if (!res.valid) { allOk = false; break; }
      }
      if (allOk) fixed.add(ri.rowIndex);
    }
    return fixed;
  }, [rowIssues, persistedEdits, allColumns, allRows, props.inferences]);

  // 过滤掉已修复的行，用于报告面板展示
  const displayRowIssues = useMemo(function () {
    return rowIssues.filter(function (ri) { return !fixedRowSet.has(ri.rowIndex); });
  }, [rowIssues, fixedRowSet]);

  function handleSaveAll(editedRows: Record<string, Record<string, string>>) {
    // 合并到持久化缓存
    setPersistedEdits(function (prev) {
      const next = { ...prev };
      const rks = Object.keys(editedRows);
      for (let i = 0; i < rks.length; i++) {
        if (next[rks[i]]) {
          next[rks[i]] = { ...next[rks[i]], ...editedRows[rks[i]] };
        } else {
          next[rks[i]] = { ...editedRows[rks[i]] };
        }
      }
      return next;
    });
    // 写入 files
    const rks = Object.keys(editedRows);
    for (let i = 0; i < rks.length; i++) {
      const row = editedRows[rks[i]];
      const cks = Object.keys(row);
      const rowIndex = Number(rks[i]);
      for (let j = 0; j < cks.length; j++) {
        if (props.onCellEdit) props.onCellEdit(rowIndex, cks[j], row[cks[j]]);
      }
    }
  }

  // ===== 扫描中 =====
  if (phase === 'scanning') {
    const scanChildren: React.ReactNode[] = [];
    scanChildren.push(React.createElement('div', { key: 'hdr', className: 'flex items-center gap-1.5 mb-3' },
      React.createElement('div', { className: 'w-1 h-3.5 rounded-full bg-blue-400' }),
      React.createElement('span', { className: 'text-xs font-semibold text-blue-600' }, '数据体检中')
    ));
    for (let si = 0; si < SCAN_STEPS.length; si++) {
      const isDone = si < scanStep;
      const isCurrent = si === scanStep;
      scanChildren.push(
        React.createElement('div', { key: SCAN_STEPS[si], className: 'flex items-center gap-2.5 px-2 py-1.5' },
          React.createElement('div', { className: 'shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-medium border transition-all duration-300 ' +
            (isDone ? 'bg-emerald-500 text-white border-emerald-500' : isCurrent ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]' : 'bg-zinc-100 text-zinc-400 border-zinc-200') },
            isDone ? React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '3', strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M20 6L9 17l-5-5' })) :
            isCurrent ? React.createElement('svg', { className: 'animate-spin', width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }, React.createElement('path', { d: 'M12 2a10 10 0 1010 10' })) :
            React.createElement('span', null, String(si + 1))
          ),
          React.createElement('span', { className: 'text-xs ' + (isCurrent ? 'text-blue-700 font-medium' : isDone ? 'text-zinc-500' : 'text-zinc-400') }, SCAN_STEPS[si])
        )
      );
    }
    return React.createElement('div', { className: 'fixed inset-0 z-50 flex justify-end' },
      React.createElement('div', { className: 'absolute inset-0 bg-black/20', onClick: onClose }),
      React.createElement('div', { className: 'relative w-[420px] max-w-full h-full bg-white shadow-2xl flex flex-col overflow-hidden', style: { animation: 'auditSlideIn 0.25s ease-out' } },
        React.createElement('div', { className: 'flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 shrink-0' },
          React.createElement('div', { className: 'flex items-center gap-2.5' },
            React.createElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'text-blue-600' }, React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })),
            React.createElement('h2', { className: 'text-sm font-semibold text-zinc-800' }, '正在检测...')
          ),
          React.createElement('button', { onClick: onClose, className: 'w-7 h-7 rounded-md hover:bg-zinc-100 flex items-center justify-center text-zinc-400' },
            React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M18 6L6 18M6 6l12 12' }))
          )
        ),
        React.createElement('div', { className: 'flex-1 overflow-auto px-5 py-4' }, scanChildren),
        React.createElement('div', { className: 'flex items-center justify-center gap-2 px-5 py-3 border-t border-zinc-200 shrink-0 text-xs text-zinc-400' },
          React.createElement('svg', { className: 'animate-spin', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }, React.createElement('path', { d: 'M12 2a10 10 0 1010 10' })),
          '正在分析数据，请稍候...'
        )
      )
    );
  }

  // ===== 报告 =====
  if (!report) return null;
  const stats = report.stats;

  const contentChildren: React.ReactNode[] = [];
  contentChildren.push(React.createElement(StatGrid, { key: 'statgrid', stats: stats }));

  // 按行聚合异常列表
  if (displayRowIssues.length > 0) {
    const PREVIEW_MAX = 5;
    const displayRows = displayRowIssues.slice(0, PREVIEW_MAX);
    const hasMore = displayRowIssues.length > PREVIEW_MAX;
    const rowItems: React.ReactNode[] = [];
    for (let rii = 0; rii < displayRows.length; rii++) {
      const ri = displayRows[rii];
      const sev = getSeverity(ri.issues.length);
      const colors = severityColors[sev];
      rowItems.push(React.createElement('div', {
        key: ri.rowIndex,
        onClick: function () { setShowEditTable(true); },
        className: 'flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity',
        style: { backgroundColor: colors.dot + '12', border: '1px solid ' + colors.dot + '25' },
      },
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('span', { className: 'w-2 h-2 rounded-full', style: { backgroundColor: colors.dot } }),
          React.createElement('span', { className: 'text-xs font-medium text-zinc-700' }, '第' + (ri.rowIndex + 1) + '行（' + ri.label + '）'),
          React.createElement('span', { className: 'text-[11px] text-zinc-500' }, ri.issues.length + ' 个问题')
        ),
        React.createElement('div', { className: 'flex items-center gap-1.5' },
          React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded border ' + colors.badgeBg + ' ' + colors.badge }, severityLabels[sev]),
          React.createElement('span', { className: 'text-[11px] text-zinc-400' }, '查看 →'),
        ),
      ));
    }
    contentChildren.push(React.createElement('div', { key: 'issuehdr', className: 'flex items-center gap-1.5' },
      React.createElement('div', { className: 'w-1 h-3.5 rounded-full bg-red-400' }),
      React.createElement('span', { className: 'text-xs font-semibold text-zinc-600' }, '异常行'),
    ));
    contentChildren.push(React.createElement('div', { key: 'issuelist', className: 'space-y-1.5' }, rowItems));
    if (hasMore) {
      contentChildren.push(React.createElement('button', {
        key: 'viewall',
        onClick: function () { setShowEditTable(true); },
        className: 'w-full mt-1 py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 rounded-lg transition-colors',
      }, '查看全部 ' + displayRowIssues.length + ' 行 →'));
    }
  } else {
    contentChildren.push(React.createElement('div', { key: 'clean', className: 'px-3 py-4 rounded-lg bg-emerald-50 border border-emerald-100' },
      React.createElement('p', { className: 'text-xs text-emerald-700 text-center font-medium' }, '未发现数据异常'),
    ));
  }

  if (fixResults && fixResults.length > 0) {
    const frChildren: React.ReactNode[] = [];
    frChildren.push(React.createElement('div', { key: 'frh', className: 'flex items-center gap-1.5 mb-2.5' },
      React.createElement('div', { className: 'w-1 h-3.5 rounded-full bg-emerald-400' }),
      React.createElement('span', { className: 'text-xs font-semibold text-emerald-700' }, '修复结果')
    ));
    for (let fri = 0; fri < fixResults.length; fri++) {
      const fr = fixResults[fri];
      frChildren.push(React.createElement('div', { key: 'fr-' + fri, className: 'flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100' },
        React.createElement('span', { className: 'text-xs text-emerald-700' }, fr.message),
        React.createElement('span', { className: 'text-[10px] text-emerald-600 font-medium' }, fr.fixedCount + ' 条'),
      ));
    }
    contentChildren.push(React.createElement('div', { key: 'fixres', className: 'mt-3' }, frChildren));
  }

  return React.createElement('div', { className: 'fixed inset-0 z-50 flex justify-end' },
    React.createElement('div', { className: 'absolute inset-0 bg-black/20', onClick: onClose }),
    React.createElement('div', { className: 'relative w-[420px] max-w-full h-full bg-white shadow-2xl flex flex-col overflow-hidden', style: { animation: 'auditSlideIn 0.25s ease-out' } },
      React.createElement('div', { className: 'flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 shrink-0' },
        React.createElement('div', { className: 'flex items-center gap-2.5' },
          React.createElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round', className: 'text-blue-600' }, React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })),
          React.createElement('h2', { className: 'text-sm font-semibold text-zinc-800' }, '数据质量报告'),
          rowIssues.length > 0 ? React.createElement('span', { className: 'text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium' }, String(displayRowIssues.length) + ' 行异常') : null,
        ),
        React.createElement('div', { className: 'flex items-center gap-2' },
          onReAudit ? React.createElement('button', { onClick: handleFullReAudit, className: 'text-xs px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors' }, '重新检测') : null,
          fixResults && fixResults.length > 0 ? React.createElement('button', { onClick: onClose, className: 'text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors' }, '完成') : null,
          React.createElement('button', { onClick: onClose, className: 'w-7 h-7 rounded-md hover:bg-zinc-100 flex items-center justify-center text-zinc-400' },
            React.createElement('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M18 6L6 18M6 6l12 12' }))
          )
        )
      ),
      React.createElement('div', { className: 'flex-1 overflow-auto px-5 py-4 space-y-4' }, contentChildren),
      fixResults && fixResults.length > 0 ? React.createElement('div', { className: 'px-5 py-3 border-t border-zinc-200 shrink-0' },
        React.createElement('p', { className: 'text-xs text-zinc-500 text-center' }, '修复完成，结果已输出到结果预览区')
      ) : React.createElement('div', { className: 'flex items-center gap-2 px-5 py-3 border-t border-zinc-200 shrink-0' },
        React.createElement('button', { onClick: function () { setShowEditTable(true); }, className: 'flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors' }, '异常管理'),
        React.createElement('button', { onClick: onClose, className: 'px-4 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-50 transition-colors' }, '关闭')
      )
    ),
    showEditTable ? React.createElement(AnomalyEditTable, {
      allRows: allRows, allColumns: allColumns, rowIssues: rowIssues,
      persistedEdits: persistedEdits,
      inferences: props.inferences,
      onSaveAll: handleSaveAll,
      onClose: function () { setShowEditTable(false); },
      onCellEdit: function (rowIndex: number, colKey: string, newValue: string) {
        // 更新持久缓存，关闭再打开数据不丢失
        setPersistedEdits(function (prev) {
          const next = { ...prev };
          const rk = String(rowIndex);
          if (!next[rk]) next[rk] = {};
          next[rk] = { ...next[rk], [colKey]: newValue };
          return next;
        });
        // 同步到父组件 files 状态
        if (props.onCellEdit) props.onCellEdit(rowIndex, colKey, newValue);
      },
}) : null
  );
}