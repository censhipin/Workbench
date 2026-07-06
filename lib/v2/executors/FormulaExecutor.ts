// ============================================================
// FormulaExecutor — 公式计算执行器
// ============================================================
// 支持：
//   - + - * / 四则运算（两列或常量）
//   - ROUND(列, 小数位)
//   - ABS(列)
//   - SUM(列) — 对多列求和
//   - AVG(列) — 对多列求平均
//   - IF(条件, 真值, 假值) — 条件判断
//   - LEFT/RIGHT/MID/LEN — 文本函数
//   - YEAR/MONTH/DAY/TODAY/DATEDIF — 日期函数
// ============================================================

import type { ColumnDef, RowData } from '@/lib/types';
import type { OperationExecutor, ExecutionContext, ExecutorResult } from './types';
import type { ExecutionPlan } from '../execution-plan';
import { evaluateCondition } from '../predicate';
import { Operator } from '../types';

export class FormulaExecutor implements OperationExecutor {
  readonly type = 'formula';

  execute(plan: ExecutionPlan, ctx: ExecutionContext): ExecutorResult {
    if (plan.type !== 'formula') {
      throw new Error(`FormulaExecutor 收到错误 type: ${plan.type}`);
    }

    const { targetColumn, sourceColumns, expressionType, decimalPlaces, constantOperand } = plan;
    const inputColumns = ctx.mainSheet.columns;
    const inputRows = ctx.mainSheet.rows;

    // 确定目标列的 title：如果已存在则沿用，否则生成新列名
    var targetTitle = targetColumn;
    var existingCol = inputColumns.find(function (c) { return c.key === targetColumn; });
    if (existingCol) {
      targetTitle = existingCol.title;
    }

    var resultRows = inputRows.map(function (row, _idx) {
      var rawComputed = computeCell(plan, row, sourceColumns, expressionType, decimalPlaces, inputRows);
      var computedValue = rawComputed;
      // 如果有小数位限制，统一应用四舍五入（对所有类型的结果）
      if (decimalPlaces !== undefined && computedValue !== null && typeof computedValue === 'number') {
        var factor = Math.pow(10, decimalPlaces);
        computedValue = Math.round(computedValue * factor) / factor;
      }
      // 如果有常量操作数，将常量参与运算
      if (constantOperand !== undefined && computedValue !== null && typeof computedValue === 'number') {
        switch (expressionType) {
          case '+': computedValue = computedValue + constantOperand; break;
          case '-': computedValue = computedValue - constantOperand; break;
          case '*': computedValue = computedValue * constantOperand; break;
          case '/': computedValue = constantOperand !== 0 ? computedValue / constantOperand : 0; break;
        }
      }
      // 常量运算后再应用小数位限制
      if (decimalPlaces !== undefined && computedValue !== null && typeof computedValue === 'number') {
        var factor = Math.pow(10, decimalPlaces);
        computedValue = Math.round(computedValue * factor) / factor;
      }
      return { ...row, [targetColumn]: computedValue };
    });

    var resultColumns: ColumnDef[];
    if (existingCol) {
      resultColumns = inputColumns;
    } else {
      // 新增列
      var newCol: ColumnDef = { key: targetColumn, title: targetTitle, type: 'number' };
      // 插入到源列之后
      var insertAfter = sourceColumns[sourceColumns.length - 1];
      var insertIdx = inputColumns.length;
      for (var i = 0; i < inputColumns.length; i++) {
        if (inputColumns[i].key === insertAfter) { insertIdx = i + 1; break; }
      }
      resultColumns = inputColumns.slice();
      resultColumns.splice(insertIdx, 0, newCol);
    }

    return {
      result: { columns: resultColumns, rows: resultRows },
      summary: {
        totalRecords: resultRows.length,
        beforeCount: inputRows.length,
        afterCount: resultRows.length,
        modifiedCount: inputRows.length,
      },
    };
  }
}

/** 逐行计算结果 */

