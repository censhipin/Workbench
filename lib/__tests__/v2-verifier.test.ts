import { describe, it, expect, beforeAll } from 'vitest';
import { VerifierRegistry } from '@/lib/v2/verifier/registry';
import { FilterVerifier } from '@/lib/v2/verifier/FilterVerifier';
import { SortVerifier } from '@/lib/v2/verifier/SortVerifier';
import { AggregateVerifier } from '@/lib/v2/verifier/AggregateVerifier';
import { DedupVerifier } from '@/lib/v2/verifier/DedupVerifier';
import { MatchVerifier } from '@/lib/v2/verifier/MatchVerifier';
import { runVerification } from '@/lib/v2/verifier/run-verification';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import { verifierRegistry, registerAllVerifiers } from '@/lib/v2/verifier';

// ============================================================
// Registry Tests
// ============================================================

describe('VerifierRegistry', () => {
  it('register + get + has', () => {
    const r = new VerifierRegistry();
    r.register(new FilterVerifier());

    expect(r.has('filter')).toBe(true);
    expect(r.get('filter')).toBeInstanceOf(FilterVerifier);
    expect(r.get('unknown')).toBeUndefined();
  });

  it('registerAll 批量注册', () => {
    const r = new VerifierRegistry();
    r.registerAll(new FilterVerifier(), new SortVerifier());

    expect(r.has('filter')).toBe(true);
    expect(r.has('sort')).toBe(true);
    expect(r.has('aggregate')).toBe(false);
  });

  it('types() 返回注册列表', () => {
    const r = new VerifierRegistry();
    r.register(new DedupVerifier());
    expect(r.types()).toEqual(['dedup']);
  });
});

// ============================================================
// FilterVerifier
// ============================================================

describe('FilterVerifier', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const inputRows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000 },
    { name: '李四', dept: '市场部', bonus: 3000 },
    { name: '王五', dept: '技术部', bonus: 6000 },
  ];

  it('正确筛选结果通过验证', () => {
    const verifier = new FilterVerifier();
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
    ]);

    expect(result.passed).toBe(true);
    expect(result.checks[0].detail).toContain('2');
  });

  it('存在不满足条件的行时验证失败', () => {
    const verifier = new FilterVerifier();
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.GT, value: 5000 }],
    };

    // 输出中包含 bonus=3000 的行，不应该存在
    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
      { name: '李四', dept: '市场部', bonus: 3000 }, // 不应该在结果中
    ]);

    expect(result.passed).toBe(false);
    expect(result.checks[0].detail).toContain('1/3');
  });

  it('无条件时通过', () => {
    const verifier = new FilterVerifier();
    const plan: ExecutionPlan = { type: 'filter', conditions: [] };

    const result = verifier.verify(plan, columns, inputRows, inputRows);

    expect(result.passed).toBe(true);
  });

  it('空结果通过验证', () => {
    const verifier = new FilterVerifier();
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.EQ, value: 99999 }],
    };

    const result = verifier.verify(plan, columns, inputRows, []);

    expect(result.passed).toBe(true);
  });

  it('多条件 AND 验证', () => {
    const verifier = new FilterVerifier();
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [
        { columnKey: 'dept', operator: Operator.EQ, value: '技术部' },
        { columnKey: 'bonus', operator: Operator.GTE, value: 6000 },
      ],
    };

    // 正确的结果：张三和王五
    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
    ]);

    expect(result.passed).toBe(true);
  });
});

// ============================================================
// SortVerifier
// ============================================================

describe('SortVerifier', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const inputRows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000 },
    { name: '李四', dept: '市场部', bonus: 3000 },
    { name: '王五', dept: '技术部', bonus: 6000 },
    { name: '赵六', dept: '市场部', bonus: 2000 },
  ];

  it('正确升序通过验证', () => {
    const verifier = new SortVerifier();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.ASC }],
    };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '赵六', dept: '市场部', bonus: 2000 },
      { name: '李四', dept: '市场部', bonus: 3000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
      { name: '张三', dept: '技术部', bonus: 8000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('正确降序通过验证', () => {
    const verifier = new SortVerifier();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.DESC }],
    };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
      { name: '李四', dept: '市场部', bonus: 3000 },
      { name: '赵六', dept: '市场部', bonus: 2000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('顺序错误时验证失败', () => {
    const verifier = new SortVerifier();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.ASC }],
    };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '赵六', dept: '市场部', bonus: 2000 }, // 8000 > 2000 且是 asc，错误
    ]);

    expect(result.passed).toBe(false);
  });

  it('多列排序验证（部门升序 + bonus 降序）', () => {
    const verifier = new SortVerifier();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [
        { columnKey: 'dept', order: SortOrder.ASC },
        { columnKey: 'bonus', order: SortOrder.DESC },
      ],
    };

    // 技术部（靠前）内部 bonus 降序，市场部（靠后）内部 bonus 降序
    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', bonus: 8000 },
      { name: '王五', dept: '技术部', bonus: 6000 },
      { name: '李四', dept: '市场部', bonus: 3000 },
      { name: '赵六', dept: '市场部', bonus: 2000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('0 或 1 行自动通过', () => {
    const verifier = new SortVerifier();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.ASC }],
    };

    expect(verifier.verify(plan, columns, inputRows, []).passed).toBe(true);
    expect(verifier.verify(plan, columns, inputRows, [{ name: '张三', dept: '技术部', bonus: 8000 }]).passed).toBe(true);
  });
});

