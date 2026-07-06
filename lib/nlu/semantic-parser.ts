// ============================================================
// Semantic Task Parser — 语义任务解析器
// ============================================================
// 职责：将用户原始文本解析为语义化的 TaskIntent
//   - 操作识别（最高优先级执行）
//   - 根据操作类型分发到对应解析器
//   - formula/update 不走 column resolver
// ============================================================

import { ColumnDef, TaskIntent, Operation, type RowData } from '../types';
import type { AggregationType, FilterCondition } from './types';
import { tokenize } from './tokenizer';
import { IntentLexicon } from './intent-lexicon';
import { SemanticInterpreter, type SemanticCondition } from './semantic-interpreter';
import { DEFAULT_CONCEPT_REGISTRY } from './types';
import type { TaskPlan } from './taskplan-types';

/* =========================== SemanticTaskParser 接口 =========================== */

export interface SemanticTaskParser {
  parse(
    prompt: string,
    availableColumns: ColumnDef[],
    fileNames: string[],
    rows?: Record<string, string | number | null>[],
  ): TaskIntent;
}

/* =========================== 基于规则的语义实现 =========================== */

/** 中文数字转阿拉伯数字（支持"一万五""十五""三千二"等常见格式） */
function chineseNumberToArabic(text: string): number | null {
  const cleaned = text.replace(/[约大概超过多]/g, '').trim();
  const chnNum = ['零','一','二','三','四','五','六','七','八','九'];
  const unitMap: Record<string, number> = { '十': 10, '百': 100, '千': 1000, '万': 10000, '亿': 100000000 };

  const pureNum = parseInt(cleaned, 10);
  if (!isNaN(pureNum)) return pureNum;

  let num = 0, result = 0;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const c = cleaned[i];
    const u = unitMap[c];
    if (u) {
      if (num === 0) num = 1;
      result += num * u;
      num = 0;
    } else {
      const idx = chnNum.indexOf(c);
      if (idx >= 0) num = idx;
    }
  }
  if (num > 0) result += num;
  if (cleaned === '十') result = 10;
  if (cleaned === '百') result = 100;
  if (cleaned === '千') result = 1000;
  return result > 0 ? result : null;
}

/** 操作检测结果 */
interface OperationDetection {
  operation: string | null;
  confidence: number;
}

/** 提取管线中间结果 */
interface ParsedCondition {
  columnHint?: string;
  operator: string;
  value: string | number;
  isValueOnly: boolean;
  /** 逻辑连接词，仅在不是第一个条件时有效 */
  logic?: 'AND' | 'OR';
}

/** 连接词正则（用于 pipeline 分割） */
const CONNECTOR_RE = /(?:再|然后|之后|接着|随后|再按|再根据)/;

export class RuleBasedSemanticParser implements SemanticTaskParser {
  private lexicon: IntentLexicon;
  private interpreter: SemanticInterpreter;

  constructor(lexicon?: IntentLexicon, interpreter?: SemanticInterpreter) {
    this.lexicon = lexicon ?? new IntentLexicon();
    this.interpreter = interpreter ?? new SemanticInterpreter();
  }

  parse(prompt: string, availableColumns: ColumnDef[], fileNames: string[], rows?: Record<string, string | number | null>[]): TaskIntent {
    const lower = prompt.toLowerCase();

    // ── Step 0: 检查是否是 pipeline（含连接词的多步操作） ──
    if (CONNECTOR_RE.test(lower)) {
      const steps = this.parsePipelineSteps(prompt, availableColumns, rows);
      if (steps.length >= 2) {
        return {
          operation: 'pipeline' as Operation,
          target: '',
          targetColumns: [],
          resolvedColumns: undefined,
          scope: 'all',
          steps,
          params: {},
          targetFiles: fileNames,
          rawPrompt: prompt,
          confidence: 0.9,
        };
      }
    }

    // ── Step 1: 操作识别（最高优先级） ──
    const detected = this.detectOperation(prompt, lower, availableColumns);

    // ── Step 2: 根据操作进入对应解析器 ──
    if (detected.operation === 'formula') {
      return this.parseFormulaIntent(prompt, lower, availableColumns, fileNames);
    }

    if (detected.operation === 'update') {
      return this.parseUpdateIntent(prompt, lower, availableColumns, fileNames);
    }

    // ── 其它操作：走标准流程 ──
    return this.parseStandardIntent(prompt, lower, availableColumns, fileNames, detected, rows);
  }

  // ================================================================
  //  1. Operation Detection — 最高优先级，先于任何 column resolve
  // ================================================================

  /**
   * 检测操作类型，返回 operation + confidence
   * 最高优先级执行，不依赖 column resolver
   */
  public detectOperation(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[]
  ): OperationDetection {
    // ── formula 检测 ──
    const formulaResult = this.detectFormula(prompt, lower);
    if (formulaResult.operation) return formulaResult;

    // ── update 检测 ──
    const updateResult = this.detectUpdate(lower);
    if (updateResult.operation) return updateResult;

    // ── projection 检测（"只看" -> 列选择，不是筛选） ──
    const projectionResult = this.detectProjection(prompt, lower);
    if (projectionResult.operation) return projectionResult;

    // ── 其它操作：依赖 lexicon ──
    const columnTitles = availableColumns.map(c => c.title).filter(Boolean);
    const operationTerms = this.lexicon.getOperations()
      .flatMap(op => this.lexicon.getSynonyms(op))
      .filter(s => s.length >= 2);
    const extraLexicon = [...new Set([...columnTitles, ...operationTerms])];
    const tokenized = tokenize(prompt, extraLexicon);
    const identified = this.lexicon.identifyOperation(tokenized.keywords);

    if (identified.operation) {
      return { operation: identified.operation, confidence: identified.confidence };
    }

    // ── 隐式 filter 检测：包含比较运算符或值匹配 ──
    // 即使没有显式"筛选"关键词，如果包含 > < >= <= != = 等比较符
    // 或包含列值特征 → 视为 filter
    if (/[><=]/.test(prompt) || /大于|小于|高于|低于|等于/.test(lower)) {
      return { operation: 'filter', confidence: 0.6 };
    }
    // 纯词且是已知列的值 → 视为 filter
    if (availableColumns.length > 0 && lower.length >= 2 && lower.length <= 8) {
      return { operation: 'filter', confidence: 0.5 };
    }

    return { operation: null, confidence: 0 };
  }

  /** 检测 formula 操作 */
  private detectFormula(prompt: string, lower: string): OperationDetection {
    // formula 关键词表（仅语法结构关键词）
    const formulaKeywords = [
      '新增列', '增加列', '创建列', '计算列', '生成列', '新列',
      '公式', '乘以', '除以', '加上', '减去',
      '×', '÷', '*',
    ];

    // 如果/若/当...则/就 → IF 公式
    if (/如果|若|当/.test(lower) && /则|就|否则|不然/.test(lower)) {
      return { operation: 'formula', confidence: 0.95 };
    }
    if (/如果|若|当/.test(lower) && /大于|小于|等于/.test(lower)) {
      return { operation: 'formula', confidence: 0.9 };
    }

    // 以"新增/添加/增加/新/创建/生成"开头且含"列"字
    if (/^(?:新增|添加|增加|新|创建|生成).*列/.test(lower)) {
      return { operation: 'formula', confidence: 0.9 };
    }

    // 含 = 号（排除 >=、<=、!=、== 等比较运算符）
    // 只有独立 = 号（前后都不是 =、>、<、!）才视为 formula
    if (/[^=><!]=(?!=)/.test(prompt) || /^=(?!=)/.test(prompt)) {
      return { operation: 'formula', confidence: 0.85 };
    }

    // 含 formula 关键词
    for (const kw of formulaKeywords) {
      if (lower.includes(kw)) {
        return { operation: 'formula', confidence: 0.8 };
      }
    }

    return { operation: null, confidence: 0 };
  }

  /** 检测 update 操作 */
  private detectUpdate(lower: string): OperationDetection {
    const updateKeywords = [
      '改成', '修改为', '替换为', '替换成',
      '填充', '填写', '填为', '填入', '填上',
      '更新', '更新为',
      '全部改成', '全部改为', '都改成', '都改为',
      '批量修改', '批量更新', '批量替换',
    ];

    // 以"将"开头且含"改成/修改为/替换为/填充"等
    if (/^将/.test(lower) && /(?:改成|修改为|替换为|替换成|填充|更新为)/.test(lower)) {
      return { operation: 'update', confidence: 0.9 };
    }

    for (const kw of updateKeywords) {
      if (lower.includes(kw)) {
        return { operation: 'update', confidence: 0.85 };
      }
    }

    return { operation: null, confidence: 0 };
  }

  /** 检测 projection 操作（"只看姓名和岗位"、"只保留姓名列"等列选择） */
  private detectProjection(prompt: string, lower: string): OperationDetection {
    if (lower.includes('只看') || lower.includes('只保留') || lower.includes('只显示')) {
      // 必须后面跟着列名（与筛选区分），检查是否包含"和/与/、"等连接词
      const projectionMatch = lower.match(/(?:只看|只保留|只显示)\s*(.+?)(?:$|，|,|然后|再|之后)/);
      if (projectionMatch) {
        const rest = projectionMatch[1].trim();
        // 如果 rest 包含列名特征词（如"姓名"/"岗位"等中文词且不含比较运算符），视为列选择
        // 区别于"只保留金额大于10000的"这种筛选
        if (!/[><=大于小于等于]/.test(rest) && rest.length >= 2) {
          return { operation: 'select', confidence: 0.85 };
        }
      }
      // fallback: 只要 prompt 含"只看/只保留/只显示"且不含比较运算符，保守认为 select
      if (!/[><=大于小于等于]/.test(prompt)) {
        return { operation: 'select', confidence: 0.75 };
      }
    }
    return { operation: null, confidence: 0 };
  }

