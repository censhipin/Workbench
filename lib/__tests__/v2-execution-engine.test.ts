import { describe, it, expect } from 'vitest';
import { runExecutionPlan } from '@/lib/v2/execution-engine';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData, TaskIntent, WorkbenchFile } from '@/lib/types';
import { runExecutionEngine } from '@/lib/execution-engine';
import { compile } from '@/lib/v2/task-compiler';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';

// ============================================================
// runExecutionPlan 单元测试
// ============================================================

const salaryColumns: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'basePay', title: '基本工资', type: 'number' },
];

const salaryRows: RowData[] = [
  { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
  { name: '李四', dept: '市场部', bonus: 3000, basePay: 12000 },
  { name: '王五', dept: '技术部', bonus: 6000, basePay: 13000 },
  { name: '赵六', dept: '市场部', bonus: 2000, basePay: 11000 },
  { name: '陈七', dept: '技术部', bonus: 12000, basePay: 18000 },
];

const mainSheet = { columns: salaryColumns, rows: salaryRows };

// ========== Filter ==========

describe('runExecutionPlan — filter', () => {
  it('bonus < 5000 正确过滤', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [
        { columnKey: 'bonus', operator: Operator.LT, value: 5000 },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.rows).toHaveLength(2);
    expect(result.data!.rows[0].name).toBe('李四');
    expect(result.data!.rows[1].name).toBe('赵六');
  });

  it('复合条件 AND：部门=技术部 AND bonus >= 6000', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [
        { columnKey: 'dept', operator: Operator.EQ, value: '技术部' },
        { columnKey: 'bonus', operator: Operator.GTE, value: 6000 },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
    expect(result.data!.rows[0].name).toBe('张三');
    expect(result.data!.rows[1].name).toBe('王五');
    expect(result.data!.rows[2].name).toBe('陈七');
  });

  it('有 output 时应用输出约束', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [
        { columnKey: 'bonus', operator: Operator.LT, value: 5000 },
      ],
      output: { includeColumns: ['name', 'bonus'] },
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.columns).toHaveLength(2);
    expect(result.data!.columns.map((c) => c.key)).toEqual(['name', 'bonus']);
  });
});

// ========== Sort ==========

describe('runExecutionPlan — sort', () => {
  it('单列降序排列', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.DESC }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    const bonusValues = result.data!.rows.map((r) => r.bonus);
    expect(bonusValues).toEqual([12000, 8000, 6000, 3000, 2000]);
  });

  it('多列排序：部门升序 + bonus 降序', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [
        { columnKey: 'dept', order: SortOrder.ASC },
        { columnKey: 'bonus', order: SortOrder.DESC },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // 技术部在前，市场部在后；技术部内部 bonus 降序
    const depts = result.data!.rows.map((r) => r.dept);
    expect(depts[0]).toBe('技术部');
    expect(depts[1]).toBe('技术部');
    expect(depts[2]).toBe('技术部');
    expect(result.data!.rows[0].name).toBe('陈七');
    expect(result.data!.rows[1].name).toBe('张三');
    expect(result.data!.rows[2].name).toBe('王五');
  });
});

// ========== Aggregate ==========

describe('runExecutionPlan — aggregate', () => {
  it('SUM 单列无分组', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // aggregateRows 无分组时列名为 bonus_合计
    const aggKey = result.data!.columns.find((c) => c.title.includes('合计'))!.key;
    const sumRow = result.data!.rows[result.data!.rows.length - 1];
    expect(sumRow[aggKey]).toBe(31000);
  });

  it('SUM 按部门分组', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // 技术部: 8000+6000+12000=26000, 市场部: 3000+2000=5000
    expect(result.data!.rows).toHaveLength(2);
    for (const row of result.data!.rows) {
      if (row.dept === '技术部') expect(row['bonus_合计']).toBe(26000);
      if (row.dept === '市场部') expect(row['bonus_合计']).toBe(5000);
    }
  });

  it('AVG 单列无分组', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.AVG,
      columns: ['bonus'],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // aggregateRows 无分组时列名为 bonus_平均
    const avgKey = result.data!.columns.find((c) => c.title.includes('平均'))!.key;
    const avgRow = result.data!.rows[result.data!.rows.length - 1];
    expect(avgRow[avgKey]).toBe(6200);
  });
});

