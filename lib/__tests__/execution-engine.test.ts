import { describe, it, expect } from 'vitest';
import {
  runExecutionEngine,
} from '../execution-engine';
import { parseIntent } from '../nlu';
import { ColumnDef, WorkbenchFile, TaskIntent } from '../types';
import { SchemaResolver, defaultSchemaResolver } from '../nlu/schema-resolver';
import { RuleBasedSemanticParser } from '../nlu/semantic-parser';
import { AmbiguityDetector } from '../ambiguity-detector';

// ---- 工具函数 ----
function col(key: string, title: string, type: ColumnDef['type'] = 'text'): ColumnDef {
  return { key, title, type };
}

function makeIntent(overrides: Partial<TaskIntent>): TaskIntent {
  return {
    operation: null,
    target: '',
    targetColumns: [],
    resolvedColumns: undefined,
    scope: 'all',
    groupBy: undefined,
    filters: undefined,
    aggregation: null,
    params: {},
    targetFiles: [],
    rawPrompt: '',
    confidence: 0,
    ...overrides,
  };
}

const gongziFile: WorkbenchFile = {
  id: 'salary',
  name: '工资表.xlsx',
  icon: '💰',
  isMock: true,
  rowCount: 3,
  colCount: 5,
  sheets: [{
    name: '2024年1月',
    columns: [
      col('name', '姓名'),
      col('basePay', '基本工资', 'number'),
      col('bonus', '绩效奖金', 'number'),
      col('overtime', '加班补贴', 'number'),
      col('deduction', '扣除项', 'number'),
    ],
    rows: [
      { name: '陈建国', basePay: 15000, bonus: 3000, overtime: 500, deduction: 800 },
      { name: '林小红', basePay: 18000, bonus: 4500, overtime: 0, deduction: 1200 },
      { name: '张伟', basePay: 20000, bonus: 8000, overtime: 300, deduction: 1500 },
    ],
  }],
};

const gongziColumns = gongziFile.sheets[0].columns;

// ============================================================
// Schema Resolver 测试
// ============================================================
describe('SchemaResolver', () => {
  it('语义"工资"匹配到"基本工资"', () => {
    const result = defaultSchemaResolver.resolve('工资', gongziColumns);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].title).toBe('基本工资');
    expect(result.candidates[0].matchMethod).toBe('semantic');
  });

  it('语义"绩效"匹配到"绩效奖金"', () => {
    const result = defaultSchemaResolver.resolve('绩效', gongziColumns);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].title).toContain('绩效');
  });

  it('语义"销售额"在工资表中返回空或低分', () => {
    const result = defaultSchemaResolver.resolve('销售额', gongziColumns);
    if (result.candidates.length > 0) {
      expect(result.candidates[0].confidence).toBeLessThan(0.7);
    }
  });

  it('无可用列时返回空', () => {
    const result = defaultSchemaResolver.resolve('工资', []);
    expect(result.candidates.length).toBe(0);
    expect(result.isResolved).toBe(false);
  });
});

// ============================================================
// 语义 Parser 测试
// ============================================================
describe('RuleBasedSemanticParser', () => {
  const parser = new RuleBasedSemanticParser();

  it('"统计销售额" 提取 target=销售额, operation=sum', () => {
    const intent = parser.parse('统计销售额', gongziColumns, []);
    expect(intent.operation).toBe('sum');
    expect(intent.target).toBe('销售额');
  });

  it('"排序基本工资" 提取 target=基本工资, operation=sort', () => {
    const intent = parser.parse('排序基本工资', gongziColumns, []);
    expect(intent.operation).toBe('sort');
    expect(intent.target).toBe('基本工资');
  });

  it('"帮我统计一下销售额" 去除停用词后识别 target', () => {
    const intent = parser.parse('帮我统计一下销售额', gongziColumns, []);
    expect(intent.operation).toBe('sum');
    expect(intent.target).toBe('销售额');
  });

  it('"销售额一共多少" 理解语义', () => {
    const intent = parser.parse('销售额一共多少', gongziColumns, []);
    expect(intent.operation).toBe('sum');
    expect(intent.target).toBe('销售额');
  });

  it('"筛选2024年1月份数据" 提取 filters', () => {
    const intent = parser.parse('筛选2024年1月份数据', gongziColumns, []);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(1);
    expect(intent.filters![0].operator).toBe('dateRange');
  });

  it('"删除重复手机号" 识别为 dedup', () => {
    const intent = parser.parse('删除重复手机号', gongziColumns, []);
    expect(intent.operation).toBe('dedup');
    expect(intent.target).toBe('手机号');
  });
});