  // ================================================================
  //  2.  Formula Parser — 不执行 column resolver
  // ================================================================

  /**
   * 解析 formula 意图
   * 输入："新增一列金额，计算每个产品的总金额"
   * 输出：TaskIntent { operation: 'formula', target: '金额', params: { targetColumn, expression, ... } }
   *
   * 不走 resolveColumn()
   */
  public parseFormulaIntent(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[],
    fileNames: string[]
  ): TaskIntent {
    const params: Record<string, unknown> = {};

    // Step 1: 提取目标列名
    const targetColumn = this.extractFormulaTargetColumn(prompt, lower);
    params.targetColumn = targetColumn;

    // Step 2: 推断表达式
    const expression = this.inferFormulaExpression(prompt, lower, availableColumns, targetColumn);

    // Step 2b: 检测复合公式（多个不同运算符），拆解为 pipeline
    const compoundSteps = this.detectCompoundFormula(prompt, lower, availableColumns, targetColumn);
    if (compoundSteps && compoundSteps.length >= 2) {
      console.log('===== LAYER 1: Rule Parser — Compound Formula (pipeline decomposed) =====');
      return {
        operation: 'pipeline' as Operation,
        target: targetColumn,
        targetColumns: [],
        resolvedColumns: undefined,
        scope: 'all',
        params: {},
        steps: compoundSteps,
        targetFiles: fileNames,
        rawPrompt: prompt,
        confidence: 0.85,
      };
    }
    console.log('===== LAYER 1: Rule Parser =====');
    console.log('TaskIntent:');
    console.log('  operation:', 'formula');
    console.log('  targetColumn:', targetColumn);
    if (expression) {
      console.log('  expression type:', expression.expressionType);
      console.log('  source columns:', expression.columns);
      console.log('  expression desc:', expression.description);
      console.log('  constantOperand:', expression.constantOperand);
    } else {
      console.log('  expression: null (no expression inferred)');
    }
    if (expression) {
      params.expressionType = expression.expressionType;
      params.sourceColumnHints = expression.columns;
      params.expression = expression.description;
      if (expression.constantOperand !== undefined) {
        params.constantOperand = expression.constantOperand;
      }
    }

    // Step 3: 检测 IF 条件（优先于 ROUND/ABS）
    const ifResult = this.detectIfCondition(prompt, lower, availableColumns);
    if (ifResult) {
      params.expressionType = 'IF';
      params.sourceColumnHints = ifResult.sourceColumns;
      params.expression = ifResult.description;
      params.conditionColumnHint = ifResult.conditionColumnHint;
      params.conditionOperator = ifResult.conditionOperator;
      params.conditionValue = ifResult.conditionValue;
      params.trueValue = ifResult.trueValue;
      params.falseValue = ifResult.falseValue;
      // 清除 Step 2 可能误设的 constantOperand（如金额*2000 中的 2000）
      delete params.constantOperand;
    }

    // Step 4: 检测 ROUND/ABS 等单列函数
    if (lower.includes('保留') || lower.includes('四舍五入')) {
      params.expressionType = 'ROUND';
      params.decimalPlaces = this.extractDecimalPlaces(lower);
    }
    if (lower.includes('绝对值')) {
      params.expressionType = 'ABS';
    }

    return {
      operation: 'formula' as Operation,
      target: targetColumn,
      targetColumns: [],
      resolvedColumns: undefined,
      scope: 'all',
      params,
      targetFiles: fileNames,
      rawPrompt: prompt,
      confidence: 0.9,
    };
  }

  /** 提取 formula 的目标列名 */
  private extractFormulaTargetColumn(prompt: string, lower: string): string {
    // "新增一列金额" → "金额"
    const addColMatch = lower.match(/(?:新增|添加|增加|创建|生成)\s*(?:一列|一个)?\s*(.+?)(?:列|，|,|$)/);
    if (addColMatch) {
      const col = addColMatch[1].trim();
      if (col && col.length >= 1) return col;
    }

    // "金额=数量*单价" → "金额"
    const eqMatch = prompt.match(/(.+?)\s*[=＝]/);
    if (eqMatch) {
      const col = eqMatch[1].trim();
      if (col && col.length >= 1) return col;
    }

    // 尝试匹配末尾的 2-6 字目标词（前面可能有修饰）
    const tailMatch = prompt.match(/(\S{2,6})$/);
    if (tailMatch) {
      const col = tailMatch[1].trim();
      if (col && col.length >= 2 && col.length <= 6) return col;
    }

    return '';
  }

  /** 推断公式表达式（支持自然语言） */
  private inferFormulaExpression(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[],
    targetColumn: string
  ): { expressionType: string; columns: string[]; description: string; constantOperand?: number } | null {
    const colTitles = availableColumns.map(c => c.title).filter(Boolean);

    const detectOp = (text: string): string => {
      if (text.includes('加') || text.includes('+') || text.includes('加上')) return '+';
      if (text.includes('减') || text.includes('-') || text.includes('减去')) return '-';
      if (text.includes('乘') || text.includes('×') || text.includes('*') || text.includes('乘以')) return '*';
      if (text.includes('除') || text.includes('÷') || text.includes('/') || text.includes('除以')) return '/';
      return '*';
    };

    // ── Pass 1: 从 prompt 中找显式提到的源列名（排目标列） ──
    // 严格相等排除目标列
    // 排除 "每个X" / "各X" 中的 X（那是分组参考，不是运算列）
    const sourceColumns = colTitles.filter(t => {
      if (t === targetColumn) return false;
      // 排除跟在"每个"或"各"后面的列名（分组引用）
      if (prompt.includes('每个' + t) || prompt.includes('各' + t)) return false;
      return prompt.includes(t);
    });

    // 显式指定 ≥2 列 → 直接按列构建
    if (sourceColumns.length >= 2) {
      const exprType = detectOp(lower);
      return {
        expressionType: exprType,
        columns: sourceColumns,
        description: sourceColumns.join(` ${exprType} `),
      };
    }

    // 显式指定 1 列 + 数字常量 → 列 ∘ 常量
    if (sourceColumns.length === 1) {
      const constantMatch = lower.match(/(\d+(?:\.\d+)?)/);
      if (constantMatch) {
        const exprType = detectOp(lower);
        return {
          expressionType: exprType,
          columns: sourceColumns,
          description: `${sourceColumns[0]} ${exprType} ${constantMatch[1]}`,
          constantOperand: parseFloat(constantMatch[1])
        };
      }
    }

    // ── Pass 2: = 号右边 ──
    const eqMatch = prompt.match(/[=＝]\s*(.+)/);
    if (eqMatch) {
      const rhs = eqMatch[1].trim();
      const matchedCols = colTitles.filter(t => rhs.includes(t) && t !== targetColumn);
      if (matchedCols.length > 0) {
        const exprType = detectOp(rhs);
        return {
          expressionType: exprType,
          columns: matchedCols,
          description: rhs,
        };
      }
    }

    return null;
  }

  /**
   * 检测复合公式表达式（多个不同运算符），拆解为多步 pipeline
   * 例如 "收入 = 基本工资 * 绩效奖金 + 基本工资"
   * → 第一步：_temp_收入 = 基本工资 * 绩效奖金
   * → 第二步：收入 = _temp_收入 + 基本工资
   */
  private detectCompoundFormula(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[],
    targetColumn: string
  ): TaskIntent[] | null {
    const eqMatch = prompt.match(/[=＝]\s*(.+)/);
    if (!eqMatch) return null;
    const rhs = eqMatch[1].trim();

    const colTitles = availableColumns.map(c => c.title).filter(Boolean);

    // 检测 RHS 中出现的所有运算符
    const opCandidates: { op: string; regex: RegExp }[] = [
      { op: '+', regex: /[+＋加]/ },
      { op: '-', regex: /[\-－减]/ },
      { op: '*', regex: /[*×乘]/ },
      { op: '/', regex: /[\/÷除]/ },
    ];

    const foundOps = opCandidates.filter(({ regex }) => regex.test(rhs)).map(({ op }) => op);
    // 只有 1 个或没有运算符 — 不是复合公式
    if (foundOps.length <= 1) return null;

    // RHS 中的列
    const rhsCols = colTitles.filter(t => rhs.includes(t));

    // 按运算符出现的顺序分段
    // 例如 "基本工资 * 绩效奖金 + 基本工资"
    // 第一段: "基本工资 * 绩效奖金"，第二段: "+ 基本工资"
    const steps: TaskIntent[] = [];
    const tempCol = '_temp_' + targetColumn;

    // 第一步：第一个运算 → 临时列
    const firstOp = foundOps[0];
    const firstParts = this.splitByOp(rhs, firstOp);
    if (firstParts.length < 2) return null;

    const firstCols = rhsCols.filter(c => firstParts[0].includes(c) || (firstParts[1] && firstParts[1].includes(c)));
    if (firstCols.length === 0) return null;

    steps.push({
      operation: 'formula' as Operation,
      target: tempCol,
      targetColumns: [],
      scope: 'all',
      params: {
        targetColumn: tempCol,
        expressionType: firstOp,
        sourceColumnHints: firstCols,
        expression: firstCols.join(' ' + firstOp + ' '),
      },
      targetFiles: [],
      rawPrompt: '',
      confidence: 0.9,
    });

    // 第二步：临时列 ∘ 剩余列 → 目标列
    const secondOp = foundOps[1];
    const remainingCols = [tempCol, ...rhsCols.filter(c => !firstCols.includes(c))];
    steps.push({
      operation: 'formula' as Operation,
      target: targetColumn,
      targetColumns: [],
      scope: 'all',
      params: {
        targetColumn: targetColumn,
        expressionType: secondOp,
        sourceColumnHints: remainingCols,
        expression: remainingCols.join(' ' + secondOp + ' '),
      },
      targetFiles: [],
      rawPrompt: '',
      confidence: 0.85,
    });

    return steps;
  }

