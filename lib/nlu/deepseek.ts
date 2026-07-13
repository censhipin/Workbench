// ============================================================
// DeepSeek NLU — AI 语义理解层
// ============================================================
// 职责：将用户自然语言 → 标准化 TaskPlan JSON
//   - 构建 System Prompt（含表名、列名、样本数据）
//   - 通过 Next.js API 代理调用 DeepSeek（避免 CORS）
//   - 解析返回的 JSON，校验格式
//   - 如果不可用/返回异常，返回 null（触发 Fallback）
// ============================================================

import { ColumnDef } from '../types';
import { TaskPlan } from './taskplan-types';
import { getSampleRows } from './sampler';
import { getApiKey } from '@/lib/api-key';

/** 构建发送给 DeepSeek 的 system prompt */
function buildSystemPrompt(
  tableName: string,
  columns: ColumnDef[],
  sampleData: Record<string, string[]>,
  extraTables?: string[],
): string {
  const colDescriptions = columns.map(c => {
    const sample = sampleData[c.key];
    if (!sample || sample.length === 0) return `  - "${c.title}" (类型: ${c.type}) 示例: (暂无数据)`;
    const sampleStr = sample.slice(0, 10).join(', ');
    return `  - "${c.title}" (类型: ${c.type}) 示例: ${sampleStr}`;
  }).join('\n');

  let extraTableInfo = '';
  if (extraTables && extraTables.length > 0) {
    extraTableInfo = '\n\n当前任务中其他表: ' + extraTables.join(', ');
    extraTableInfo += '\n当指令涉及合并或匹配时，可以从这些表中选取目标表。';
  }

  return `你是一个数据分析助手。你需要将用户的自然语言指令转换为标准化的 JSON 执行计划。

当前表名称: "${tableName}"
当前表的列:
${colDescriptions}${extraTableInfo}

可执行动作列表:
- sort: 排序（需 columnHint + direction: asc/desc）
- filter: 筛选（需 conditions）
- aggregate: 聚合统计（需 method: sum/avg/count/max/min + columnHints）
- delete: 删除数据（需 conditions）
- dedup: 去重（需 columnHints）
- match: 多表匹配（需 matchKeyHint + lookupTableHint）
- merge: 多表合并（将多行数据堆叠合并，注意：这是表级别的合并，不是把两列内容拼接到一列）
- clean: 数据清洗
- select: 只保留指定列（需 columns 数组，如 ["姓名","电话"]）
- remove: 删除指定列（需 columns 数组，如 ["邮箱","身份证"]）
- rename: 重命名列（需 column + newName，如 {"column":"手机号","newName":"联系电话"}）
- projection: 组合字段操作
- update: 批量修改/填充列值（需 column + value + 可选 conditions）
- formula: 新增计算列（需 targetColumn + sourceColumnHints + expressionType）
- pipeline: 多个操作顺序执行（需 steps 数组，每步是一个 TaskPlan）
- pivot: 透视表/交叉汇总（需 columnHints 行维度 + valueField 值列 + method 聚合方法，可选 groupByHints 列维度）
- output: 所有动作都可以附加输出约束

输出约束示例:
{"action":"filter","conditions":[{"columnHint":"列A","operator":"=","value":"值"}],"output":{"includeColumns":["列A","列B"]}}
→ 筛选后只保留列A和列B

示例输出（严格按这个格式）:

# 常规操作
筛选列A等于某个值的数据 →
{"action":"filter","conditions":[{"columnHint":"列A","operator":"=","value":"值"}]}

筛选基本工资在5000到10000之间 →
{"action":"filter","conditions":[{"columnHint":"基本工资","operator":"dateRange","value":{"start":"5000","end":"10000"}}]}

筛选部门等于技术部或者部门等于销售部 →
{"action":"filter","conditions":[{"columnHint":"部门","operator":"=","value":"技术部"},{"columnHint":"部门","operator":"=","value":"销售部","logic":"OR"}]}

筛选库存数量大于安全库存的产品（列间比较：库存数量列 > 安全库存列）→
{"action":"filter","conditions":[{"columnHint":"库存数量","operator":">","valueColumn":"安全库存"}]}

按列A从高到低排序 →
{"action":"sort","columnHint":"列A","direction":"desc"}

按列A从高到低排序取前5名 →
{"action":"sort","columnHint":"列A","direction":"desc","limit":5}

统计列A的总和 →
{"action":"aggregate","method":"sum","columnHints":["列A"]}

按列B统计列A的总和 →
{"action":"aggregate","method":"sum","columnHints":["列A"],"groupByHints":["列B"]}

每个列B的列A平均值 →
{"action":"aggregate","method":"avg","columnHints":["列A"],"groupByHints":["列B"]}

按列B统计列A的总和和列C的最大值 →
{"action":"aggregate","aggregations":[{"columnHint":"列A","method":"sum"},{"columnHint":"列C","method":"max"}],"groupByHints":["列B"]}

每个列B的列A平均值和列C的总和 →
{"action":"aggregate","aggregations":[{"columnHint":"列A","method":"avg"},{"columnHint":"列C","method":"sum"}],"groupByHints":["列B"]}

按部门统计平均工资和人数 →
{"action":"aggregate","aggregations":[{"columnHint":"基本工资","method":"avg"},{"columnHint":"姓名","method":"count"}],"groupByHints":["部门"]}

按部门统计平均工资和部门人数（使用 alias 自定义列名）→
{"action":"aggregate","aggregations":[{"columnHint":"基本工资","method":"avg","alias":"平均工资"},{"columnHint":"姓名","method":"count","alias":"人数"}],"groupByHints":["部门"]}

删除列A为空的数据 →
{"action":"delete","conditions":[{"columnHint":"列A","operator":"isNull"}]}

列A为空的值填充为某值 →
{"action":"update","column":"列A","value":"某值","conditions":[{"columnHint":"列A","operator":"isNull"}]}

# formula 公式计算（新增列）
新增列C = 列A × 列B →
{"action":"formula","targetColumn":"列C","sourceColumnHints":["列A","列B"],"expressionType":"*","expression":"列A*列B"}

列C = 列A - 列B →
{"action":"formula","targetColumn":"列C","sourceColumnHints":["列A","列B"],"expressionType":"-","expression":"列A-列B"}

实发工资 = 基本工资 × 绩效 + 基本工资 →
{"action":"formula","targetColumn":"实发工资","sourceColumnHints":["基本工资","绩效"],"expressionType":"*","expression":"实发工资 = 基本工资*绩效+基本工资"}

列A保留两位小数 →
{"action":"formula","targetColumn":"列A","sourceColumnHints":["列A"],"expressionType":"ROUND","decimalPlaces":2}

如果列A大于某值则等于某值，否则等于某值 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"IF","conditionColumnHint":"列A","conditionOperator":">","conditionValue":"某值","trueValue":"真值","falseValue":"假值"}

用列A算到今天有多少年 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"DATEDIF"}

从列A第7位取8位 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"MID","startPos":7,"charCount":8}

提取列A的第一个字 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"LEFT","charCount":1}

提取列A的后3位 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"RIGHT","charCount":3}

计算列A的长度 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"LEN"}

提取列A的年份 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"YEAR"}

提取列A的月份 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"MONTH"}

提取列A的日 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"DAY"}

新增一列今天日期 →
{"action":"formula","targetColumn":"列A","sourceColumnHints":[],"expressionType":"TODAY"}

统计列A大于某值的数量 →
{"action":"formula","targetColumn":"列B","sourceColumnHints":["列A"],"expressionType":"COUNTIF","conditionColumnHint":"列A","conditionOperator":">","conditionValue":"某值","trueValue":"1"}

将列A和列B合并为一列 →
{"action":"formula","targetColumn":"列C","sourceColumnHints":["列A","列B"],"expressionType":"CONCAT","expression":"CONCAT(列A,列B)"}

用逗号合并列A和列B →
{"action":"formula","targetColumn":"列C","sourceColumnHints":["列A","列B"],"expressionType":"TEXTJOIN","constantOperand":",","expression":"TEXTJOIN(\",\",列A,列B)"}

# pipeline 多步操作
操作1，再操作2 →
{"action":"pipeline","steps":[{"action":"filter","conditions":[{"columnHint":"列A","operator":"=","value":"某值"}]},{"action":"sort","columnHint":"列B","direction":"desc"}]}

# 透视表
按业务员统计各状态的金额总和 →
{"action":"pivot","columnHints":["业务员"],"valueField":"金额","method":"sum","groupByHints":["状态"]}

按客户汇总销售额 →
{"action":"pivot","columnHints":["客户"],"valueField":"销售额","method":"sum"}

每个业务员的平均金额 →
{"action":"pivot","columnHints":["业务员"],"valueField":"金额","method":"avg"}

统计各部门各职级的人数 →
{"action":"pivot","columnHints":["部门","职级"],"valueField":"姓名","method":"count"}

	要求:
6. 公式支持直接写完整表达式（如 "实发工资 = 基本工资 * 绩效 + 基本工资"），用 expression 字段传递，不要拆解为 pipeline 多步
7. "新增列/新增一列"是 formula，"把XX改成/增加"是 update
8. 新增列=列A×0.9：使用 constantOperand 传常量
1. 只输出 JSON，不要输出任何解释、Markdown、自然语言
2. JSON 必须符合上述格式
3. columnHint 使用中文列名（如"销售人员"、"金额"），不要使用 key
4. 如果无法理解用户意图，输出 {"action":"unknown","reason":"具体原因"}
5. 条件中的值使用用户输入的原值`;
}