/** Parse date from Excel serial number or string */
function parseDateValue(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && value > 59 && value < 2000000) {
    var excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  var str = String(value).trim();
  var m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var m2 = str.match(/^(\d{4})[\u5e74](\d{1,2})[\u6708](\d{1,2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  return null;
}
function computeCell(plan: ExecutionPlan,
  row: RowData,
  sourceColumns: string[],
  expressionType: string,
  decimalPlaces?: number,
  allRows?: RowData[],
): number | string | null {
  // 文本函数直接从行读取原始字符串值（不做 Number 强制转换）
  if (expressionType === 'LEFT') {
    var rawText = row[sourceColumns[0]];
    var text = rawText == null ? '' : String(rawText);
    var fp = plan as any;
    return text.slice(0, fp.charCount || 1);
  }
  if (expressionType === 'RIGHT') {
    var rawText2 = row[sourceColumns[0]];
    var text2 = rawText2 == null ? '' : String(rawText2);
    var fp2 = plan as any;
    return text2.slice(-(fp2.charCount || 1));
  }
  if (expressionType === 'MID') {
    var rawText3 = row[sourceColumns[0]];
    var text3 = rawText3 == null ? '' : String(rawText3);
    var fp3 = plan as any;
    var start = (fp3.startPos || 1) - 1;
    return text3.slice(start, start + (fp3.charCount || text3.length));
  }
  if (expressionType === 'LEN') {
    var rawText4 = row[sourceColumns[0]];
    return rawText4 == null ? 0 : String(rawText4).length;
  }

  // 日期函数直接从行读取原始值
  if (expressionType === 'YEAR' || expressionType === 'MONTH' || expressionType === 'DAY' || expressionType === 'DATEDIF') {
    var d1 = parseDateValue(row[sourceColumns[0]]);
    if (expressionType === 'YEAR') return d1 ? d1.getFullYear() : null;
    if (expressionType === 'MONTH') return d1 ? d1.getMonth() + 1 : null;
    if (expressionType === 'DAY') return d1 ? d1.getDate() : null;
    if (expressionType === 'DATEDIF') {
      var d2 = parseDateValue(row[sourceColumns[1] != null ? sourceColumns[1] : sourceColumns[0]]);
      if (!d1 || !d2) return null;
      var days = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      return Math.floor(days / 365);
    }
  }

  // TODAY 不需要任何列值
  if (expressionType === 'TODAY') {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  // SUMIF/COUNTIF/AVERAGEIF — 条件聚合（全局扫描，每行赋相同值）
  if (expressionType === 'SUMIF' || expressionType === 'COUNTIF' || expressionType === 'AVERAGEIF') {
    if (!allRows) return null;
    var fp = plan as any;
    var condCol = fp.conditionColumn || sourceColumns[0] || '';
    var condOp = (fp.conditionOperator || '=') as string;
    var condVal = fp.conditionValue ?? 0;
    var valueCol = sourceColumns[0] || condCol;

    var opMap: Record<string, Operator> = {
      '>': Operator.GT, '>=': Operator.GTE, '<': Operator.LT, '<=': Operator.LTE,
      '=': Operator.EQ, '!=': Operator.NE,
    };
    var op = opMap[condOp] || Operator.EQ;

    var matched: number[] = [];
    for (var _r = 0; _r < allRows.length; _r++) {
      var _row = allRows[_r];
      if (evaluateCondition(_row[condCol], op, condVal)) {
        var v = Number(_row[valueCol]);
        if (!isNaN(v)) matched.push(v);
      }
    }

    if (expressionType === 'COUNTIF') return matched.length;
    if (matched.length === 0) return 0;
    if (expressionType === 'SUMIF') return matched.reduce(function (a, b) { return a + b; }, 0);
    if (expressionType === 'AVERAGEIF') return matched.reduce(function (a, b) { return a + b; }, 0) / matched.length;
  }

  // 数值计算使用 Number 转换
  var values = sourceColumns.map(function (key) {
    var v = row[key];
    if (v == null || v === '') return 0;
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  });

  var result: number;

  switch (expressionType) {
    case '+':
      result = values.reduce(function (a, b) { return a + b; }, 0);
      break;
    case '-':
      if (values.length < 2) result = values[0] || 0;
      else result = values[0] - values.slice(1).reduce(function (a, b) { return a + b; }, 0);
      break;
    case '*':
      result = values.reduce(function (a, b) { return a * b; }, 1);
      break;
    case '/':
      // 任一除数为 0 则结果为 Infinity，不静默置 0
      result = values.slice(1).some(function (v) { return v === 0; }) ? Infinity : values.reduce(function (a, b) { return a / b; });
      break;
    case 'ROUND': {
      var raw = values[0] || 0;
      var places = decimalPlaces ?? 0;
      var factor = Math.pow(10, places);
      result = Math.round(raw * factor) / factor;
      break;
    }
    case 'ABS':
      result = Math.abs(values[0] || 0);
      break;
    case 'SUM':
      result = values.reduce(function (a, b) { return a + b; }, 0);
      break;
    case 'AVG': {
      var sum = values.reduce(function (a, b) { return a + b; }, 0);
      result = values.length > 0 ? sum / values.length : 0;
      break;
    }
    case 'IF':
      var fp = plan as any; var cv = row[fp.conditionColumn||'']; var condOp2 = fp.conditionOperator||'='; var val = fp.conditionValue; var opMap: Record<string, Operator> = {">": Operator.GT,"<": Operator.LT,">=": Operator.GTE,"<=": Operator.LTE,"=": Operator.EQ,"!=": Operator.NE}; var met = evaluateCondition(cv, opMap[condOp2]||Operator.EQ, val); var tv = fp.trueValue, fv = fp.falseValue; if (met) { var tn = Number(tv); return isNaN(tn) ? String(tv) : tn; } else { var fn = Number(fv); return isNaN(fn) ? String(fv) : fn; }
    default:
      result = 0;
  }

  // 处理浮点精度
  if (Number.isFinite(result)) {
    return Math.round(result * 1e10) / 1e10;
  }
  return result;
}
