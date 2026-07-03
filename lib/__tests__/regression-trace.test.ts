// ============================================================
// 全链路回归追踪测试
// 不修 bug，只输出每层的真实状态
// ============================================================
import { describe, it, expect } from 'vitest';
import { parseAndResolve, parseIntent } from '../nlu';
import { compile } from '../v2/task-compiler';
import { runExecutionPlan } from '../v2/execution-engine';
import { runExecutionEngine } from '../execution-engine';
import { tokenize } from '../nlu/tokenizer';
import type { ColumnDef, RowData, WorkbenchFile } from '../types';

const columns: ColumnDef[] = [
  { key: '员工ID', title: '员工ID', type: 'text' },
  { key: '姓名', title: '姓名', type: 'text' },
  { key: '部门', title: '部门', type: 'text' },
  { key: '岗位', title: '岗位', type: 'text' },
  { key: '城市', title: '城市', type: 'text' },
  { key: '年龄', title: '年龄', type: 'number' },
  { key: '入职日期', title: '入职日期', type: 'date' },
  { key: '基本工资', title: '基本工资', type: 'number' },
  { key: '绩效', title: '绩效', type: 'number' },
  { key: '手机号', title: '手机号', type: 'text' },
  { key: '状态', title: '状态', type: 'text' },
];

// 用真实的少数行模拟
const rows: RowData[] = [
  { 员工ID: 'E00001', 姓名: '员工1', 部门: '财务部', 岗位: '专员', 城市: '西安', 年龄: 57, 入职日期: '2019-08-29', 基本工资: 8113, 绩效: 0.45, 手机号: '18794548274', 状态: '在职' },
  { 员工ID: 'E00002', 姓名: '员工2', 部门: '人事部', 岗位: '主管', 城市: '成都', 年龄: 51, 入职日期: '2023-10-13', 基本工资: 29320, 绩效: 0.22, 手机号: '13446900412', 状态: '在职' },
  { 员工ID: 'E00003', 姓名: '员工3', 部门: '运营部', 岗位: '经理', 城市: '成都', 年龄: 23, 入职日期: '2018-05-11', 基本工资: 31759, 绩效: 0.74, 手机号: '18528911470', 状态: '在职' },
  { 员工ID: 'E00004', 姓名: '员工4', 部门: '技术部', 岗位: '主管', 城市: '广州', 年龄: 22, 入职日期: '2022-11-26', 基本工资: 8600, 绩效: 0.47, 手机号: '17665749399', 状态: '在职' },
  { 员工ID: 'E00005', 姓名: '员工5', 部门: '技术部', 岗位: '专家', 城市: '深圳', 年龄: 49, 入职日期: '2015-05-22', 基本工资: 31109, 绩效: 0.98, 手机号: '18131233477', 状态: '离职' },
  { 员工ID: 'E00006', 姓名: '员工6', 部门: '销售部', 岗位: '专员', 城市: '上海', 年龄: 41, 入职日期: '2021-03-28', 基本工资: 6598, 绩效: 0.57, 手机号: '16615771372', 状态: '在职' },
  { 员工ID: 'E00007', 姓名: '员工7', 部门: '技术部', 岗位: '经理', 城市: '广州', 年龄: 30, 入职日期: '2019-01-13', 基本工资: 14986, 绩效: 0.85, 手机号: '17665749399', 状态: '在职' },
  { 员工ID: 'E00008', 姓名: '员工8', 部门: '销售部', 岗位: '主管', 城市: '杭州', 年龄: 34, 入职日期: '2018-08-30', 基本工资: 16925, 绩效: 0.36, 手机号: '19478335694', 状态: '在职' },
];

const mockFile: WorkbenchFile = {
  id: 'test',
  name: '员工信息表_5000行.xlsx',
  icon: '👤',
  sheets: [{ name: '员工信息', columns, rows }],
  rowCount: rows.length,
  colCount: columns.length,
  isMock: false,
};

const fileNames = ['员工信息表_5000行.xlsx'];

// ============================================================
// 第一层：NLU 解析层（tokenize + 操作识别 + target提取）
// ============================================================
describe('LAYER 1: NLU 解析', () => {
  it('TC001: "筛选技术部员工" → tokenize结果', () => {
    const extraLexicon = [...columns.map(c => c.title), '筛选'];
    // @ts-ignore private method - just see keyword extraction
    const t = tokenize('筛选技术部员工', extraLexicon);
    console.log('TC001 关键词:', t.keywords);
    console.log('TC001 tokens:', t.tokens.map(t => t.text));
  });

  it('TC003: "筛选基本工资大于10000" → tokenize结果', () => {
    const extraLexicon = [...columns.map(c => c.title), '筛选'];
    const t = tokenize('筛选基本工资大于10000', extraLexicon);
    console.log('TC003 关键词:', t.keywords);
    console.log('TC003 tokens:', t.tokens.map(t => t.text));
  });
});

