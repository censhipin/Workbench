/** 单个分词结果 */
export interface Token {
  text: string;
  isStopWord: boolean;
  isOperation: boolean;
}

/** 分词后的结构化结果 */
export interface TokenizedPrompt {
  original: string;
  tokens: Token[];
  keywords: string[];
  operationHints: string[];
}

/** 词条在同义词注册表中的一条映射 */
export interface SynonymEntry {
  canonical: string;
  variants: string[];
}

/** 意图词典中的一条操作定义 */
export interface LexiconEntry {
  operation: string;
  synonyms: string[];
  description: string;
}

/** 可配置的意图词典 */
export interface IntentLexiconConfig {
  entries: LexiconEntry[];
}

// ============================================================
// 语义类型 — 语义任务解析
// ============================================================

/** 聚合操作类型 */
export type AggregationType = 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN' | null;

/** 筛选条件 */
export interface FilterCondition {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'dateRange';
  value: string | { start: string; end: string };
  /** 逻辑连接词：AND 或 OR（默认 AND） */
  logic?: 'AND' | 'OR';
}

/** Schema Resolver 的候选匹配 */
export interface SchemaCandidate {
  key: string;
  title: string;
  confidence: number;
  matchMethod: 'semantic' | 'exact' | 'fuzzy';
  reason: string;
}

/** Schema Resolver 的解析结果 */
export interface SchemaResolution {
  target: string;
  candidates: SchemaCandidate[];
  isResolved: boolean;
  message: string;
}

// ============================================================
// 语义概念注册表
// ============================================================

/**
 * 语义概念 → 可能的实际列名模式
 * 例如 "销售额" → 匹配 "金额", "销售金额", "销售额", "总金额"
 * 每新增一种语义概念，在这里注册即可
 */
export interface ConceptPattern {
  /** 语义概念名称（e.g. "销售额", "工资"） */
  concept: string;
  /** 对应的列名关键词 */
  columnKeywords: string[];
  /** 预期的列类型 */
  expectedType?: 'number' | 'text' | 'date';
  /** 描述 */
  description: string;
}

/** 概念注册表，可配置化 */
export const DEFAULT_CONCEPT_REGISTRY: ConceptPattern[] = [
  // ---- 金额/财务类 ----
  { concept: '销售额', columnKeywords: ['金额', '销售金额', '销售额', '总金额', '收入', '营收', '营业额'], expectedType: 'number', description: '销售相关的金额数值' },
  { concept: '工资', columnKeywords: ['工资', '薪资', '薪酬', '收入', '基本工资', '底薪'], expectedType: 'number', description: '工资相关的数值' },
  { concept: '绩效', columnKeywords: ['绩效', '奖金', '绩效奖金', '绩效工资', '提成'], expectedType: 'number', description: '绩效相关的数值' },
  { concept: '加班费', columnKeywords: ['加班', '加班补贴', '加班费', '加班工资'], expectedType: 'number', description: '加班相关的数值' },
  { concept: '扣除', columnKeywords: ['扣除', '扣款', '扣除项', '扣减', '罚款'], expectedType: 'number', description: '扣除相关的数值' },
  { concept: '单价', columnKeywords: ['单价', '价格', '售价', '定价'], expectedType: 'number', description: '物品的单价' },
  { concept: '数量', columnKeywords: ['数量', '个数', '件数'], expectedType: 'number', description: '物品的数量' },
  { concept: '总额', columnKeywords: ['总额', '合计', '总计', '总金额', '小计'], expectedType: 'number', description: '汇总后的总金额' },

  // ---- 人员类 ----
  { concept: '姓名', columnKeywords: ['姓名', '名字', '名称', '员工姓名'], expectedType: 'text', description: '人员姓名' },
  { concept: '手机号', columnKeywords: ['手机', '手机号', '电话', '联系电话', '手机号码', '移动电话'], expectedType: 'text', description: '手机号码' },
  { concept: '邮箱', columnKeywords: ['邮箱', '邮件', 'Email', '电子邮件', '电子邮箱'], expectedType: 'text', description: '电子邮箱地址' },
  { concept: '身份证', columnKeywords: ['身份证', '身份证号', '证件号', '证件号码', 'ID'], expectedType: 'text', description: '身份证号码' },

  // ---- 时间类 ----
  { concept: '日期', columnKeywords: ['日期', '时间', '年月日', '日'], expectedType: 'date', description: '日期数据' },
  { concept: '入职日期', columnKeywords: ['入职', '入职日期', '入职时间', '入职日'], expectedType: 'date', description: '入职日期' },

  // ---- 组织类 ----
  { concept: '部门', columnKeywords: ['部门', '科室', '组', '团队', '事业部'], expectedType: 'text', description: '部门信息' },
  { concept: '产品', columnKeywords: ['产品', '产品名称', '商品', '商品名称', '项目'], expectedType: 'text', description: '产品名称' },
  { concept: '区域', columnKeywords: ['区域', '地区', '城市', '省份', '地点', '地址'], expectedType: 'text', description: '区域信息' },
  { concept: '岗位', columnKeywords: ['岗位', '职位', '职务', '职称', '角色'], expectedType: 'text', description: '岗位信息' },
];