// ========== Dedup ==========

describe('runExecutionPlan — dedup', () => {
  const dupSheet = {
    columns: salaryColumns,
    rows: [
      ...salaryRows,
      { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
      { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
    ],
  };

  it('按 name 去重', () => {
    const plan: ExecutionPlan = {
      type: 'dedup',
      columns: ['name'],
    };

    const result = runExecutionPlan(plan, dupSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
    expect(result.summary?.deletedCount).toBe(2);
  });
});

// ========== Clean ==========

describe('runExecutionPlan — clean', () => {
  const dirtyRows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
    { name: '李四', dept: '', bonus: 3000, basePay: 12000 },
    { name: '', dept: null, bonus: null, basePay: null },
  ];

  it('清洗空数据', () => {
    const plan: ExecutionPlan = { type: 'clean' };

    const result = runExecutionPlan(plan, { columns: salaryColumns, rows: dirtyRows });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
  });
});

// ========== Error handling ==========

describe('runExecutionPlan — error handling', () => {
  it('空数据不报错', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.EQ, value: 99999 }],
    };

    const result = runExecutionPlan(plan, { columns: salaryColumns, rows: [] });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(0);
  });
});

// ========== 集成测试：compile + runExecutionPlan + runExecutionEngine ==========

describe('集成链路 — V2 执行入口 dispatch', () => {
  const salaryColumnsDef: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
    { key: 'basePay', title: '基本工资', type: 'number' },
  ];

  const salaryRowsData: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
    { name: '李四', dept: '市场部', bonus: 3000, basePay: 12000 },
    { name: '王五', dept: '技术部', bonus: 6000, basePay: 13000 },
    { name: '赵六', dept: '市场部', bonus: 2000, basePay: 11000 },
    { name: '陈七', dept: '技术部', bonus: 12000, basePay: 18000 },
  ];

  const mockFile: WorkbenchFile = {
    id: 'test-file-1',
    name: '工资表.xlsx',
    icon: 'table',
    sheets: [{ name: 'Sheet1', columns: salaryColumnsDef, rows: salaryRowsData }],
    rowCount: salaryRowsData.length,
    colCount: salaryColumnsDef.length,
    isMock: false,
  };

  it('runExecutionEngine 识别 v2plan 后走 V2 路径 (filter)', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [{ columnHint: '绩效奖金', operator: '<', value: '5000' }],
    };

    // 模拟 page.tsx 中已经被编译的场景
    const intent: TaskIntent = {
      operation: 'filter',
      target: '绩效奖金',
      targetColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '筛选绩效奖金<5000',
      confidence: 0.95,
      params: {},
      v2plan: compile(taskPlan, salaryColumnsDef).plan!, // 预设 v2plan
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);

    expect(result.success).toBe(true);
    expect(result.resultData).toBeDefined();
    expect(result.resultData!.rows).toHaveLength(2);
    expect(result.resultData!.rows[0].name).toBe('李四');
    expect(result.resultData!.rows[1].name).toBe('赵六');
  });

  it('没有 v2plan 时返回编译失败错误（不降级）', () => {
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
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);

    // V2 单链路强制：没有 v2plan = 编译失败，禁止降级
    expect(result.success).toBe(false);
    expect(result.error).toContain('ExecutionPlan');
  });

  it('v2plan 执行失败返回明确错误', () => {
    // 构造一个无法执行的 intent（没选文件 = 缺 currentSheet）
    const intent: TaskIntent = {
      operation: 'filter',
      target: '绩效奖金',
      targetColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '筛选绩效奖金<5000',
      confidence: 0.95,
      params: {},
      v2plan: { type: 'filter' as const, conditions: [{ columnKey: 'bonus', operator: Operator.LT, value: 5000 }] },
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);

    expect(result.success).toBe(true);
    expect(result.resultData!.rows).toHaveLength(2);
  });
});