  /** 按运算符分割表达式 */
  private splitByOp(expr: string, op: string): string[] {
    if (op === '+') return expr.split(/[+＋加]/).filter(Boolean);
    if (op === '-') return expr.split(/[\-－减]/).filter(Boolean);
    if (op === '*') return expr.split(/[*×乘]/).filter(Boolean);
    if (op === '/') return expr.split(/[\/÷除]/).filter(Boolean);
    return [expr];
  }


  /** 提取小数位数 */
  private extractDecimalPlaces(lower: string): number {
    const match = lower.match(/保留\s*(\d+)\s*位/);
    if (match) return parseInt(match[1], 10);
    return 2;
  }

  /** 检测 IF 条件：如果 X 大于/小于/等于 Y，则 A，否则 B */
  private detectIfCondition(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[]
  ): {
    sourceColumns: string[];
    description: string;
    conditionColumnHint: string;
    conditionOperator: string;
    conditionValue: string | number;
    trueValue: string | number;
    falseValue: string | number;
  } | null {
    if (!/如果|若/.test(lower)) return null;

    const colTitles = availableColumns.map(c => c.title).filter(Boolean);

    // 匹配模式：如果 X 大于/小于/等于 Y，则/就 A，否则/不然 B
    const opMap: Record<string, string> = { '大于': '>', '超过': '>', '大于等于': '>=', '不小于': '>=', '小于': '<', '低于': '<', '小于等于': '<=', '不大于': '<=', '等于': '=', '不等于': '!=' };

    // 提取条件列和比较值
    let conditionCol = '';
    let conditionOp = '';
    let conditionVal: string | number = '';
    let trueVal: string | number = '';
    let falseVal: string | number = '';

    // 模式: 如果 [列] [运算符] [值]，则/就 [真值]，否则 [假值]
    const ifMatch = lower.match(/如果\s*(.+?)\s*(大于|小于|等于|大于等于|小于等于|不等于|超过|低于|不小于|不大于)\s*(.+?)(?:，|,)\s*(?:则|就)?\s*(.+?)(?:，|,)\s*(?:否则|不然)\s*(.+)/);
    if (ifMatch) {
      conditionCol = ifMatch[1].trim();
      conditionOp = opMap[ifMatch[2]] || '>';
      conditionVal = ifMatch[3].trim();
      trueVal = ifMatch[4].trim();
      falseVal = ifMatch[5].trim();
    }

    if (!conditionCol) return null;

    // 处理"列名 = 值"或"= 值"格式的真实值和假值，去掉列名前缀（如"奖金等级 = 高" → "高"）
    const stripAssignment = (val: string): string => val.replace(/^\S*\s*[=＝]\s*/, '').trim();
    trueVal = stripAssignment(trueVal);
    falseVal = stripAssignment(falseVal);

    // 匹配条件列名到实际列
    let matchedCol = '';
    for (const t of colTitles) {
      if (t.toLowerCase() === conditionCol.toLowerCase() || t.toLowerCase().includes(conditionCol.toLowerCase()) || conditionCol.includes(t.toLowerCase())) {
        matchedCol = t;
        break;
      }
    }

    // 数值化比较值
    const numVal = Number(conditionVal);
    if (!isNaN(numVal)) conditionVal = numVal;

    // 数值化真值/假值（如果不能转数字则保留文本）
    const trueNum = Number(trueVal);
    const falseNum = Number(falseVal);
    if (!isNaN(trueNum)) trueVal = trueNum;
    if (!isNaN(falseNum)) falseVal = falseNum;

    if (!matchedCol) return null;

    return {
      sourceColumns: [matchedCol],
      description: `IF(${matchedCol}${conditionOp}${conditionVal}, ${trueVal}, ${falseVal})`,
      conditionColumnHint: matchedCol,
      conditionOperator: conditionOp,
      conditionValue: conditionVal,
      trueValue: trueVal,
      falseValue: falseVal,
    };
  }

  // ================================================================
  //  3.  Update Parser — 先解析目标列，再解析条件和值
  // ================================================================

  /**
   * 解析 update 意图
   * 输入："将姓名为空的填充未知"
   * 输出：TaskIntent { operation: 'update', target: '姓名', params: { value: '未知', updateCondition: 'IS_NULL' } }
   */
  public parseUpdateIntent(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[],
    fileNames: string[]
  ): TaskIntent {
    const params: Record<string, unknown> = {};
    const colTitles = availableColumns.map(c => c.title).filter(Boolean);

    // Step 1: 解析目标列 — 从"将XXX""把XXX"或列名匹配中提取
    const column = this.extractUpdateColumn(prompt, lower, colTitles);
    params.column = column;

    // Step 2: 解析更新的值
    const value = this.extractUpdateValue(lower);
    if (value) params.value = value;

    // Step 3: 解析条件（WHERE 子句）
    const conditions = this.extractUpdateConditions(prompt, lower, column, colTitles);

    return {
      operation: 'update' as Operation,
      target: column,
      targetColumns: [],
      resolvedColumns: undefined,
      scope: 'all',
      filters: conditions.length > 0 ? conditions : undefined,
      params: {
        ...params,
        ...(conditions.length > 0 ? { updateCondition: conditions[0].operator } : {}),
      },
      targetFiles: fileNames,
      rawPrompt: prompt,
      confidence: 0.85,
    };
  }

  /** 提取 update 目标列 */
  private extractUpdateColumn(prompt: string, lower: string, colTitles: string[]): string {
    // "将XXX全部改成/都改成/统一改为" — 优先处理含"全部/都"的修饰
    const jiangAllMatch = lower.match(/^将\s*(.+?)\s*(?:全部|都)\s*(?:改成|修改为|替换为|替换成|改为|填充|填写|填为|更新为|更新|设为|设置为)/);
    if (jiangAllMatch) {
      const col = jiangAllMatch[1].trim();
      if (col && col.length >= 1) return col;
    }

    // "将XXX改成/填充/修改为" — XXX 不含"全部/都"且停在"为空的"等条件词之前
    const jiangMatch = lower.match(/^将\s*(.+?)\s*(?:为空的|为空|null|空白|空缺|改成|修改为|替换为|替换成|改为|填充|填写|填为|更新为|更新|设为|设置为)/);
    if (jiangMatch) {
      const col = jiangMatch[1].trim();
      if (col && col.length >= 1 && !/的$/.test(col)) return col;
    }

    // "把XXX改成/填充"
    const baMatch = lower.match(/把\s*(.+?)\s*(?:改成|修改为|替换为|替换成|改为|填充|填写|更新)/);
    if (baMatch) {
      const col = baMatch[1].trim();
      if (col && col.length >= 1) return col;
    }

    // "XXX改成/填充/为空" — 在 availableColumns 中匹配
    // 先取前 N 个字符，找列名
    for (const title of colTitles) {
      if (prompt.includes(title)) {
        return title;
      }
    }

    // "为空的姓名填充" / "姓名空值填充"
    const nullMatch = lower.match(/^(.{2,6}?)(?:为空|空值|null|空白|空缺)/);
    if (nullMatch) {
      const col = nullMatch[1].trim();
      if (col && col.length >= 1) return col;
    }

    return '';
  }

  /** 提取 update 的值 */
  private extractUpdateValue(lower: string): string | null {
    // "改为XX""改成XX""填充为XX"
    const patterns = [
      /(?:改为|改成|设为|设置为|填充为|填为|写成|替换为|替换成|更新为)\s*(.+?)(?:$|的|，|,|。)/,
      /(?:全部改成|都改成|全部改为|都改为|都填为|全部填为|全部更新为)\s*(.+?)(?:$|的|，|,|。)/,
      /填充\s*(.+?)(?:$|的|，|,|。)/,
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const val = match[1].trim();
        if (val && val.length >= 1 && !['空值', '为空', 'null', '空白', '空缺'].includes(val)) {
          return val;
        }
      }
    }