// ============================================================
// 第二层：规则解析 → TaskIntent
// ============================================================
describe('LAYER 2: Rule Parser → TaskIntent', () => {
  it('TC001: parseIntent("筛选技术部员工")', () => {
    const result = parseAndResolve('筛选技术部员工', columns, fileNames);
    console.log('TC001 intent:', JSON.stringify({
      operation: result.intent.operation,
      target: result.intent.target,
      filters: result.intent.filters,
      params: result.intent.params,
      groupBy: result.intent.groupBy,
      confidence: result.intent.confidence,
    }, null, 2));
    console.log('TC001 resolution:', result.resolution);
  });

  it('TC002: parseIntent("筛选销售部的员工")', () => {
    const result = parseAndResolve('筛选销售部的员工', columns, fileNames);
    console.log('TC002 intent:', JSON.stringify({
      operation: result.intent.operation,
      target: result.intent.target,
      filters: result.intent.filters,
      params: result.intent.params,
    }, null, 2));
  });

  it('TC003: parseIntent("筛选基本工资大于10000的数据")', () => {
    const result = parseAndResolve('筛选基本工资大于10000的数据', columns, fileNames);
    console.log('TC003 intent:', JSON.stringify({
      operation: result.intent.operation,
      target: result.intent.target,
      targetColumns: result.intent.targetColumns,
      filters: result.intent.filters,
      params: result.intent.params,
    }, null, 2));
    console.log('TC003 resolution:', result.resolution);
  });

  it('TC004: parseIntent("筛选基本工资小于8000的数据")', () => {
    const result = parseAndResolve('筛选基本工资小于8000的数据', columns, fileNames);
    console.log('TC004 intent:', JSON.stringify({
      operation: result.intent.operation,
      target: result.intent.target,
      filters: result.intent.filters,
      params: result.intent.params,
    }, null, 2));
  });
});

// ============================================================
// 第三层：编译层 TaskIntent → ExecutionPlan
// ============================================================
describe('LAYER 3: Compile → ExecutionPlan', () => {
  it('TC001: 规则解析后的 v2plan', () => {
    const result = parseAndResolve('筛选技术部员工', columns, fileNames);
    const intent = result.intent;
    if (intent.v2plan) {
      console.log('TC001 v2plan:', JSON.stringify(intent.v2plan, null, 2));
    } else {
      console.log('TC001: 无 v2plan，走旧引擎');
    }
  });

  it('TC003: 规则解析后的 v2plan', () => {
    const result = parseAndResolve('筛选基本工资大于10000的数据', columns, fileNames);
    const intent = result.intent;
    if (intent.v2plan) {
      console.log('TC003 v2plan:', JSON.stringify(intent.v2plan, null, 2));
    }
  });
});

// ============================================================
// 第四层：执行层 ExecutionPlan → Executor → 结果
// ============================================================
describe('LAYER 4: ExecutionEngine 执行', () => {
  it('TC001: runExecutionEngine("筛选技术部员工")', () => {
    const parsed = parseAndResolve('筛选技术部员工', columns, fileNames);
    console.log('=== TC001 执行开始 ===');
    console.log('intent.operation:', parsed.intent.operation);
    console.log('intent.target:', parsed.intent.target);
    console.log('intent.params:', JSON.stringify(parsed.intent.params));
    console.log('intent.filters:', JSON.stringify(parsed.intent.filters));

    const r = runExecutionEngine(parsed.intent, mockFile, '员工信息', [mockFile]);
    console.log('执行成功?', r.success);
    console.log('结果行数:', r.resultData?.rows?.length ?? 0);
    console.log('错误:', r.error);
    if (r.resultData) {
      console.log('结果列:', r.resultData.columns.map(c => c.title));
      console.log('部门值:', r.resultData.rows.slice(0,3).map(row => row['部门']));
    }
  });

  it('TC003: runExecutionEngine("筛选基本工资大于10000的数据")', () => {
    const parsed = parseAndResolve('筛选基本工资大于10000的数据', columns, fileNames);
    console.log('=== TC003 执行开始 ===');
    console.log('intent.operation:', parsed.intent.operation);
    console.log('intent.target:', parsed.intent.target);
    console.log('intent.params:', JSON.stringify(parsed.intent.params));
    console.log('intent.filters:', JSON.stringify(parsed.intent.filters));

    const r = runExecutionEngine(parsed.intent, mockFile, '员工信息', [mockFile]);
    console.log('执行成功?', r.success);
    console.log('结果行数:', r.resultData?.rows?.length ?? 0);
    console.log('错误:', r.error);
  });
});

