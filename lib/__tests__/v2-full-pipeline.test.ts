// ============================================================
// V2 Full Pipeline — 模拟真实用户请求的完整端到端测试
// ============================================================
// 覆盖：
//   - 从 parseIntentWithAI (含 compile) 到 runExecutionEngine
//   - 验证 v2plan + V2 Executor + V2 Verifier 全链路正确性
// ============================================================

import { describe, it, expect } from 'vitest';
import { runExecutionEngine } from '@/lib/execution-engine';
import { compile } from '@/lib/v2/task-compiler';
import { runExecutionPlan } from '@/lib/v2/execution-engine';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData, TaskIntent, WorkbenchFile } from '@/lib/types';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';

// ============================================================
// 公共测试数据
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

const salaryColumnsDef: ColumnDef[] = salaryColumns;
const salaryRowsData: RowData[] = salaryRows;

const mockFile: WorkbenchFile = {
  id: 'pipeline-test-file',
  name: '工资表.xlsx',
  icon: 'table',
  sheets: [{ name: 'Sheet1', columns: salaryColumnsDef, rows: salaryRowsData }],
  rowCount: salaryRowsData.length,
  colCount: salaryColumnsDef.length,
  isMock: false,
};

// ============================================================
// Case 1: 筛选绩效奖金小于5000
// 路径：TaskPlan → compile → ExecutionPlan → FilterExecutor → 结果
// ============================================================

describe('Full Pipeline — filter', () => {
  const taskPlan: TaskPlan = {
    action: 'filter',
    conditions: [{ columnHint: '绩效奖金', operator: '<', value: '5000' }],
  };

  it('compile → ExecutionPlan 正确', () => {
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('filter');

    if (compiled.plan!.type === 'filter') {
      expect(compiled.plan!.conditions[0].columnKey).toBe('bonus');
      expect(compiled.plan!.conditions[0].operator).toBe(Operator.LT);
      expect(compiled.plan!.conditions[0].value).toBe('5000');
    }
  });

  it('ExecutionPlan → FilterExecutor → 正确结果', () => {
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);

    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    // FilterExecutor 执行 + OutputProcessor + FilterVerifier
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    expect(result.data!.rows[0].name).toBe('李四');
    expect(result.data!.rows[1].name).toBe('赵六');
  });

  it('runExecutionEngine → V2 全链路', () => {
    const intent: TaskIntent = {
      operation: 'filter',
      target: '绩效奖金',
      targetColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '筛选绩效奖金小于5000',
      confidence: 0.95,
      params: {},
      v2plan: compile(taskPlan, salaryColumnsDef).plan!,
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);

    expect(result.success).toBe(true);
    expect(result.resultData!.rows).toHaveLength(2);
    expect(result.resultData!.rows[0].name).toBe('李四');
    expect(result.resultData!.rows[1].name).toBe('赵六');
  });
});

// ============================================================
// Case 2: 按照绩效奖金降序排列
// ============================================================

describe('Full Pipeline — sort', () => {
  const taskPlan: TaskPlan = {
    action: 'sort',
    columnHint: '绩效奖金',
    direction: 'desc',
  };

  it('compile → SortExecutor → 正确结果', () => {
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('sort');

    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    expect(result.success).toBe(true);
    const bonusValues = result.data!.rows.map((r) => r.bonus);
    expect(bonusValues).toEqual([12000, 8000, 6000, 3000, 2000]);
  });

  it('runExecutionEngine → V2 全链路', () => {
    const intent: TaskIntent = {
      operation: 'sort',
      target: '绩效奖金',
      targetColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      resolvedColumns: [{ key: 'bonus', title: '绩效奖金', confidence: 0.95, matchMethod: 'exact' }],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '按照绩效奖金降序排列',
      confidence: 0.95,
      params: {},
      v2plan: compile(taskPlan, salaryColumnsDef).plan!,
    };

    const result = runExecutionEngine(intent, mockFile, 'Sheet1', []);

    expect(result.success).toBe(true);
    const bonusValues = result.resultData!.rows.map((r) => r.bonus);
    expect(bonusValues).toEqual([12000, 8000, 6000, 3000, 2000]);
  });
});

