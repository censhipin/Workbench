import { describe, it, expect } from 'vitest';
import { ruleIntentToTaskPlan } from '@/lib/nlu/rule-taskplan-converter';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';
import type { TaskPlanCondition } from '@/lib/nlu/taskplan-types';

// ============================================================
// ruleIntentToTaskPlan 单元测试
// ============================================================

function makeFilterIntent(overrides: Record<string, any> = {}) {
  return {
    operation: 'filter' as const,
    target: '绩效奖金',
    targetColumns: [],
    scope: 'filtered' as const,
    targetFiles: ['工资表.xlsx'],
    rawPrompt: '筛选绩效奖金小于5000',
    confidence: 0.7,
    groupBy: undefined,
    filters: undefined,
    aggregation: null,
    output: undefined,
    params: { operator: 'lte', filterValue: '5000' },
    ...overrides,
  };
}

describe('ruleIntentToTaskPlan', () => {
  it('filter 操作生成正确 TaskPlan', () => {
    const intent: any = makeFilterIntent({
      filters: [{ column: '绩效奖金', operator: 'lt', value: '5000' }],
    });

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('filter');
    expect(plan.columnHint).toBe('绩效奖金');
    expect(plan.conditions).toHaveLength(1);
    expect(plan.conditions![0].columnHint).toBe('绩效奖金');
    expect(plan.conditions![0].operator).toBe('<');
    expect(plan.conditions![0].value).toBe('5000');
  });

  it('filter 从 params 降级生成条件', () => {
    const intent: any = makeFilterIntent();

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('filter');
    expect(plan.conditions).toBeDefined();
    if (plan.conditions) {
      expect(plan.conditions[0].operator).toBe('<=');
      expect(plan.conditions[0].value).toBe('5000');
    }
  });

  it('sort 操作生成正确 TaskPlan', () => {
    const intent: any = {
      operation: 'sort',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按绩效奖金降序排列',
      confidence: 0.8,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: { asc: false, targets: ['绩效奖金'] },
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('sort');
    expect(plan.columnHint).toBe('绩效奖金');
    expect(plan.direction).toBe('desc');
  });

  it('sort 升序', () => {
    const intent: any = {
      operation: 'sort',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按绩效奖金升序排列',
      confidence: 0.8,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: { asc: true },
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('sort');
    expect(plan.direction).toBe('asc');
  });

  it('aggregate(sum) 操作生成正确 TaskPlan', () => {
    const intent: any = {
      operation: 'sum',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '统计绩效奖金总和',
      confidence: 0.75,
      groupBy: undefined,
      filters: undefined,
      aggregation: 'SUM',
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('aggregate');
    expect(plan.columnHint).toBe('绩效奖金');
    expect(plan.method).toBe('sum');
  });

  it('aggregate 分组', () => {
    const intent: any = {
      operation: 'sum',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按部门统计绩效奖金总和',
      confidence: 0.75,
      groupBy: ['部门'],
      filters: undefined,
      aggregation: 'SUM',
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('aggregate');
    expect(plan.groupByHints).toEqual(['部门']);
  });

  it('dedup 操作', () => {
    const intent: any = {
      operation: 'dedup',
      target: '姓名',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按姓名去重',
      confidence: 0.85,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('dedup');
    expect(plan.columnHint).toBe('姓名');
  });

  it('unknown 操作返回 unknown', () => {
    const intent: any = {
      operation: null,
      target: '',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '看不懂',
      confidence: 0.1,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);

    expect(plan.action).toBe('unknown');
  });
});

// ============================================================
// V2 集成：ruleIntentToTaskPlan → compile → runExecutionPlan
// ============================================================

import { compile } from '@/lib/v2/task-compiler';
import { runExecutionPlan } from '@/lib/v2/execution-engine';
import { Operator } from '@/lib/v2/types';
import { SortOrder } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData, TaskIntent } from '@/lib/types';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';

const columns: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'basePay', title: '基本工资', type: 'number' },
];

const rows: RowData[] = [
  { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
  { name: '李四', dept: '市场部', bonus: 3000, basePay: 12000 },
  { name: '王五', dept: '技术部', bonus: 6000, basePay: 13000 },
  { name: '赵六', dept: '市场部', bonus: 2000, basePay: 11000 },
  { name: '陈七', dept: '技术部', bonus: 12000, basePay: 18000 },
];

const mainSheet = { columns, rows };

describe('Fallback NLU → V2 全链路', () => {
  it('filter: 规则解析 → TaskPlan → compile → runExecutionPlan', () => {
    const intent: any = {
      operation: 'filter',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'filtered',
      targetFiles: [],
      rawPrompt: '筛选绩效奖金小于5000',
      confidence: 0.7,
      groupBy: undefined,
      filters: [{ column: '绩效奖金', operator: 'lt', value: '5000' }],
      aggregation: null,
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);
    const compiled = compile(plan, columns);

    expect(compiled.success).toBe(true);
    expect(compiled.plan).toBeDefined();
    expect(compiled.plan!.type).toBe('filter');

    const result = runExecutionPlan(compiled.plan!, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    expect(result.data!.rows[0].name).toBe('李四');
    expect(result.data!.rows[1].name).toBe('赵六');
  });

  it('sort: 规则解析 → TaskPlan → compile → runExecutionPlan', () => {
    const intent: any = {
      operation: 'sort',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按绩效奖金降序排列',
      confidence: 0.8,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: { asc: false },
    };

    const plan = ruleIntentToTaskPlan(intent);
    const compiled = compile(plan, columns);

    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('sort');

    const result = runExecutionPlan(compiled.plan!, mainSheet);

    expect(result.success).toBe(true);
    const bonusValues = result.data!.rows.map((r) => r.bonus);
    expect(bonusValues).toEqual([12000, 8000, 6000, 3000, 2000]);
  });

  it('aggregate: 规则解析 → TaskPlan → compile → runExecutionPlan', () => {
    const intent: any = {
      operation: 'sum',
      target: '绩效奖金',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '统计绩效奖金总和',
      confidence: 0.75,
      groupBy: undefined,
      filters: undefined,
      aggregation: 'SUM',
      output: undefined,
      params: {},
    };

    const plan = ruleIntentToTaskPlan(intent);
    const compiled = compile(plan, columns);

    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('aggregate');

    const result = runExecutionPlan(compiled.plan!, mainSheet);

    expect(result.success).toBe(true);
    // 无分组 aggregate 追加汇总行
    const aggKey = result.data!.columns.find((c) => c.title.includes('合计'))!.key;
    const sumRow = result.data!.rows[result.data!.rows.length - 1];
    expect(sumRow[aggKey]).toBe(31000);
  });

  it('dedup: 规则解析 → TaskPlan → compile → runExecutionPlan', () => {
    const intent: any = {
      operation: 'dedup',
      target: '姓名',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按姓名去重',
      confidence: 0.85,
      groupBy: undefined,
      filters: undefined,
      aggregation: null,
      output: undefined,
      params: {},
    };

    const dupRows = [
      ...rows,
      { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
    ];

    const plan = ruleIntentToTaskPlan(intent);
    const compiled = compile(plan, columns);

    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('dedup');

    const result = runExecutionPlan(compiled.plan!, { columns, rows: dupRows });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
  });
});