// ============================================================
// 第五层：UI路径模拟（AI first + AmbiguityDetector）
// ============================================================
describe('LAYER 5: UI路径（AI优先→规则fallback）', () => {
  it('TC001: 模拟UI路径 parseIntentWithAI（无API Key时）', async () => {
    // 没 API Key 时 parseIntentWithAI 会调用 deepseekUnderstand → 失败 → 走 fallback
    // 我们直接测 fallback 路径
    const fallback = parseAndResolve('筛选技术部员工', columns, fileNames);
    console.log('=== fallback intent ===');
    console.log('operation:', fallback.intent.operation);
    console.log('target:', fallback.intent.target);
    console.log('filters:', JSON.stringify(fallback.intent.filters));
    console.log('params:', JSON.stringify(fallback.intent.params));
    console.log('v2plan:', fallback.intent.v2plan ? '存在' : '不存在');

    // 检查是否触发了 AmbiguityDetector
    const { AmbiguityDetector } = await import('../ambiguity-detector');
    const ambResult = AmbiguityDetector.detect(fallback.intent, fallback.resolution.candidates);
    console.log('歧义检测:', ambResult ? ambResult.type : '无歧义');
    if (ambResult) {
      console.log('歧义消息:', ambResult.description);
    }
  });

  it('TC003: 模拟UI路径 parseIntentWithAI + ambiguity check', async () => {
    const fallback = parseAndResolve('筛选基本工资大于10000的数据', columns, fileNames);
    console.log('=== fallback intent ===');
    console.log('operation:', fallback.intent.operation);
    console.log('target:', fallback.intent.target);
    console.log('filters:', JSON.stringify(fallback.intent.filters));
    console.log('params:', JSON.stringify(fallback.intent.params));
    console.log('v2plan:', JSON.stringify(fallback.intent.v2plan));

    const { AmbiguityDetector } = await import('../ambiguity-detector');
    const ambResult = AmbiguityDetector.detect(fallback.intent, fallback.resolution.candidates);
    console.log('歧义检测:', ambResult ? ambResult.type : '无歧义');
  });

  it('TC004: 验证第二次执行是否会被 isRunning 阻塞', () => {
    // 模拟：第一次执行后状态变化
    const fallback = parseAndResolve('筛选基本工资小于8000的数据', columns, fileNames);
    console.log('operation:', fallback.intent.operation);
    console.log('target:', fallback.intent.target);
    console.log('filters:', JSON.stringify(fallback.intent.filters));
    console.log('v2plan:', fallback.intent.v2plan ? '存在' : '不存在');

    // 如果 v2plan 存在，走 V2 路径
    if (fallback.intent.v2plan) {
      const result = runExecutionEngine(fallback.intent, mockFile, '员工信息', [mockFile]);
      console.log('执行成功:', result.success);
      console.log('结果行数:', result.resultData?.rows?.length ?? 0);
    }
  });
});

// ============================================================
// 第六层：UI 状态机追踪（关键路径）
// ============================================================
describe('LAYER 6: UI状态机模拟', () => {
  it('检查第一次执行后的状态变化是否会影响第二次执行', () => {
    const stateAfterFirstExec = {
      activeTab: 'result',
      isRunning: false,
      currentVersionId: 'v-xxx',
      baseVersionId: 'v-xxx',
    };
    console.log('第一次执行后状态:', JSON.stringify(stateAfterFirstExec));
    console.log('');
    console.log('状态检查:');
    console.log('  isRunning = false → 可以继续');
    console.log('  promptText 有内容 → 可以继续');
    console.log('  selectedFile 存在 → 可以继续');
    console.log('  currentSheet 存在 → 可以继续');
    console.log('');
    console.log('⚠️ handleSubmit 中 parseIntentWithAI 是异步的');
    console.log('  如果第一次执行弹出歧义框，用户确认后再执行');
    console.log('  第二次点击执行时可能 ambiguityReport 状态残留');
  });

  it('检查 executeIntent 中的 version 缓存污染问题', () => {
    const intent1 = parseAndResolve('筛选技术部员工', columns, fileNames).intent;
    const intent2 = parseAndResolve('筛选基本工资小于8000的数据', columns, fileNames).intent;

    if (intent1.v2plan) {
      console.log('TC001 v2plan:', JSON.stringify(intent1.v2plan));
    } else {
      console.log('TC001: 无 v2plan → 走旧引擎');
      console.log('TC001 旧引擎 params:', JSON.stringify(intent1.params));
      console.log('→ 筛选列: 无目标列匹配 → fallback到文本列');
      console.log('→ 筛选值: "技术部员工" → 对任何列都没有匹配 → 0行');
    }
  });
});
