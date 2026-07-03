// ============================================================
// Semantic Interpreter — 语义解释器
// ============================================================
// 职责：
//   将自然语言解析片段（ParsedCondition）解释为语义化条件
//   不依赖任何具体列名，只输出抽象语义字段（semanticField）
//
//   支持：
//   - 已知字段词 → 语义概念（"工资" → "工资"）
//   - 隐式值 → 语义推断（"技术部" → "部门"，"杭州" → "城市"）
//   - 数值条件绑定最近字段
//   - 跨条件上下文推断
// ============================================================

import type { ColumnDef } from '../types';
import { DEFAULT_CONCEPT_REGISTRY, type ConceptPattern } from './types';

/** 语义条件（已解释，不依赖具体列名） */
export interface SemanticCondition {
  /** 语义字段名（抽象概念，如 "部门"、"工资"、"城市"） */
  semanticField: string;
  /** 算子字符串 */
  operator: string;
  /** 比较值 */
  value: string | number;
  /** 逻辑连接词 */
  logic?: 'AND' | 'OR';
  /** 是否为值推导的语义字段 */
  isInferred?: boolean;
}

/** 输入条件（来自条件提取器） */
interface RawCondition {
  columnHint?: string;
  operator: string;
  value: string | number;
  isValueOnly: boolean;
  logic?: 'AND' | 'OR';
}

/**
 * 语义解释器
 * 将原始条件片段 → 语义化条件（不依赖列名）
 */
export class SemanticInterpreter {
  private concepts: ConceptPattern[];

  constructor(concepts?: ConceptPattern[]) {
    this.concepts = concepts ?? DEFAULT_CONCEPT_REGISTRY;
  }

  /**
   * 主入口：将原始条件列表解释为语义条件
   */
  interpret(conditions: RawCondition[], _columns?: ColumnDef[]): SemanticCondition[] {
    if (conditions.length === 0) return [];

    // Step 1: 建立上下文 — 收集所有已知的概念引用
    const knownConcepts = this.buildContext(conditions);

    // Step 2: 逐个解释条件
    const result: SemanticCondition[] = [];
    for (const cond of conditions) {
      const interpreted = this.interpretOne(cond, knownConcepts);
      result.push(interpreted);
      // 更新上下文（新增的概念后续条件可参考）
      if (interpreted.semanticField && !interpreted.isInferred) {
        knownConcepts.add(interpreted.semanticField);
      }
    }
    return result;
  }

  /**
   * 从所有条件中收集已知概念（有 columnHint 且匹配概念的）
   */
  private buildContext(conditions: RawCondition[]): Set<string> {
    const known = new Set<string>();
    for (const cond of conditions) {
      if (cond.columnHint && !cond.isValueOnly) {
        const concept = this.matchConcept(cond.columnHint);
        if (concept) known.add(concept);
      }
    }
    return known;
  }

  /**
   * 解释单个条件
   */
  private interpretOne(cond: RawCondition, context: Set<string>): SemanticCondition {
    // Case 1: 有明确的字段提示 → 解释为概念
    if (cond.columnHint && !cond.isValueOnly) {
      const concept = this.matchConcept(cond.columnHint);
      if (concept) {
        return {
          semanticField: concept,
          operator: cond.operator,
          value: cond.value,
          logic: cond.logic,
          isInferred: false,
        };
      }
      // 字段提示不在概念库 → 当作原始字段名保留
      return {
        semanticField: cond.columnHint,
        operator: cond.operator,
        value: cond.value,
        logic: cond.logic,
        isInferred: false,
      };
    }

    // Case 2: 纯值条件（isValueOnly）→ 尝试推断语义
    const valueStr = String(cond.value);
    const inferred = this.inferField(valueStr, context);
    return {
      semanticField: inferred,
      operator: cond.operator,
      value: cond.value,
      logic: cond.logic,
      isInferred: true,
    };
  }

  /**
   * 将字段词匹配到语义概念
   * "工资" → "工资"、"基本工资" → "工资"、"金额" → "销售额"
   */
  private matchConcept(hint: string): string | null {
    const lowerHint = hint.toLowerCase();

    for (const concept of this.concepts) {
      const keywordMatch = concept.columnKeywords.some(
        kw => kw.toLowerCase() === lowerHint
          || kw.toLowerCase().includes(lowerHint)
          || lowerHint.includes(kw.toLowerCase())
      );
      if (keywordMatch) return concept.concept;
      if (concept.concept.toLowerCase() === lowerHint) return concept.concept;
    }
    return null;
  }

  /**
   * 从值推断语义字段（纯模式驱动，不依赖列名）
   *
   * 策略（按优先级）：
   * 1. 跨条件上下文推断：如果上下文已有某概念，且值看起来像该概念的值 → 采用
   * 2. 值模式匹配：通过值的文本模式推断概念
   * 3. 纯数字 → 映射到上下文中最近的数值概念
   * 4. 兜底 → 使用值本身作为语义字段
   */
  private inferField(value: string, context: Set<string>): string {
    if (!value || value.length < 1) return value;

    // 策略1: 检查值是否是纯数字
    if (/^\d+(\.\d+)?$/.test(value)) {
      // 纯数字 → 尝试找上下文中的数值概念
      const numericConcepts = this.concepts
        .filter(c => c.expectedType === 'number')
        .map(c => c.concept);
      for (const nc of numericConcepts) {
        if (context.has(nc)) return nc;
      }
      // 兜底：保持值不变
      return value;
    }

    // 策略2: 值模式匹配（结构化的语义推断）
    const patternField = this.matchValuePattern(value);
    if (patternField) return patternField;

    // 策略3: 跨条件上下文 — 如果值看起来像是已知概念的实例
    for (const conceptName of context) {
      const concept = this.concepts.find(c => c.concept === conceptName);
      if (concept && concept.expectedType === 'text') {
        // 上下文中的文本概念 → 将值归入该概念
        return conceptName;
      }
    }

    // 策略4: 值本身就是语义线索（如"技术部" → "部门"）
    // 检查值是否匹配任何概念的关键词
    for (const concept of this.concepts) {
      for (const kw of concept.columnKeywords) {
        if (value.includes(kw) || kw.includes(value)) {
          return concept.concept;
        }
      }
    }

    // 兜底：值本身
    return value;
  }

  /**
   * 值模式匹配 — 通过文本结构推断概念
   * 不硬编码业务词，只使用通用模式
   */
  private matchValuePattern(value: string): string | null {
    // 以"部"结尾 → 组织/部门类概念
    if (/^.+部$/.test(value)) {
      return '部门';
    }
    // 以"人"结尾 → 人员
    if (/^.+人$/.test(value)) {
      return '姓名';
    }
    // 含"市"、"省" → 区域
    if (/市$/.test(value) || /省$/.test(value)) {
      return '区域';
    }
    // 纯中文姓名模式（2-3字）
    if (/^[一-鿿]{2,3}$/.test(value)) {
      // 可能是姓名，但不强推
    }
    return null;
  }
}