    return null;
  }

  /** 提取 update 条件 */
  private extractUpdateConditions(
    prompt: string,
    lower: string,
    column: string,
    colTitles: string[]
  ): FilterCondition[] {
    const conditions: FilterCondition[] = [];

    // "为空" → IS_NULL
    if (lower.includes('为空') || lower.includes('空值') || lower.includes('null') || lower.includes('空缺') || lower.includes('空白')) {
      // 确定条件列
      let condColumn = column;
      // 如果 column 还没确定，从"XXX为空"中提取
      if (!condColumn) {
        for (const title of colTitles) {
          if (lower.includes(title) && lower.includes(title + '为空') || lower.includes(title + '空值')) {
            condColumn = title;
            break;
          }
        }
        if (!condColumn) {
          const nullMatch = lower.match(/(.{1,6})(?:为空|空值|null)/);
          if (nullMatch) condColumn = nullMatch[1].trim();
        }
      }

      conditions.push({
        column: condColumn || '',
        operator: 'eq',
        value: '',
      });
      return conditions;
    }

    // "不为空" → NOT_NULL
    if (lower.includes('不为空') || lower.includes('非空') || lower.includes('有值')) {
      let condColumn = column;
      if (!condColumn) {
        for (const title of colTitles) {
          if (lower.includes(title)) {
            condColumn = title;
            break;
          }
        }
      }
      conditions.push({
        column: condColumn || '',
        operator: 'neq',
        value: '',
      });
      return conditions;
    // 比较条件：大于15000、小于5000 等（用于"将基本工资大于15000的改成20000"）
    if (column) {
      const compPatterns: { regex: RegExp; op: string }[] = [
        { regex: /大于等于s*([d.]+)/, op: 'gte' },
        { regex: /大于s*([d.]+)/, op: 'gte' },
        { regex: /小于等于s*([d.]+)/, op: 'lte' },
        { regex: /小于s*([d.]+)/, op: 'lte' },
        { regex: /等于s*([d.]+)/, op: 'eq' },
      ];
      for (const p of compPatterns) {
        const m = lower.match(p.regex);
        if (m) {
          conditions.push({
            column: column,
            operator: p.op as any,
            value: Number(m![1]) as any,
          });
          return conditions;
        }
      }
    }
    }

    return conditions;
  }

  // ================================================================
  //  4.  Pipeline Parser — 生产 steps 数组
  // ================================================================

  /**
   * 将含连接词的自然语言拆分为多个 TaskIntent
   * 用 "再"、"然后"、"之后" 等分隔符切分，每个 segment 独立解析
   */
  public parsePipelineSteps(
    prompt: string,
    availableColumns: ColumnDef[],
    rows?: Record<string, string | number | null>[],
  ): TaskIntent[] {
    // 按连接词分割 — 保留分割符以便判断后续操作
    const segments = prompt.split(CONNECTOR_RE).filter(Boolean).map(s => s.trim());
    if (segments.length < 2) return [];

    const results: TaskIntent[] = [];

    for (const seg of segments) {
      if (!seg) continue;
      const segIntent = this.parse(seg, availableColumns, [], rows);
      if (segIntent.operation && segIntent.operation !== 'pipeline') {
        results.push(segIntent);
      }
    }

    return results;
  }

  // ================================================================
  //  5.  Standard Parser — 其它操作（sort/filter/aggregate 等）
  // ================================================================

  private parseStandardIntent(
    prompt: string,
    lower: string,
    availableColumns: ColumnDef[],
    fileNames: string[],
    detected: OperationDetection,
    rows?: Record<string, string | number | null>[],
  ): TaskIntent {
    const columnTitles = availableColumns.map(c => c.title).filter(Boolean);
    const operationTerms = this.lexicon.getOperations()
      .flatMap(op => this.lexicon.getSynonyms(op))
      .filter(s => s.length >= 2);
    const extraLexicon = [...new Set([...columnTitles, ...operationTerms])];
    const tokenized = tokenize(prompt, extraLexicon);

    const op = detected.operation;

    // ── select 操作（列选择，如"只看姓名和岗位"）──
    if (op === 'select') {
      // 从"只看X和Y"中提取列名
      const selectMatch = lower.match(/(?:只看|只保留|只显示)\s*(.+?)(?:$|，|,|然后|再|之后|接着)/);
      const cols: string[] = [];
      if (selectMatch) {
        const raw = selectMatch[1].trim();
        // 按"和"、"、"、"与"分割
        const parts = raw.split(/[和与、,，]/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
          // 匹配可用列名
          for (const c of availableColumns) {
            if (p === c.title.toLowerCase() || p.includes(c.title.toLowerCase()) || c.title.toLowerCase().includes(p)) {
              if (!cols.includes(c.title)) cols.push(c.title);
              break;
            }
          }
          // 如果没匹配到，但提示词里有这个列名
          if (!cols.includes(p)) {
            const col = availableColumns.find(c => c.title.toLowerCase() === p || c.title.includes(p) || p.includes(c.title));
            if (col && !cols.includes(col.title)) cols.push(col.title);
          }
        }
      }

      return {
        operation: 'select' as Operation,
        target: cols[0] || '',
        targetColumns: [],
        resolvedColumns: undefined,
        scope: 'all',
        params: { targets: cols },
        targetFiles: fileNames,
        rawPrompt: prompt,
        confidence: 0.85,
      };
    }

    // Step 3: 先提取分组（这样 groupBy 词可以从 target 中排除）
    const groupBy = this.extractGroupBy(prompt, lower, availableColumns);

    // Step 4: 提取语义目标（排除 groupBy 词）
    const target = this.extractTarget(prompt, lower, tokenized.keywords, op as Operation, groupBy || [], availableColumns);

    // Step 4b: 提取全部语义目标（多列求和场景）
    const allTargets = this.extractAllTargets(tokenized.keywords, op as Operation, groupBy || []);

    // Step 5: 提取聚合方式
    const aggregation = this.extractAggregation(lower);

    // Step 6: 提取范围
    const scope = this.extractScope(lower);

    // Step 7: 提取过滤条件 — 新管线优先（filter 操作专用）
    let filters: FilterCondition[] | undefined;
    let newPipelineUsed = false;
    if (op === 'filter') {
      const newFilters = this.parseFilterWithPipeline(prompt, lower, availableColumns, rows);
      if (newFilters.length > 0) {
        filters = newFilters;
        newPipelineUsed = true;
      }
    }
    if (!filters || filters.length === 0) {
      // fallback: 旧 extractFilters（日期范围）+ 旧 extractParams（比较算子）
      filters = this.extractFilters(prompt, lower, tokenized.keywords);
    }

    // Step 8: 提取 params（保持向后兼容）
    const params: Record<string, unknown> = {};
    if (op === 'filter' && newPipelineUsed) {
      // 新管线已有完整条件 → 跳过 extractParams 的 filter 逻辑
    } else {
      Object.assign(params, this.extractParams(lower, op as Operation, target));
    }
    if (allTargets.length > 1) {
      params.targets = allTargets;
    }

    // Step 9: 综合置信度
    const confidence = op ? Math.min(1, (detected.confidence + (target ? 0.6 : 0.3)) / 1.5) : 0;

    return {
      operation: op as Operation,
      target,
      targetColumns: [],
      resolvedColumns: undefined,
      scope,
      groupBy,
      filters,
      aggregation,
      params,
      targetFiles: fileNames,
      rawPrompt: prompt,
      confidence,
    };
  }

  // ================================================================
  //  5a.  Filter Pipeline — 条件拆解 + 字段绑定 + 逻辑组合
  // ================================================================
  // 用结构模式（而非关键词列表）处理中文比较表达式。
  // 中文比较条件规律: [字段] [比较词] [数值]，比较词以"于"结尾。
  //
  // 管线: segmentFilterPrompt → extractConditions → composeConditions
  // ================================================================

  /** 操作关键词，用于从提示词头移除 */
  private static FILTER_OP_KW = ['筛选', '筛选出', '过滤', '过滤出', '找出', '找到', '查询', '查看'];

  /** 噪音词 — 语气词/口语词，出现在提示词中应被忽略 */
  private static NOISE_WORDS = new Set([
    '一下', '一个', '一些', '这个', '那个', '哪个', '这些', '那些',
    '看看', '想要', '需要', '可以', '能', '会', '怎么', '如何',
    '帮', '请', '麻烦', '帮忙', '帮我', '您好', '你好', '谢谢', '感谢',
    '数据', '信息', '记录', '情况', '列表', '文件', '表格', '表中',
  ]);

  /** 无意义后缀（复合拆解后可忽略） */
  private static MEANINGLESS_SUFFIXES = ['的员工', '员工', '的人', '的人', '信息', '数据', '记录', '名单', '情况', '资料', '列表'];

  /**
   * 去除操作词、噪音词和无意义尾缀，保留干净的条件文本
   */
  private cleanFilterPrompt(lower: string): string {
    let cleaned = lower;
    for (const kw of RuleBasedSemanticParser.FILTER_OP_KW) {
      if (cleaned.startsWith(kw)) {
        cleaned = cleaned.slice(kw.length).trim();
        break;
      }
    }
    // 去噪音词（"一下"、"看看"等口语词）
    for (const noise of RuleBasedSemanticParser.NOISE_WORDS) {
      cleaned = cleaned.replace(noise, '');
    }
    // 去尾缀（连续去除，如"标准的数据"→ "标准"）
    cleaned = cleaned.replace(/(?:的(?:员工|数据|信息|记录|名单|情况|资料)?|员工|的人)$/, '');
    for (const suffix of RuleBasedSemanticParser.MEANINGLESS_SUFFIXES) {
      if (cleaned.endsWith(suffix)) {
        cleaned = cleaned.slice(0, -suffix.length).trim();
        break;
      }
    }
    return cleaned.trim();
  }

  /**
   * 模块1: Segmenter — 在比较结构处拆分句子
   *
   * 三阶段拆分：
   *   Phase 0: 以 OR 连接词("或"/"或者")切分，标记 __OR__
   *   Phase 1: 在每个 OR 分支中，在第一个比较词处切分 → [preOp, opAndValue]
   *   Phase 2: preOp 如果既含值又含列名 → 进一步切分
   *
   * "技术部基本工资大于等于13000"
   *   Phase1: ["技术部基本工资", "大于等于13000"]
   *   Phase2: ["技术部", "基本工资大于等于13000"]
   *
   * "基本工资高于8000"
   *   Phase1: ["基本工资", "高于8000"]
   *
   * "技术部员工"
   *   Phase1: ["技术部员工"]  (无算子，整体当 value)
   *
   * "工资>10000或绩效>0.9"
   *   Phase0: ["工资>10000", "__OR__", "绩效>0.9"]
   */
  private segmentFilterPrompt(cleaned: string, columns: ColumnDef[]): string[] {
    if (!cleaned || cleaned.length === 0) return [];

    // Phase 0: OR connector split
    const OR_RE = /(或|或者)/g;
    const orParts: string[] = [];
    let lastIdx = 0;
    let orMatch: RegExpExecArray | null;
    while ((orMatch = OR_RE.exec(cleaned)) !== null) {
      const before = cleaned.slice(lastIdx, orMatch.index).trim();
      if (before) orParts.push(before);
      orParts.push('__OR__');
      lastIdx = orMatch.index + orMatch[0].length;
    }
    const after = cleaned.slice(lastIdx).trim();
    if (after) orParts.push(after);

    if (orParts.length <= 1) {
      // No OR connectors found → normal single-path
      return this.segmentFilterPromptSingle(cleaned, columns);
    }

    // Process each OR branch independently and flatten
    const allSegments: string[] = [];
    for (const part of orParts) {
      if (part === '__OR__') {
        allSegments.push(part);
        continue;
      }
      const sub = this.segmentFilterPromptSingle(part, columns);
      allSegments.push(...sub);
    }
    return allSegments;
  }

  /** 对单个 OR 分支执行分段（不含 OR 拆分逻辑） */
  private segmentFilterPromptSingle(cleaned: string, columns: ColumnDef[]): string[] {
    if (!cleaned || cleaned.length === 0) return [];

    // Phase 1: 在第一个比较词处切分
    const operatorPatterns = [
      { re: /大于等于|不小于/, len: 3 },
      { re: /小于等于|不大于/, len: 3 },
      { re: /不等于/, len: 3 },
      { re: /[大高多超]于/, len: 2 },  // 大于/高于/多于/超过
      { re: /[小低少]于/, len: 2 },    // 小于/低于/少于
      { re: /等于|包含/, len: 2 },
      { re: /[=><!]=?/, len: 1 },
      { re: /[是为]/, len: 1 },
    ];

    let operatorIdx = -1;
    let operatorText = '';

    for (const { re } of operatorPatterns) {
      const m = cleaned.match(re);
      if (m && m.index !== undefined && m.index > 0) {
        operatorIdx = m.index;
        operatorText = m[0];
        break;
      }
    }

    let segments: string[];

    if (operatorIdx > 0) {
      const preOp = cleaned.slice(0, operatorIdx).trim();
      const afterOp = cleaned.slice(operatorIdx).trim();

      if (preOp && afterOp) {
        // Phase 2a: 多条件拆分 — 检查 value 侧是否含内嵌条件
        // 去掉算子前缀 get 到 value 原始文本
        const opPrefix = operatorText;
        const afterOpText = afterOp.slice(opPrefix.length).trim();

        // 在 value 文本中检查是否存在内嵌条件
        const multiConditionSplit = this.splitMultiConditionValue(preOp, columns);
        if (multiConditionSplit.length >= 2) {
          // preOp 可拆分为 [独立值, 内嵌列名]
          // 独立值放到 segments 中，内嵌列名与 afterOp 合并形成完整条件
          const innerValue = multiConditionSplit[0];
          const innerColumn = multiConditionSplit[1];
          segments = [innerValue, innerColumn + afterOp];
        } else {
          // 标准 preOp 拆分
          const splitPreOp = this.splitValueAndColumn(preOp, columns);
          if (splitPreOp.length >= 2) {
            segments = [...splitPreOp.slice(0, -1), splitPreOp[splitPreOp.length - 1] + afterOp];
          } else {
            segments = [preOp, afterOp];
          }
        }
      } else {
        segments = cleaned.length >= 2 ? [cleaned] : [];
      }
    } else {
      segments = cleaned.length >= 2 ? [cleaned] : [];
    }

    return segments;
  }

  /**
   * Phase 2 辅助: 将 preOp 文本拆分为 [值, 列名]
   *
   * "技术部基本工资" → ["技术部", "基本工资"] (基本工资是已知列)
   * "基本工资"       → ["基本工资"] (不能拆分)
   * "工资"           → ["工资"] (太短)
   */
  private splitValueAndColumn(text: string, columns: ColumnDef[]): string[] {
    if (!text || text.length < 3) return [text];

    const colTitles = columns.map(c => c.title).filter(t => t.length >= 2);
    // 按长度降序，最长匹配优先
    colTitles.sort((a, b) => b.length - a.length);

    for (const colTitle of colTitles) {
      // 列名在 text 中的位置
      const idx = text.indexOf(colTitle);
      if (idx > 0) {
        // 列名前面有内容 → [值, 列名]
        const before = text.slice(0, idx).trim();
        if (before) {
          return [before, colTitle];
        }
      }
    }

    return [text];
  }

  /**
   * 递归拆分多条件值文本
   * 当 operator 的 value 侧可能包含内嵌条件时，将其拆分为多个 segment
   *
   * "技术部基本工资大于15000" → ["技术部", "基本工资大于15000"]
   * "技术部工资大于15000"   → ["技术部", "工资大于15000"]
   * "销售部绩效大于0.8"     → ["销售部", "绩效大于0.8"]
   * "部门是技术部"           → ["部门是技术部"] (value 侧无内嵌条件)
   */
  private splitMultiConditionValue(text: string, columns: ColumnDef[]): string[] {
    if (!text || text.length < 3) return [text];

    const colTitles = columns
      .map(c => c.title)
      .filter(t => t.length >= 2)
      .sort((a, b) => b.length - a.length); // 最长匹配优先

    for (const colTitle of colTitles) {
      const idx = text.indexOf(colTitle);
      if (idx > 0) {
        // 列名在 text 中的位置 > 0，说明前面有内容
        const afterCol = text.slice(idx + colTitle.length);
        // 检查列名后面是否紧跟比较词
        const NEXT_OP = /^\s*(大于等于|小于等于|不等于|不小于|不大于|[大高多超]于|[小低少]于|等于|包含|[=><!])\s*/;
        if (NEXT_OP.test(afterCol)) {
          const before = text.slice(0, idx).trim();
          const rest = text.slice(idx).trim();
          if (before) {
            return [before, rest];
          }
        }
      }
    }

    return [text];
  }

  /**
   * 检测一个 segment 是否包含多个独立条件，如有则拆分（fallback 方法）
   * "销售部绩效大于0.8工资小于12000" → ["销售部", "绩效大于0.8", "工资小于12000"]
   */
  private reSplitMultiCondition(seg: string, columns: ColumnDef[]): string[] {
    if (!seg || seg.length < 5) return [seg];

    // Count operator occurrences
    const OP_ALL = /(大于等于|小于等于|不等于|不小于|不大于|[大高多超]于|[小低少]于|等于|包含|[=><!]=?)/g;
    const matches = [...seg.matchAll(OP_ALL)];
    if (matches.length <= 1) return [seg];

    // Multiple operators → try to split at the 2nd+ operator position
    // But only if there's a known column name before that operator
    const colTitles = columns
      .map(c => c.title)
      .filter(t => t.length >= 2)
      .sort((a, b) => b.length - a.length);

    for (const match of matches) {
      if (match.index === matches[0].index) continue; // skip first
      const pos = match.index;
      // Check if the text before this operator contains a known column
      const beforeOp = seg.slice(0, pos);
      for (const colTitle of colTitles) {
        const colIdx = beforeOp.lastIndexOf(colTitle);
        if (colIdx >= 0) {
          // Found column before 2nd operator → split point is after the value before this column
          const valuePart = beforeOp.slice(0, colIdx).trim();
          if (valuePart) {
            return [valuePart, beforeOp.slice(colIdx).trim(), seg.slice(pos).trim()];
          }
          return [beforeOp.trim(), seg.slice(pos).trim()];
        }
      }
    }

    return [seg];
  }

  /**
   * 模块2: ConditionExtractor — 从语义片段提取结构化条件
   *
   * 输入: string[] segments（来自 segmenter）
   * 输出: ParsedCondition[]
   *
   * 用结构模式识别比较词，用通用算子推断函数映射到有限算子集合。
   * 不依赖具体关键词列表（"高于""少于"等自动覆盖）。
   */
  private extractConditions(segments: string[], columns: ColumnDef[]): ParsedCondition[] {
    const results: ParsedCondition[] = [];
    const colTitles = new Set(columns.map(c => c.title));

    // 算子模式（降序排列）
    const OP_PATTERN = '大于等于|小于等于|不等于|不小于|不大于|[大高多超]于|[小低少]于|等于|包含';
    const OP_AT_START = new RegExp('^(' + OP_PATTERN + '|[是为]|[=><!]=?)\\s*(.+)$');
    const COL_AND_OP = new RegExp('^(.+?)\\s*(' + OP_PATTERN + '|[是为]|[=><!]=?)\\s*(.+)$');
    // 有算子的正则（判断 segment 是否包含算子）
    const HAS_OP = new RegExp('(' + OP_PATTERN + '|[是为]|[=><!])');

    // OR logic tracking
    let currentLogic: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg || seg.length < 1) continue;

      // OR sentinel handling
      if (seg === '__OR__') {
        currentLogic = 'OR';
        continue;
      }

      // Re-split: check if this segment contains multiple operator patterns
      // e.g., "销售部绩效大于0.8工资小于12000" → needs further splitting
      const reSplit = this.reSplitMultiCondition(seg, columns);
      if (reSplit.length > 1) {
        segments.splice(i, 1, ...reSplit);
        i--;
        continue;
      }

      // 有算子则尝试模式1-3；无算子则跳过直接到值模式
      const hasOp = HAS_OP.test(seg);

      if (hasOp) {
        // 模式1: 算子在前（无前置列名）— "高于8000"
        const opStart = seg.match(OP_AT_START);
        if (opStart) {
          const compWord = opStart[1].trim();
          const rawVal = opStart[2].trim();
          let colHint: string | undefined;

          if (i > 0) {
            const prev = segments[i - 1];
            if (colTitles.has(prev)) {
              colHint = prev;
            } else if (results.length > 0) {
              const last = results[results.length - 1];
              if (last.isValueOnly && typeof last.value === 'string') {
                colHint = last.value;
                results.pop();
              }
            }
          }

          if (compWord && rawVal) {
            const operator = this.inferOperator(compWord);
            results.push({ columnHint: colHint, operator, value: rawVal, isValueOnly: false, logic: currentLogic });
            currentLogic = 'AND';
            continue;
          }
        }

        // 模式2: 列名 + 算子 + 值
        const colOp = seg.match(COL_AND_OP);
        if (colOp) {
          const colHint = colOp[1].trim();
          const compWord = colOp[2].trim();
          const rawVal = colOp[3].trim();
          if (colHint && compWord && rawVal) {
            const operator = this.inferOperator(compWord);
            results.push({ columnHint: colHint, operator, value: rawVal, isValueOnly: false, logic: currentLogic });
            currentLogic = 'AND';
            continue;
          }
        }

        // 模式3: 符号比较
        const symMatch = seg.match(/^(.+?)\s*([=><!]=?|<>)\s*(.+)$/);
        if (symMatch) {
          const colHint = symMatch[1].trim();
          const symOp = symMatch[2].trim();
          const rawVal = symMatch[3].trim();
          if (colHint && symOp && rawVal) {
            const operator = this.inferOperator(symOp);
            results.push({ columnHint: colHint, operator, value: rawVal, isValueOnly: false, logic: currentLogic });
            currentLogic = 'AND';
            continue;
          }
        }
      }

      // --- 以下是无算子 segment 的处理 ---

      // Case A: 纯列名（不包含算子）且是已知列 → 不产生条件
      if (colTitles.has(seg)) {
        const nextHasOp = (i + 1 < segments.length) && HAS_OP.test(segments[i + 1]);
        if (nextHasOp) continue;

        if (i > 0) {
          const lastIdx = results.length - 1;
          if (lastIdx >= 0 && results[lastIdx].isValueOnly) {
            results[lastIdx] = {
              columnHint: seg,
              operator: 'eq',
              value: String(results[lastIdx].value),
              isValueOnly: false,
              logic: currentLogic,
            };
            currentLogic = 'AND';
            continue;
          }
        }
        results.push({ columnHint: seg, operator: 'eq', value: seg, isValueOnly: false, logic: currentLogic });
        currentLogic = 'AND';
        continue;
      }

      // 模式4: 纯数字值
      if (/^\d+(\.\d+)?$/.test(seg)) {
        let colHint: string | undefined;
        if (i > 0) {
          const prev = segments[i - 1];
          if (colTitles.has(prev)) colHint = prev;
        }
        results.push({ columnHint: colHint, operator: 'eq', value: seg, isValueOnly: !colHint, logic: currentLogic });
        currentLogic = 'AND';
        continue;
      }

      // 模式5: value-only
      if (seg.length >= 2) {
        results.push({ columnHint: undefined, operator: 'eq', value: seg, isValueOnly: true, logic: currentLogic });
        currentLogic = 'AND';
      }
    }

    return results;
  }

  /**
   * 通用算子推断函数
   *
   * 通过分析比较词的结构推断算子，不依赖具体词汇。
   * - "大/高/多/超" + "于" → GT  (大于/高于/多于/超过...一次覆盖)
   * - "小/低/少" + "于"     → LT  (小于/低于/少于...一次覆盖)
   * - 含"等于"或"="         → EQ
   * - 含"不等"或"!="        → NEQ
   * - 含"包含"              → CONTAINS
   */
  private inferOperator(compWord: string): string {
    if (compWord.includes('大于等于') || compWord.includes('不小于')) return 'gte';
    if (compWord.includes('小于等于') || compWord.includes('不大于')) return 'lte';
    if (compWord.includes('不等') || compWord === '!=' || compWord === '<>') return 'neq';
    if (compWord === '=' || compWord.includes('等于') || compWord === '是' || compWord === '为') return 'eq';
    if (compWord.includes('包含')) return 'contains';
    if (compWord.includes('于')) {
      // "X于" 结构: 通过第一个字符判断。一次覆盖 大于/高于/多于/超过/小于/低于/少于
      const firstChar = compWord.charAt(0);
      if (/^[大高多超]$/.test(firstChar)) return 'gt';
      if (/^[小低少]$/.test(firstChar)) return 'lt';
    }
    // 符号比较
    if (compWord === '>=') return 'gte';
    if (compWord === '<=') return 'lte';
    if (compWord === '>') return 'gt';
    if (compWord === '<') return 'lt';
    return 'eq';
  }

  /**
   * 模块3+4: composeConditions — 条件组合
   *
   * 规则：解析不到有效列名的 value-only 条件 → 丢弃（噪音词防御）
   *       有明确 columnHint 但映射不到的 → 保留 hint 原文
   */
  private composeConditions(
    parsed: ParsedCondition[],
    originalLower: string,
    columns: ColumnDef[],
    rows?: Record<string, string | number | null>[],
  ): FilterCondition[] {
    if (parsed.length === 0) return [];

    // Step 1: SemanticInterpreter 解释为语义条件
    const semanticConditions = this.interpreter.interpret(parsed, columns);

    // 构建最终的 FilterCondition[]
    const result: FilterCondition[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const sc = i < semanticConditions.length ? semanticConditions[i] : null;
      if (!sc) continue;

      // 确定最终的 column
      let column: string | null = null;

      // 优先级1: 原始 columnHint 能直接匹配列名（精确/模糊）
      if (p.columnHint && !p.isValueOnly) {
        column = this.resolveFieldDirect(p.columnHint, columns);
      }

      // 优先级2: 用语义字段匹配列
      if (!column) {
        column = this.resolveSemanticField(sc.semanticField, columns);
      }

      // 优先级3: 值也可能是列值（如"技术部"→部门）
      if (!column) {
        const conceptCol = this.matchConceptToColumn(sc.semanticField, columns);
        if (conceptCol) column = conceptCol;
      }

      // ★ 关键规则：纯值条件解析不到任何列 → 丢弃（防止"一下"等噪音词）
      if (!column && p.isValueOnly) continue;

      // 有明确 columnHint 但映射不到 → 保留 hint 原文
      if (!column) {
        column = p.columnHint || String(sc.value);
      }

      result.push({
        column,
        operator: this.mapOpToFilterCondition(sc.operator),
        value: typeof sc.value === 'number' ? String(sc.value) : String(sc.value),
        logic: sc.logic || 'AND',
      });
    }

    return result;
  }

  /**
   * 直接匹配 columnHint → 列名
   * 精确/模糊匹配，不做概念映射
   */
  private resolveFieldDirect(hint: string, columns: ColumnDef[]): string | null {
    const lowerHint = hint.toLowerCase();
    for (const col of columns) {
      if (col.title === hint || col.key === hint) return col.title;
      if (col.title.toLowerCase() === lowerHint) return col.title;
    }
    for (const col of columns) {
      const titleLower = col.title.toLowerCase();
      if (titleLower.includes(lowerHint) || lowerHint.includes(titleLower)) {
        return col.title;
      }
    }
    return null;
  }

  /**
   * 解析语义字段 → 列名
   * 纯映射，不推理
   */
  private resolveSemanticField(field: string, columns: ColumnDef[]): string | null {
    const lowerField = field.toLowerCase();

    // 精确匹配
    for (const col of columns) {
      if (col.title === field || col.key === field) return col.title;
      if (col.title.toLowerCase() === lowerField) return col.title;
    }
    // 模糊匹配
    for (const col of columns) {
      const titleLower = col.title.toLowerCase();
      if (titleLower.includes(lowerField) || lowerField.includes(titleLower)) {
        return col.title;
      }
    }
    return null;
  }

  /**
   * 从概念注册表反向匹配：语义字段 → 列
   */
  private matchConceptToColumn(field: string, columns: ColumnDef[]): string | null {
    const reg = DEFAULT_CONCEPT_REGISTRY;
    // 尝试将值字段匹配到概念 → 再映射到列
    for (const concept of reg) {
      if (concept.concept === field || concept.columnKeywords.some(k => k === field)) {
        for (const col of columns) {
          const colLower = col.title.toLowerCase();
          for (const kw of concept.columnKeywords) {
            if (colLower === kw.toLowerCase() || colLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(colLower)) {
              return col.title;
            }
          }
          if (col.title.toLowerCase() === concept.concept.toLowerCase()) {
            return col.title;
          }
        }
      }
    }
    return null;
  }

  /** 映射内部算子字符串 → TaskPlanCondition.operator */
  private mapOperatorToTaskPlan(op: string): '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' {
    const map: Record<string, any> = {
      eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', contains: 'contains',
    };
    return map[op] || '=';
  }

  /** 映射内部算子字符串 → FilterCondition.operator */
  private mapOpToFilterCondition(op: string): FilterCondition['operator'] {
    const map: Record<string, FilterCondition['operator']> = {
      eq: 'eq', neq: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', contains: 'contains',
    };
    return map[op] || 'eq';
  }

  /**
   * 主入口：filter 操作的新管线
   * 调用链路: segmentFilterPrompt → extractConditions → composeConditions
   */
  private parseFilterWithPipeline(
    prompt: string,
    lower: string,
    columns: ColumnDef[],
    rows?: Record<string, string | number | null>[],
  ): FilterCondition[] {
    const cleaned = this.cleanFilterPrompt(lower);
    if (!cleaned || cleaned.length === 0) return [];

    // 如果 raw 是纯粹的数据探索型（无比较结构），让 fallback 处理
    // 检测：是否有数字 + 比较词的结构
    const rawHasCompare = /(大于|小于|等于|高于|低于|超过|于)\s*[\d]/.test(cleaned)
      || /[\d]\s*(大于|小于|等于|高于|低于|超过|于)/.test(cleaned)
      || /[><=]/.test(cleaned);

    const segments = this.segmentFilterPrompt(cleaned, columns);
    if (segments.length === 0) return [];

    const parsed = this.extractConditions(segments, columns);

    // 管线产出无算子条件且原始输入不含比较结构 → 纯值查询（如"技术部员工"）
    const allValueOnly = parsed.every(p => p.isValueOnly);
    if (allValueOnly && !rawHasCompare) {
      // 检查是否包含日期模式（如"2024年1月份"），这类归旧 extractFilters 处理
      if (/\d{4}年/.test(cleaned)) {
        return [];
      }
      // 纯值场景：让 composeConditions 通过 FieldResolver 解析
      const composed = this.composeConditions(parsed, lower, columns, rows);
      return composed;
    }

    if (parsed.length === 0) return [];

    const composed = this.composeConditions(parsed, lower, columns, rows);
    return composed;
  }

  // ================================================================
  //  原有方法（保持不变）
  // ================================================================

  /**
   * 从 prompt 中提取语义目标对象
   * 例如："统计销售额" → "销售额"
   *       "按姓名匹配" → "姓名"
   *       "帮我排序工资" → "工资"
   */
  private extractTarget(prompt: string, lower: string, keywords: string[], operation: Operation | null, excludeTargets: string[] = [], availableColumns?: ColumnDef[]): string {
    // ── 只做操作词/停用词过滤，不做列名匹配 ──
    // 列名匹配由 FieldResolver 处理，Rule path 只输出 raw entities

    // ── 策略 1: 移除操作词和停用词，剩余词为目标 ────────────────────────
    var operationWords = new Set([
      '求和', '求总和', '总和', '统计', '统计一下', '统计出',
      '汇总', '汇总一下', '累计', '累计一下', '总计', '合计',
      '算一下', '算个总数', '全部加起来', '加起来', '一共多少',
      '总共有多少', '一共', '总数', '总额', '总共',
      '计算', '计算出', '算', '算算',
      '排序', '排一下', '排个序', '排列', '排一排',
      '从大到小', '从小到大', '升序', '降序', '按顺序', '整理',
      '筛选', '筛选出', '过滤', '过滤出', '只保留', '只显示',
      '只看', '只要', '找出', '找到', '符合', '满足',
      '查一下', '查询', '查看',
      '去重', '去一下重', '去重复', '删除重复', '移除重复', '去掉重复',
      '重复删除', '去除重复', '去重一下',
      '匹配', '匹配一下', '关联', '关联起来', '对应', '对齐',
      '合并', '合并一下', '拼接', '拼接起来', '组合', '整合',
      '拼到一起', '合到一起',
      '清洗', '清洗一下', '清理', '清理一下', '清除空白', '清除异常',
      '修复', '修正', '修复一下', '净化', '整理数据',
      'VLOOKUP', 'vlookup',
      // update/formula 操作词 — extractTarget 阶段这些词已被 detectOperation 分流
      '填充', '填上', '填入', '填为', '填写',
      '修改', '改为', '改成', '设置', '设为',
      '更新', '更新为', '替换', '替换为', '替换成',
      '全部改成', '都改成', '全部改为', '都改为',
      '批量修改', '批量更新', '批量替换',
      '新增', '添加', '增加', '新列', '乘以', '除以', '加上', '减去',
      // 噪声词（禁止作为 target）
      '表中', '数据中', '该表', '表格', '表里', '字段', '值',
    ]);

    const stopWords = new Set([
      '的', '了', '是', '在', '把', '被', '将', '就', '都', '也', '还',
      '对', '给', '让', '从', '到', '和', '与', '或', '跟',
      '这', '那', '哪', '它', '他', '她', '们',
      '什么', '怎么', '如何', '哪些', '那些', '这些',
      '一个', '一些', '一下', '这个', '那个', '哪个',
      '看看', '想要', '需要', '可以', '能', '会',
      '帮', '请', '麻烦', '帮忙', '帮我', '您好', '你好', '谢谢', '感谢',
      '对', '按', '把', '将', '的', '了', '进行',
    ]);

    // 从关键词中过滤：只保留既不是操作词也不是停用词的词
    const meaningfulKeywords = keywords.filter(k => !operationWords.has(k) && !stopWords.has(k) && k.length >= 2 && !excludeTargets.includes(k));

    // 如果有多个候选，优先精确匹配列名，否则取位置最靠前的
    if (meaningfulKeywords.length > 0) {
      if (availableColumns && availableColumns.length > 0) {
        const colTitleSet = new Set(availableColumns.map(function (c) { return c.title; }));
        for (var _mk = 0; _mk < meaningfulKeywords.length; _mk++) {
          var kw = meaningfulKeywords[_mk];
          // 跳过"每个X""各X"模式（那是 groupBy，不是 target）
          if (prompt.includes('每个' + kw) || prompt.includes('各' + kw)) continue;
          if (colTitleSet.has(kw)) {
            return kw;
          }
        }
      }
      // 回退到位置最靠前的
      meaningfulKeywords.sort((a, b) => prompt.indexOf(a) - prompt.indexOf(b));
      return meaningfulKeywords[0];
    }

    // 策略 2: 从 prompt 正文提取 — 移除组句模式后取剩余文本
    // 例如 "按产品统计销售总额" → 移除 "按产品" → "统计销售总额" → 移除操作词和聚合后缀 → "销售"
    const aggSuffixPatterns = ['总额', '总和', '合计', '总数', '总计', '汇总'];
    let stripped = lower;

    // 2a: 移除 "按XX" 前缀
    stripped = stripped.replace(/按.+?(?:统计|汇总|求和|排序|分组)/, '');

    // 2b: 移除聚合后缀及前面的动词（统计/汇总等）
    const aggSuffix = aggSuffixPatterns.find(s => stripped.endsWith(s));
    if (aggSuffix) {
      stripped = stripped.slice(0, -aggSuffix.length);
    }

    // 2c: 修剪残留的动词和停用词
    stripped = stripped.replace(/统计|汇总|求和|排序|合计|总计|的/g, '').trim();

    // 2d: 还剩下什么？
    if (stripped && stripped.length >= 2) {
      const colTitles = this.lexicon.getOperations()
        .flatMap(op => this.lexicon.getSynonyms(op));
      const notOp = (word: string) => !colTitles.includes(word) && !stopWords.has(word);
      const words = [...new Set(stripped.split(/[，,、\s]+/).filter(w => w.length >= 2 && notOp(w)))];
      if (words.length > 0) return words[0];
      // 如果没找到有效词，直接返回修剪后的文本
      if (notOp(stripped) && !excludeTargets.includes(stripped)) return stripped;
    }

    // 策略 3: 无关键词时，返回空
    return '';
  }

  /**
   * 提取全部语义目标（处理"基本工资、绩效奖金、加班补贴"等多列场景）
   */
  private extractAllTargets(keywords: string[], operation: Operation | null, excludeTargets: string[]): string[] {
    const operationWords = new Set([
      '求和', '求总和', '总和', '统计', '统计一下', '统计出',
      '汇总', '汇总一下', '累计', '累计一下', '总计', '合计',
      '算一下', '算个总数', '全部加起来', '加起来', '一共多少',
      '总共有多少', '一共', '总数', '总额', '总共',
      '计算', '计算出', '算', '算算',
      '排序', '排一下', '排个序', '排列', '排一排',
      '从大到小', '从小到大', '升序', '降序', '按顺序', '整理',
      '筛选', '筛选出', '过滤', '过滤出', '只保留', '只显示',
      '只看', '只要', '找出', '找到', '符合', '满足',
      '查一下', '查询', '查看',
      '去重', '去一下重', '去重复', '删除重复', '移除重复', '去掉重复',
      '重复删除', '去除重复', '去重一下',
      '匹配', '匹配一下', '关联', '关联起来', '对应', '对齐',
      '合并', '合并一下', '拼接', '拼接起来', '组合', '整合',
      '拼到一起', '合到一起',
      '清洗', '清洗一下', '清理', '清理一下', '清除空白', '清除异常',
      '修复', '修正', '修复一下', '净化', '整理数据',
      'VLOOKUP', 'vlookup',
      '计算出', '计算', '算',
    ]);
    const stopWords = new Set([
      '的', '了', '是', '在', '把', '被', '将', '就', '都', '也', '还',
      '对', '给', '让', '从', '到', '和', '与', '或', '跟',
      '这', '那', '哪', '它', '他', '她', '们',
      '一个', '一些', '一下', '这个', '那个', '哪个',
      '看看', '想要', '需要', '可以', '能', '会',
      '帮', '请', '麻烦', '帮忙', '帮我', '您好', '你好', '谢谢', '感谢',
      '对', '按', '把', '将', '的', '了', '进行',
    ]);

    const targets = keywords.filter(k =>
      !operationWords.has(k) && !stopWords.has(k) && k.length >= 2 && !excludeTargets.includes(k)
    );

    // 去重同时保持顺序
    return [...new Set(targets)];
  }

  /**
   * 提取聚合方式
   */
  private extractAggregation(lower: string): AggregationType {
    if (lower.includes('平均') || lower.includes('均值') || lower.includes('平均数') || lower.includes('avg')) return 'AVG';
    if (lower.includes('计数') || lower.includes('个数') || lower.includes('多少个') || lower.includes('count')) return 'COUNT';
    if (lower.includes('最大') || lower.includes('最高') || lower.includes('最多') || lower.includes('max')) return 'MAX';
    if (lower.includes('最小') || lower.includes('最低') || lower.includes('最少') || lower.includes('min')) return 'MIN';
    if (lower.includes('求和') || lower.includes('统计') || lower.includes('总计') || lower.includes('合计') || lower.includes('汇总') || lower.includes('总额') || lower.includes('总数')) return 'SUM';
    return null;
  }

  /**
   * 提取范围
   */
  private extractScope(lower: string): 'all' | 'selected' | 'filtered' {
    if (lower.includes('筛选') || lower.includes('过滤') || lower.includes('只看') || lower.includes('找出')) return 'filtered';
    if (lower.includes('选中') || lower.includes('勾选')) return 'selected';
    return 'all';
  }

  /**
   * 提取分组条件 — 语义推断，不依赖固定模板
   *
   * 核心逻辑：
   * 1. 检测 prompt 中是否有"分组/分布/分别/各/每/按"等群体性语义
   * 2. 如果有 → 是分组聚合，从 prompt 中提取对应的 groupBy 列
   * 3. 如果没有 → 全局聚合
   *
   * 列名匹配靠 availableColumns，不硬编码任何业务词
   */
  private extractGroupBy(prompt: string, _lower: string, columns: ColumnDef[]): string[] | undefined {
    // ── 分组语义指示词（按优先级） ──
    const groupIndicators = [
      // 强指示词：明确的分组语义（排除"排序"——它是排序列，不是分组）
      { pattern: /按(.+?)(?:统计|汇总|求和|分组|算|计算|分析|查看|展示|列出)/, extract: true },
      { pattern: /按(.+?)(?:来|进行)/, extract: true },
      // "各/每" 系列
      { pattern: /每(?:个|一)?(.+?)(?:的|$)/, extract: true },
      { pattern: /各(?:个|类|种)?(.+?)(?:的|$)/, extract: true },
      // "分别" 系列
      { pattern: /分别/, extract: false }, // 仅标记分组意图，不直接提取列名
      // "分X" 系列
      { pattern: /分(?:组|类|部门|地区|城市|产品)/, extract: false },
    ];

    let isGrouped = false;
    let groupHint = '';

    for (const indicator of groupIndicators) {
      const m = prompt.match(indicator.pattern);
      if (m) {
        isGrouped = true;
        if (indicator.extract && m[1]) {
          groupHint = m[1].trim();
          break;
        }
      }
    }

    if (!isGrouped) return undefined;

    // 有明确的分组列 hint → 匹配可用列名
    if (groupHint && columns.length > 0) {
      const exactMatch = columns.find(c => c.title === groupHint || c.key === groupHint);
      if (exactMatch) return [exactMatch.title];

      // 模糊匹配
      const fuzzyMatch = columns.find(c =>
        c.title.includes(groupHint) || groupHint.includes(c.title) ||
        c.title.toLowerCase() === groupHint.toLowerCase()
      );
      if (fuzzyMatch) return [fuzzyMatch.title];
    }

    // 有分组意图但没提具体列名 → 取第一个文本列作为分组列（合理兜底）
    // 例如"分别统计总和" → 用第一个文本列分组
    if (!groupHint && columns.length > 0) {
      const firstTextCol = columns.find(c => c.type !== 'number');
      if (firstTextCol) return [firstTextCol.title];
    }

    return groupHint ? [groupHint] : undefined;
  }

  /**
   * 提取过滤条件
   */
  private extractFilters(prompt: string, lower: string, _keywords: string[]): FilterCondition[] | undefined {
    const filters: FilterCondition[] = [];

    // 日期范围过滤
    const dateMatch = prompt.match(/(\d{4})年(\d{1,2})月/);
    if (dateMatch) {
      filters.push({
        column: '',
        operator: 'dateRange',
        value: {
          start: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-01`,
          end: `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-31`,
        },
      });
    }

    return filters.length > 0 ? filters : undefined;
  }

  /**
   * 提取 params（向后兼容）
   */
  private extractParams(lower: string, operation: Operation, _target: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (operation === 'sort') {
      params.asc = Boolean(
        lower.includes('升序') || lower.includes('从低到高') || lower.includes('从小到大')
      );
    }

    if (operation === 'filter') {
      // 识别比较运算符和提取数值
      let opType = 'eq';
      let filterValue = '';
      let hasOperator = false;

      // 从原文提取运算符后面的数值
      const patterns: { regex: RegExp; op: string }[] = [
        { regex: /大于等于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'gte' },
        { regex: /≥\s*(\d+)/, op: 'gte' },
        { regex: />=\s*(\d+)/, op: 'gte' },
        { regex: /大于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'gt' },
        { regex: /高于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'gt' },
        { regex: /超过\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'gt' },
        { regex: />\s*(\d+)/, op: 'gt' },
        { regex: /小于等于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'lte' },
        { regex: /≤\s*(\d+)/, op: 'lte' },
        { regex: /<=\s*(\d+)/, op: 'lte' },
        { regex: /小于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'lt' },
        { regex: /低于\s*([零一二三四五六七八九十百千万亿\d.]+)/, op: 'lt' },
        { regex: /<\s*(\d+)/, op: 'lt' },
        { regex: /等于\s*(.+?)(?:的|$)/, op: 'eq' },
        { regex: /包含\s*(.+?)(?:的|$)/, op: 'contains' },
        { regex: /叫\s*(.+?)(?:$|的|，|,)/, op: 'eq' },
        { regex: /是\s*(.+?)(?:$|的|，|,)/, op: 'eq' },
        { regex: /为\s*(.+?)(?:$|的|，|,)/, op: 'eq' },
      ];

      for (const p of patterns) {
        const m = lower.match(p.regex);
        if (m) {
          opType = p.op as any;
          const rawValue = m[1].trim();
          const numVal = chineseNumberToArabic(rawValue);
          filterValue = numVal !== null ? String(numVal) : rawValue;
          hasOperator = true;
          break;
        }
      }

      // 没有正则匹配到，回退到老的清理逻辑
      if (!hasOperator) {
        opType = lower.includes('包含') ? 'contains' : 'eq';
        const cleaned = lower.replace(/筛选|过滤|包含|等于|的|一下|表中/g, '').trim();
        filterValue = cleaned || '';
      }

      params.operator = opType;
      params.filterValue = filterValue;
    }

    if (operation === 'update') {
      // 提取填充/修改的值 — 匹配"为XX""改成XX""填充XX" 模式
      const valueMatch = lower.match(/(?:为|改成|改为|设为|设置为|填充为|填为|写成|替换为|替换成)\s*(.+?)(?:$|的|，|,)/);
      if (valueMatch) {
        params.value = valueMatch[1].trim();
      }
      // 也支持"全部改成XX"模式
      if (!params.value) {
        const allMatch = lower.match(/(?:全部改成|都改成|全部改为|都改为|都填为|全部填为)\s*(.+?)(?:$|的|，|,)/);
        if (allMatch) params.value = allMatch[1].trim();
      }
      // 提取 update 条件 — "空值/为空/null" → IS_NULL
      if (lower.includes('空值') || lower.includes('为空') || lower.includes('null') || lower.includes('空缺') || lower.includes('空白')) {
        params.updateCondition = 'IS_NULL';
      }
      if (lower.includes('不为空') || lower.includes('非空') || lower.includes('有值')) {
        params.updateCondition = 'NOT_NULL';
      }
    }

    if (operation === 'formula') {
      // 提取公式计算的目标列 — 匹配"新增XX列""计算XX""XX="
      const targetMatch = lower.match(/(?:新增|添加|增加|新|计算)\s*(.+?)(?:列|为|$)/);
      if (targetMatch) {
        params.targetColumn = targetMatch[1].trim();
      }
      // 从 "XX = YY × ZZ" 格式提取
      if (!params.targetColumn) {
        const eqMatch = lower.match(/(.+?)\s*[=＝]\s*.+/);
        if (eqMatch) params.targetColumn = eqMatch[1].trim();
      }
      // 检测表达式类型
      if (lower.includes('乘以') || lower.includes('×') || lower.includes('*')) {
        params.expressionType = '*';
      } else if (lower.includes('除以') || lower.includes('÷') || lower.includes('/')) {
        params.expressionType = '/';
      } else if (lower.includes('加上') || lower.includes('加') || lower.includes('+')) {
        params.expressionType = '+';
      } else if (lower.includes('减去') || lower.includes('减') || lower.includes('-')) {
        params.expressionType = '-';
      }
    }

    return params;
  }
}
