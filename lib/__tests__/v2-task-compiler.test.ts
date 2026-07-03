import { describe, it, expect } from 'vitest';
import { compile } from '@/lib/v2/task-compiler';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';

// 模拟工资表的列定义
const salaryColumns = [
  { key: 'name', title: '姓名', type: 'text' as const },
  { key: 'basePay', title: '基本工资', type: 'number' as const },
  { key: 'bonus', title: '绩效奖金', type: 'number' as const },
  { key: 'overtime', title: '加班补贴', type: 'number' as const },
  { key: 'deduction', title: '扣除项', type: 'number' as const },
  { key: 'dept', title: '部门', type: 'text' as const },
];

describe('TaskCompiler — filter', () => {
  it('编译标准筛选：< 操作符', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '绩效奖金', operator: '<', value: '5000' },
      ],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;

    expect(result.plan.type).toBe('filter');
    if (result.plan.type !== 'filter') return;

    expect(result.plan.conditions).toHaveLength(1);
    expect(result.plan.conditions[0].columnKey).toBe('bonus');
    expect(result.plan.conditions[0].operator).toBe(Operator.LT);
    expect(result.plan.conditions[0].value).toBe('5000');
  });

  it('编译多重条件 AND', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '部门', operator: '=', value: '销售部' },
        { columnHint: '基本工资', operator: '>=', value: '7000' },
      ],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'filter') return;

    expect(result.plan.conditions).toHaveLength(2);
    expect(result.plan.conditions[0].columnKey).toBe('dept');
    expect(result.plan.conditions[0].operator).toBe(Operator.EQ);
    expect(result.plan.conditions[1].columnKey).toBe('basePay');
    expect(result.plan.conditions[1].operator).toBe(Operator.GTE);
  });

  it('编译 dateRange → BETWEEN', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '入职日期', operator: 'dateRange', value: { start: '2024-01-01', end: '2024-12-31' } },
      ],
    };
    const columns = [
      ...salaryColumns,
      { key: 'hireDate', title: '入职日期', type: 'date' as const },
    ];
    const result = compile(taskPlan, columns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'filter') return;

    expect(result.plan.conditions[0].operator).toBe(Operator.BETWEEN);
    expect(result.plan.conditions[0].value).toEqual({ start: '2024-01-01', end: '2024-12-31' });
  });

  it('columnHint 找不到列则编译失败', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '不存在的列', operator: '=', value: 'xxx' },
      ],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(false);
    expect(result.error).toContain('找不到列');
  });

  it('不支持的 operator 编译失败', () => {
    const taskPlan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '绩效奖金', operator: 'regex', value: 'xxx' },
      ],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(false);
  });
});

describe('TaskCompiler — sort', () => {
  it('单列排序', () => {
    const taskPlan: TaskPlan = {
      action: 'sort',
      columnHint: '基本工资',
      direction: 'desc',
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'sort') return;

    expect(result.plan.sorts).toHaveLength(1);
    expect(result.plan.sorts[0].columnKey).toBe('basePay');
    expect(result.plan.sorts[0].order).toBe(SortOrder.DESC);
  });

  it('多列排序', () => {
    const taskPlan: TaskPlan = {
      action: 'sort',
      columnHints: ['部门', '基本工资'],
      direction: 'asc',
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'sort') return;

    expect(result.plan.sorts).toHaveLength(2);
    expect(result.plan.sorts[0].columnKey).toBe('dept');
    expect(result.plan.sorts[1].columnKey).toBe('basePay');
  });
});

describe('TaskCompiler — aggregate', () => {
  it('单列求和', () => {
    const taskPlan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['基本工资'],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'aggregate') return;

    expect(result.plan.method).toBe(AggMethod.SUM);
    expect(result.plan.columns).toEqual(['basePay']);
  });

  it('多列求和', () => {
    const taskPlan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['基本工资', '绩效奖金', '加班补贴'],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'aggregate') return;

    expect(result.plan.columns).toEqual(['basePay', 'bonus', 'overtime']);
  });

  it('分组聚合', () => {
    const taskPlan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['基本工资'],
      groupByHints: ['部门'],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'aggregate') return;

    expect(result.plan.groupBy).toEqual(['dept']);
  });
});

describe('TaskCompiler — dedup', () => {
  it('按列去重', () => {
    const taskPlan: TaskPlan = {
      action: 'dedup',
      columnHints: ['姓名'],
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'dedup') return;

    expect(result.plan.columns).toEqual(['name']);
  });
});

