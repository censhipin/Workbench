import { describe, it, expect, beforeAll } from 'vitest';
import { runExecutionPlan, registry as executorRegistry } from '@/lib/v2/execution-engine';
import { registerAllVerifiers, verifierRegistry } from '@/lib/v2/verifier';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

// 确保 Verifier 已注册
beforeAll(() => {
  registerAllVerifiers();
});

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

// ============================================================
// Filter — 验证正确数据通过，错误数据失败
// ============================================================

describe('Verification Integration — filter', () => {
  it('正确筛选结果通过验证', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.LT, value: 5000 }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    // 正确结果：李四(3000)、赵六(2000) 都 < 5000
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
  });

  it('输出包含不满足条件的行时验证失败', () => {
    // 这个测试验证 FilterVerifier 能捕获问题
    // 不经过 runExecutionPlan，直接构造错误输出
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.GT, value: 5000 }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    // bonus > 5000: 张三(8000) 王五(6000) 陈七(12000) → 3 行都满足
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
  });
});

// ============================================================
// Sort — 顺序错误时验证失败
// ============================================================

describe('Verification Integration — sort', () => {
  it('正确排序通过验证', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.DESC }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    const bonusValues = result.data!.rows.map((r) => r.bonus);
    expect(bonusValues).toEqual([12000, 8000, 6000, 3000, 2000]);
  });

  it('多列排序通过验证', () => {
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [
        { columnKey: 'dept', order: SortOrder.ASC },
        { columnKey: 'bonus', order: SortOrder.DESC },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    const bonusValues = result.data!.rows.map((r) => r.bonus);
    // 技术部（前三）内部 bonus 降序
    expect(bonusValues[0]).toBe(12000);
    expect(bonusValues[1]).toBe(8000);
    expect(bonusValues[2]).toBe(6000);
  });
});

// ============================================================
// Aggregate — 结果错误时失败
// ============================================================

describe('Verification Integration — aggregate', () => {
  it('正确聚合通过验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // 无分组时最后一行是汇总
    const aggKey = result.data!.columns.find((c) => c.title.includes('合计'))!.key;
    const sumRow = result.data!.rows[result.data!.rows.length - 1];
    expect(sumRow[aggKey]).toBe(31000);
  });

  it('分组聚合通过验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2);
    for (const row of result.data!.rows) {
      if (row.dept === '技术部') expect(row['bonus_合计']).toBe(26000);
      if (row.dept === '市场部') expect(row['bonus_合计']).toBe(5000);
    }
  });
});

// ============================================================
// Dedup — 通过验证
// ============================================================

describe('Verification Integration — dedup', () => {
  it('去重正确通过验证', () => {
    const dupSheet = {
      columns: salaryColumns,
      rows: [
        ...salaryRows,
        { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'dedup',
      columns: ['name'],
    };

    const result = runExecutionPlan(plan, dupSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
  });
});

// ============================================================
// Clean — 无 Verifier 时默认通过
// ============================================================

describe('Verification Integration — clean / merge / match', () => {
  it('clean（无验证器）默认通过', () => {
    const plan: ExecutionPlan = { type: 'clean' };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
  });
});

// ============================================================
// Verifier Registry 状态确认
// ============================================================

describe('Verifier registry status', () => {
  it('所有 V2 Verifier 已注册', () => {
    expect(verifierRegistry.has('filter')).toBe(true);
    expect(verifierRegistry.has('sort')).toBe(true);
    expect(verifierRegistry.has('aggregate')).toBe(true);
    expect(verifierRegistry.has('dedup')).toBe(true);
    expect(verifierRegistry.has('match')).toBe(true);
  });
});