// ============================================================
// Case 3: 计算基本工资总和（分组聚合）
// ============================================================

describe('Full Pipeline — aggregate (grouped)', () => {
  const taskPlan: TaskPlan = {
    action: 'aggregate',
    method: 'sum',
    columnHints: ['基本工资'],
    groupByHints: ['部门'],
  };

  it('compile → AggregateExecutor → 正确结果', () => {
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);
    expect(compiled.plan!.type).toBe('aggregate');

    if (compiled.plan!.type === 'aggregate') {
      expect(compiled.plan!.method).toBe(AggMethod.SUM);
      expect(compiled.plan!.columns).toEqual(['basePay']);
      expect(compiled.plan!.groupBy).toEqual(['dept']);
    }

    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    for (const row of result.data!.rows) {
      if (row.dept === '技术部') expect(row['basePay_合计']).toBe(46000);  // 15000+13000+18000
      if (row.dept === '市场部') expect(row['basePay_合计']).toBe(23000);  // 12000+11000
    }
  });
});

// ============================================================
// Case 4: 多条件筛选 — 部门=技术部 且 bonus>=6000
// ============================================================

describe('Full Pipeline — multi-condition filter', () => {
  const taskPlan: TaskPlan = {
    action: 'filter',
    conditions: [
      { columnHint: '部门', operator: '=', value: '技术部' },
      { columnHint: '绩效奖金', operator: '>=', value: '6000' },
    ],
  };

  it('compile → FilterExecutor（多条件AND）→ 正确', () => {
    const compiled = compile(taskPlan, salaryColumnsDef);
    expect(compiled.success).toBe(true);

    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
    const names = result.data!.rows.map((r) => r.name).sort();
    expect(names).toEqual(['张三', '王五', '陈七']);
  });
});

// ============================================================
// Case 5: 完全体：compile + runExecutionPlan + V2 Verifier
// ============================================================

describe('Full Pipeline — compile → runExecutionPlan → Verifier', () => {
  it('filter: 所有环节串联验证通过', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [{ columnHint: '绩效奖金', operator: '<', value: '5000' }],
    };

    const compiled = compile(taskPlan, salaryColumnsDef);
    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    // FilterExecutor → OutputProcessor → FilterVerifier 全部通过
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    // FilterVerifier 确认每行 bonus < 5000
    for (const row of result.data!.rows) {
      expect(Number(row.bonus)).toBeLessThan(5000);
    }
  });

  it('sort: 所有环节串联验证通过', () => {
    const taskPlan: TaskPlan = {
      action: 'sort',
      columnHint: '绩效奖金',
      direction: 'desc',
    };

    const compiled = compile(taskPlan, salaryColumnsDef);
    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    expect(result.success).toBe(true);
    // SortVerifier 确认排序正确
    const values = result.data!.rows.map((r) => r.bonus);
    for (let i = 1; i < values.length; i++) {
      expect(Number(values[i])).toBeLessThanOrEqual(Number(values[i - 1]));
    }
  });

  it('aggregate: 所有环节串联验证通过', () => {
    const taskPlan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['绩效奖金'],
      groupByHints: ['部门'],
    };

    const compiled = compile(taskPlan, salaryColumnsDef);
    const result = runExecutionPlan(compiled.plan!, {
      columns: salaryColumnsDef, rows: salaryRowsData,
    });

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    // AggregateVerifier 确认聚合值正确
    for (const row of result.data!.rows) {
      if (row.dept === '技术部') expect(Number(row['bonus_合计'])).toBe(26000);
      if (row.dept === '市场部') expect(Number(row['bonus_合计'])).toBe(5000);
    }
  });
});