// ============================================================
// 完整管道测试：语义解析 → Schema Resolver → Ambiguity
// ============================================================
describe('完整 NLU 管道', () => {
  it('"统计基本工资" → sum + 高置信度 Schema 匹配', () => {
    const intent = parseIntent('统计基本工资', gongziColumns, []);
    expect(intent.operation).toBe('sum');
    expect(intent.target).toBe('基本工资');

    const resolution = defaultSchemaResolver.resolve(intent.target, gongziColumns);
    expect(resolution.candidates.length).toBeGreaterThanOrEqual(1);
    expect(resolution.candidates[0].title).toBe('基本工资');
    expect(resolution.isResolved).toBe(true);
  });

  it('"工资排序" → sort + Schema 匹配 "基本工资"', () => {
    const intent = parseIntent('工资排序', gongziColumns, []);
    expect(intent.operation).toBe('sort');
    expect(intent.target).toBe('工资');

    const resolution = defaultSchemaResolver.resolve(intent.target, gongziColumns);
    expect(resolution.candidates.length).toBeGreaterThanOrEqual(1);
    expect(resolution.candidates[0].confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ============================================================
// AmbiguityDetector 测试（Schema 候选版）
// ============================================================
describe('AmbiguityDetector (Schema 候选)', () => {
  it('多候选且分数接近时触发 multi_candidate', () => {
    const intent = makeIntent({ operation: 'sort', target: '金额', rawPrompt: '将金额排序' });
    const candidates = [
      { key: 'orderAmount', title: '订单金额', confidence: 0.85, matchMethod: 'semantic' as const, reason: '' },
      { key: 'actualAmount', title: '实付金额', confidence: 0.65, matchMethod: 'semantic' as const, reason: '' },
    ];
    const result = AmbiguityDetector.detect(intent, candidates);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('multi_candidate');
  });

  it('唯一高置信度候选不触发歧义', () => {
    const intent = makeIntent({ operation: 'sort', target: '基本工资', rawPrompt: '基本工资排序' });
    const candidates = [
      { key: 'basePay', title: '基本工资', confidence: 0.95, matchMethod: 'semantic' as const, reason: '' },
    ];
    const result = AmbiguityDetector.detect(intent, candidates);
    expect(result).toBeNull();
  });

  it('无候选时触发 no_match', () => {
    const intent = makeIntent({ operation: 'sort', target: '不存在的列', rawPrompt: '不存在的列排序' });
    const result = AmbiguityDetector.detect(intent, []);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('no_match');
  });

  it('最佳候选置信度不足时触发 low_confidence', () => {
    const intent = makeIntent({ operation: 'sort', target: '手机号', rawPrompt: '按手机号排序' });
    const candidates = [
      { key: 'name', title: '姓名', confidence: 0.45, matchMethod: 'semantic' as const, reason: '' },
    ];
    const result = AmbiguityDetector.detect(intent, candidates);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('low_confidence');
  });
});

// ============================================================
// 强制单链路验证：没有 v2plan = 不可执行
// ============================================================
describe('V2 强制单链路验证', () => {
  it('没有 v2plan 时返回编译错误而非降级', () => {
    const intent = parseIntent('将基本工资排序', gongziColumns, []);
    const resolved = defaultSchemaResolver.resolve(intent.target || '基本工资', gongziColumns);
    const confirmedIntent = {
      ...intent,
      resolvedColumns: resolved.candidates.map(c => ({ key: c.key, title: c.title, confidence: c.confidence, matchMethod: c.matchMethod as 'exact' | 'fuzzy' })),
    };
    const result = runExecutionEngine(confirmedIntent, gongziFile, '2024年1月', []);
    // V2 单链路：没有 v2plan → 返回错误
    expect(result.success).toBe(false);
    expect(result.error).toContain('ExecutionPlan');
    expect(result.error).toContain('ExecutionPlan');
  });
});

// ============================================================
// runExecutionEngine — 整体流程（只测试 v2plan 存在的场景）
// ============================================================
describe('runExecutionEngine — V2 整体流程', () => {
  const salaryColumnsDef: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'basePay', title: '基本工资', type: 'number' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const salaryRowsData = [
    { name: '张三', dept: '技术部', basePay: 15000, bonus: 8000 },
    { name: '李四', dept: '市场部', basePay: 12000, bonus: 3000 },
    { name: '王五', dept: '技术部', basePay: 13000, bonus: 6000 },
    { name: '赵六', dept: '市场部', basePay: 11000, bonus: 2000 },
    { name: '陈七', dept: '技术部', basePay: 18000, bonus: 12000 },
  ];

  const mockFile: WorkbenchFile = {
    id: 'pipeline-test-file',
    name: '工资表.xlsx',
    icon: 'table',
    sheets: [{ name: 'Sheet1', columns: salaryColumnsDef, rows: salaryRowsData }],
    rowCount: salaryRowsData.length,
    colCount: salaryColumnsDef.length,
    isMock: false,
  };

  it('带 v2plan 的排序请求应通过 V2 执行', async () => {
    // 使用 TaskPlan 编译生成 v2plan
    const { compile } = await import('../v2/task-compiler');
    const taskPlan = { action: 'sort' as const, columnHint: '基本工资', direction: 'desc' as const };
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);

    const intent: TaskIntent = {
      operation: 'sort',
      target: '基本工资',
      targetColumns: [{ key: 'basePay', title: '基本工资', confidence: 1, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'basePay', title: '基本工资', confidence: 1, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '将基本工资排序',
      confidence: 0.95,
      params: { asc: false },
      v2plan: compiled.plan!,
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);
    expect(result.success).toBe(true);
    expect(result.resultData).not.toBeNull();
    expect(result.resultData!.rows.length).toBe(5);
    const values = result.resultData!.rows.map(r => Number(r.basePay));
    expect(values[0]).toBeGreaterThanOrEqual(values[1]); // desc
  });

  it('带 v2plan 的分组聚合请求应通过 V2 执行', async () => {
    const { compile } = await import('../v2/task-compiler');
    const taskPlan = {
      action: 'aggregate' as const,
      method: 'sum' as const,
      columnHints: ['基本工资'],
      groupByHints: ['部门'],
    };
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);

    const intent: TaskIntent = {
      operation: 'sum',
      target: '基本工资',
      targetColumns: [{ key: 'basePay', title: '基本工资', confidence: 1, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'basePay', title: '基本工资', confidence: 1, matchMethod: 'exact' }],
      scope: 'all',
      groupBy: ['部门'],
      aggregation: 'SUM',
      targetFiles: [],
      rawPrompt: '',
      confidence: 0.95,
      params: {},
      v2plan: compiled.plan!,
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);
    expect(result.success).toBe(true);
    expect(result.resultData).not.toBeNull();
    expect(result.resultData!.rows.length).toBe(2);
  });

  it('没有 v2plan 应返回错误', () => {
    const intent: TaskIntent = {
      operation: 'sort',
      target: '绩效奖金',
      targetColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按绩效奖金排序',
      confidence: 0.95,
      params: { asc: false },
      // 没有 v2plan
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);
    expect(result.success).toBe(false);
    expect(result.error).toContain('ExecutionPlan');
  });
});