describe('TaskCompiler — match', () => {
  it('按匹配键编译', () => {
    const taskPlan: TaskPlan = {
      action: 'match',
      matchKeyHint: '姓名',
      lookupTableHint: '联系方式.xlsx',
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    if (result.plan.type !== 'match') return;

    expect(result.plan.matchColumns).toEqual(['name']);
  });
});

describe('TaskCompiler — clean / unknown', () => {
  it('clean 成功', () => {
    const taskPlan: TaskPlan = { action: 'clean' };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    expect(result.plan.type).toBe('clean');
  });

  it('unknown 失败', () => {
    const taskPlan: TaskPlan = { action: 'unknown', reason: '听不懂' };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(false);
    expect(result.error).toContain('听不懂');
  });
});

describe('TaskCompiler — 输出约束', () => {
  it('编译 output.limit', () => {
    const taskPlan: TaskPlan = {
      action: 'sort',
      columnHint: '基本工资',
      direction: 'desc',
      limit: 10,
    };
    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    if (!result.success || !result.plan) return;
    expect(result.plan.output?.limit).toBe(10);
  });
});

// ========== Schema Contract Tests ==========

describe('ExecutionPlan Schema Contract', () => {
  it('FilterPlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.LT, value: 5000 }],
    };

    expect(plan.type).toBe('filter');

    // conditions 是 ConditionExpr[]
    expect(Array.isArray(plan.conditions)).toBe(true);
    expect(plan.conditions[0]).toHaveProperty('columnKey');
    expect(plan.conditions[0]).toHaveProperty('operator');
    expect(plan.conditions[0]).toHaveProperty('value');
    expect(Object.values(Operator)).toContain(plan.conditions[0].operator);

    // output 可选 — 不设置时不应出现在对象上
    expect(plan).not.toHaveProperty('output');
    // 设置后应正确携带
    const withOutput: ExecutionPlan = {
      type: 'filter',
      conditions: [],
      output: { limit: 10 },
    };
    expect(withOutput.output?.limit).toBe(10);
  });

  it('SortPlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.DESC }],
    };

    expect(plan.type).toBe('sort');
    expect(Array.isArray(plan.sorts)).toBe(true);
    expect(plan.sorts[0]).toHaveProperty('columnKey');
    expect(plan.sorts[0]).toHaveProperty('order');
    expect([SortOrder.ASC, SortOrder.DESC]).toContain(plan.sorts[0].order);
  });

  it('AggregatePlan 结构符合契约（扁平，无嵌套 aggregate）', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };

    expect(plan.type).toBe('aggregate');
    expect(Object.values(AggMethod)).toContain(plan.method);
    expect(Array.isArray(plan.columns)).toBe(true);

    // 断言没有 aggregate 嵌套属性
    expect('aggregate' in plan).toBe(false);
    // 扁平字段直接存在于顶层
    expect(plan.method).toBe(AggMethod.SUM);
    expect(plan.columns).toEqual(['bonus']);
    expect(plan.groupBy).toEqual(['dept']);
  });

  it('AggregatePlan 无 groupBy 时可以不传', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
    };

    expect(plan.type).toBe('aggregate');
    expect(plan.groupBy).toBeUndefined();
  });

  it('DedupPlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'dedup',
      columns: ['name'],
    };

    expect(plan.type).toBe('dedup');
    // 列字段统一命名 columns（而非 columnKeys）
    expect(Array.isArray(plan.columns)).toBe(true);
    expect(plan.columns).toEqual(['name']);
  });

  it('MatchPlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'match',
      matchColumns: ['name'],
      lookupTables: ['联系方式.xlsx'],
    };

    expect(plan.type).toBe('match');
    expect(Array.isArray(plan.matchColumns)).toBe(true);
    expect(Array.isArray(plan.lookupTables)).toBe(true);
  });

  it('MergePlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'merge',
      sourceTables: ['表1', '表2'],
    };

    expect(plan.type).toBe('merge');
    expect(Array.isArray(plan.sourceTables)).toBe(true);
  });

  it('CleanPlan 结构符合契约', () => {
    const plan: ExecutionPlan = {
      type: 'clean',
    };

    expect(plan.type).toBe('clean');
  });

  it('所有 Plan type 联合类型是 disciminated union（7 种 type）', () => {
    const validTypes = new Set([
      'filter', 'sort', 'aggregate', 'dedup', 'match', 'merge', 'clean',
    ]);

    // 通过 compile 验证所有 TaskPlan action 都能映射到 ExecutionPlan type
    const allPlans: { action: string; plan: TaskPlan }[] = [
      { action: 'filter', plan: { action: 'filter', conditions: [{ columnHint: '基本工资', operator: '>', value: '5000' }] } },
      { action: 'sort', plan: { action: 'sort', columnHint: '基本工资', direction: 'desc' } },
      { action: 'aggregate', plan: { action: 'aggregate', method: 'sum', columnHints: ['基本工资'] } },
      { action: 'dedup', plan: { action: 'dedup', columnHints: ['姓名'] } },
      { action: 'match', plan: { action: 'match' } },
      { action: 'merge', plan: { action: 'merge' } },
      { action: 'clean', plan: { action: 'clean' } },
    ];

    for (const { action, plan } of allPlans) {
      const result = compile(plan, salaryColumns);
      expect(result.success).toBe(true);
      expect(validTypes.has(result.plan!.type)).toBe(true);
      expect(result.plan!.type).toBe(action === 'aggregate' ? 'aggregate' : action);
    }
  });

  it('compile 输出符合新 Schema（aggregate 扁平 + fields 统一命名）', () => {
    const taskPlan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['绩效奖金'],
      groupByHints: ['部门'],
    };

    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    const plan = result.plan!;
    expect(plan.type).toBe('aggregate');

    // 类型收窄后验证扁平字段
    if (plan.type === 'aggregate') {
      expect(plan.method).toBe(AggMethod.SUM);
      expect(plan.columns).toEqual(['bonus']);
      expect(plan.groupBy).toEqual(['dept']);

      // 确保没有嵌套对象
      expect('aggregate' in plan).toBe(false);
    }
  });

  it('compile dedup 输出 columns（而非 columnKeys）', () => {
    const taskPlan: TaskPlan = {
      action: 'dedup',
      columnHints: ['姓名'],
    };

    const result = compile(taskPlan, salaryColumns);
    expect(result.success).toBe(true);
    const plan = result.plan!;
    expect(plan.type).toBe('dedup');

    if (plan.type === 'dedup') {
      expect(plan.columns).toEqual(['name']);
    }
  });
});