// ============================================================
// AggregateVerifier
// ============================================================

describe('AggregateVerifier', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const inputRows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000 },
    { name: '李四', dept: '市场部', bonus: 3000 },
    { name: '王五', dept: '技术部', bonus: 6000 },
  ];

  it('SUM 无分组通过验证', () => {
    const verifier = new AggregateVerifier();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
    };

    // aggregateRows([]) 返回只有汇总列的结果
    const result = verifier.verify(plan, columns, inputRows, [
      { bonus_合计: 17000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('SUM 分组通过验证', () => {
    const verifier = new AggregateVerifier();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };

    const result = verifier.verify(plan, columns, inputRows, [
      { dept: '技术部', bonus_合计: 14000 },
      { dept: '市场部', bonus_合计: 3000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('分组聚合值错误时验证失败', () => {
    const verifier = new AggregateVerifier();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };

    // 市场部 bonus 合计应为 3000，这里写错了
    const result = verifier.verify(plan, columns, inputRows, [
      { dept: '技术部', bonus_合计: 14000 },
      { dept: '市场部', bonus_合计: 9999 },
    ]);

    expect(result.passed).toBe(false);
  });
});

// ============================================================
// DedupVerifier
// ============================================================

describe('DedupVerifier', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  it('无重复通过验证', () => {
    const verifier = new DedupVerifier();
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name'] };

    const result = verifier.verify(plan, columns, [], [
      { name: '张三', bonus: 8000 },
      { name: '李四', bonus: 3000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('存在重复时验证失败', () => {
    const verifier = new DedupVerifier();
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name'] };

    const result = verifier.verify(plan, columns, [], [
      { name: '张三', bonus: 8000 },
      { name: '张三', bonus: 8000 }, // 重复
    ]);

    expect(result.passed).toBe(false);
  });

  it('多列去重验证', () => {
    const verifier = new DedupVerifier();
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name', 'bonus'] };

    // name+bonus 组合无重复
    const result = verifier.verify(plan, columns, [], [
      { name: '张三', bonus: 8000 },
      { name: '张三', bonus: 3000 }, // 同名但不同 bonus，不算重复
    ]);

    expect(result.passed).toBe(true);
  });
});

// ============================================================
// MatchVerifier
// ============================================================

describe('MatchVerifier', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
  ];

  const inputRows: RowData[] = [
    { name: '张三', dept: '技术部' },
    { name: '李四', dept: '市场部' },
  ];

  it('匹配键有效通过验证', () => {
    const verifier = new MatchVerifier();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['表2'] };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部', _lkp_dept: '研发部' },
    ]);

    expect(result.passed).toBe(true);
  });

  it('匹配键在输入中不存在时验证失败', () => {
    const verifier = new MatchVerifier();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['表2'] };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: '张三', dept: '技术部' },
      { name: '王五', dept: '财务部' }, // 王五不在输入中
    ]);

    expect(result.passed).toBe(false);
  });

  it('无匹配键时跳过验证', () => {
    const verifier = new MatchVerifier();
    const plan: ExecutionPlan = { type: 'match', matchColumns: [], lookupTables: ['表2'] };

    const result = verifier.verify(plan, columns, inputRows, [
      { name: 'unknown', dept: 'unknown' },
    ]);

    expect(result.passed).toBe(true);
  });
});

// ============================================================
// runVerification Integration
// ============================================================

describe('runVerification', () => {
  // 注册所有验证器
  beforeAll(() => {
    registerAllVerifiers();
  });

  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const inputRows: RowData[] = [
    { name: '张三', bonus: 8000 },
    { name: '李四', bonus: 3000 },
    { name: '王五', bonus: 6000 },
  ];

  it('runVerification — filter 正确', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.GT, value: 5000 }],
    };

    const result = runVerification(plan, columns, inputRows, [
      { name: '张三', bonus: 8000 },
      { name: '王五', bonus: 6000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('runVerification — filter 失败', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.GT, value: 5000 }],
    };

    // 包含 bonus=3000 的行
    const result = runVerification(plan, columns, inputRows, [
      { name: '张三', bonus: 8000 },
      { name: '李四', bonus: 3000 },
    ]);

    expect(result.passed).toBe(false);
  });

  it('runVerification — 无验证器时默认通过', () => {
    // clean 没有注册验证器
    const plan: ExecutionPlan = { type: 'clean' };

    const result = runVerification(plan, columns, inputRows, inputRows);

    expect(result.passed).toBe(true);
  });

  it('runVerification — sort 正确', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.ASC }],
    };

    const result = runVerification(plan, columns, inputRows, [
      { name: '李四', bonus: 3000 },
      { name: '王五', bonus: 6000 },
      { name: '张三', bonus: 8000 },
    ]);

    expect(result.passed).toBe(true);
  });

  it('registry 全局单例已注册 verifier', () => {
    expect(verifierRegistry.has('filter')).toBe(true);
    expect(verifierRegistry.has('sort')).toBe(true);
    expect(verifierRegistry.has('aggregate')).toBe(true);
    expect(verifierRegistry.has('dedup')).toBe(true);
    expect(verifierRegistry.has('match')).toBe(true);
    expect(verifierRegistry.has('projection')).toBe(true);
  });
});