/** 构建 user message content */
function buildUserMessage(prompt: string): string {
  return `请解析以下指令：\n${prompt}`;
}

/** 通过 Next.js API 代理调用 DeepSeek（避免浏览器 CORS） */
async function callDeepSeek(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  // 从 page.tsx 发起的调用可以通过 API 路由代理
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  // 从 localStorage 读取用户设置的 API Key
  const apiKey = getApiKey();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-deepseek-api-key'] = apiKey;
  }

  const response = await fetch(`${origin}/api/deepseek`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ systemPrompt, userMessage }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    const isQuotaError = response.status === 401 || response.status === 402
      || errBody.toLowerCase().includes('insufficient')
      || errBody.toLowerCase().includes('quota')
      || errBody.toLowerCase().includes('insufficient_balance');
    if (isQuotaError) {
      throw new QuotaError(`API Key 无效或额度不足 (${response.status})，请在设置中重新配置`);
    }
    throw new Error(`DeepSeek proxy error: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek returned empty response');
  }
  return content;
}

/** 解析 DeepSeek 返回的内容，提取 JSON */
function parseResponse(content: string): TaskPlan {
  let jsonStr = content.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }
  const raw = JSON.parse(jsonStr) as any;
  if (!raw.action) {
    throw new Error('TaskPlan missing action field');
  }

  // 兼容 DeepSeek 可能输出的不同格式
  // 格式1: {action, conditions: [{columnHint, operator, value}]} — 标准格式
  // 格式2: {action, params: {column, operator, value}} — 旧格式
  const plan: TaskPlan = { action: raw.action };

  if (raw.columnHint) plan.columnHint = raw.columnHint;
  if (raw.direction) plan.direction = raw.direction;
  if (raw.method) plan.method = raw.method;
  if (raw.columnHints) plan.columnHints = raw.columnHints;
  if (raw.lookupTableHint) plan.lookupTableHint = raw.lookupTableHint;
  if (raw.matchKeyHint) plan.matchKeyHint = raw.matchKeyHint;
  if (raw.groupByHints) plan.groupByHints = raw.groupByHints;
  if (raw.limit) plan.limit = raw.limit;
  if (raw.reason) plan.reason = raw.reason;
  if (raw.output) plan.output = raw.output;

  // formula 字段
  if (raw.targetColumn) plan.targetColumn = raw.targetColumn;
  if (raw.sourceColumnHints) plan.sourceColumnHints = raw.sourceColumnHints;
  if (raw.expressionType) plan.expressionType = raw.expressionType;
  if (raw.expression) plan.expression = raw.expression;
  if (raw.decimalPlaces !== undefined) plan.decimalPlaces = raw.decimalPlaces;
  if (raw.constantOperand !== undefined) plan.constantOperand = raw.constantOperand;

  // IF / formula 条件相关字段
  if (raw.conditionColumnHint) plan.conditionColumnHint = raw.conditionColumnHint;
  if (raw.conditionOperator) plan.conditionOperator = raw.conditionOperator;
  if (raw.conditionValue !== undefined) plan.conditionValue = raw.conditionValue;
  if (raw.trueValue !== undefined) plan.trueValue = raw.trueValue;
  if (raw.falseValue !== undefined) plan.falseValue = raw.falseValue;

  // MID / 文本函数相关字段
  if (raw.charCount !== undefined) plan.charCount = raw.charCount;
  if (raw.startPos !== undefined) plan.startPos = raw.startPos;

  // update 字段
  if (raw.value !== undefined) plan.value = raw.value;
  if (raw.column) plan.column = raw.column;
  if (raw.updateColumn) plan.updateColumn = raw.updateColumn;

  // pipeline 字段
  if (raw.steps) plan.steps = raw.steps;

  // select/remove/rename 字段
  if (raw.columns) plan.columns = raw.columns;
  if (raw.column) plan.column = raw.column;
  if (raw.newName) plan.newName = raw.newName;
  if (raw.includeColumns) plan.includeColumns = raw.includeColumns;
  if (raw.excludeColumns) plan.excludeColumns = raw.excludeColumns;
  if (raw.renameColumns) plan.renameColumns = raw.renameColumns;
  if (raw.reorderColumns) plan.reorderColumns = raw.reorderColumns;

  // 多列聚合：每列独立方法
  if (raw.aggregations && Array.isArray(raw.aggregations)) {
    plan.aggregations = raw.aggregations.map((a: any) => ({
      columnHint: a.columnHint || a.column,
      method: a.method || 'sum',
      alias: a.alias,
    }));
  }

  // 兼容 conditions 字段
  if (raw.conditions) {
    plan.conditions = raw.conditions;
  } else if (raw.params && raw.params.column) {
    // 兼容 {action, params: {column, operator, value}} 格式
    const op = raw.params.operator || '=';
    plan.conditions = [{
      columnHint: raw.params.column,
      operator: op,
      value: raw.params.value,
    }];
  }

  return plan;
}

export interface DeepSeekResult {
  success: boolean;
  plan: TaskPlan | null;
  error?: string;
  isQuotaError?: boolean;
}

/**
 * 判断 DeepSeek 错误是否是额度/Key 问题
 */
export function isQuotaError(err: unknown): boolean {
  return err instanceof QuotaError;
}

/**
 * 自定义错误类：API 额度不足或 Key 无效
 */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaError';
  }
}

/**
 * 主入口：用 DeepSeek 理解用户输入，输出 TaskPlan
 * 通过本地 API 路由代理调用 DeepSeek，避免 CORS 问题
 * 如果 API 不可用或解析失败，返回 { success: false } 触发 Fallback
 */
export async function deepseekUnderstand(
  prompt: string,
  tableName: string,
  columns: ColumnDef[],
  rows: Record<string, string | number | null>[],
  fileNames?: string[]
): Promise<DeepSeekResult> {
  try {
    const sampleData = getSampleRows(columns, rows, 10);
    const systemPrompt = buildSystemPrompt(tableName, columns, sampleData, fileNames);
    const userMessage = buildUserMessage(prompt);
    const raw = await callDeepSeek(systemPrompt, userMessage);
    const plan = parseResponse(raw);
    return { success: true, plan };
  } catch (err) {
    const isQuota = err instanceof QuotaError;
    return {
      success: false,
      plan: null,
      error: err instanceof Error ? err.message : String(err),
      isQuotaError: isQuota,
    };
  }
}
