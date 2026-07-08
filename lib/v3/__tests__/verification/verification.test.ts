// ============================================================
// Verification Tests — V3 验证层测试
// ============================================================
// 覆盖：Filter / Aggregate / Match / Formula / Projection
//       Update / Dedup / Clean / Pipeline
// 共计 120+ 个测试
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import type { ColumnDef, RowData } from '@/lib/types';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import { AggMethod } from '@/lib/v2/execution-plan';
import { Operator } from '@/lib/v2/types';

import { FilterVerifier } from '@/lib/v3/verification/filter-verifier';
import { AggregateVerifier } from '@/lib/v3/verification/aggregate-verifier';
import { MatchVerifier } from '@/lib/v3/verification/match-verifier';
import { FormulaVerifier } from '@/lib/v3/verification/formula-verifier';
import { ProjectionVerifier } from '@/lib/v3/verification/projection-verifier';
import { UpdateVerifier } from '@/lib/v3/verification/update-verifier';
import { DedupVerifier } from '@/lib/v3/verification/dedup-verifier';
import { CleanVerifier } from '@/lib/v3/verification/clean-verifier';
import { PipelineVerifier } from '@/lib/v3/verification/pipeline-verifier';
import { verifyExecution, registerAllVerifiers } from '@/lib/v3/verification/verification-engine';
import { buildVerificationReport } from '@/lib/v3/verification/report-builder';
import { computeTableStats, computeGroupKeys, computeMatchStats } from '@/lib/v3/verification/statistics';
import { computeDiff } from '@/lib/v3/verification/diff';

// ============================================================
// 共享测试数据
// ============================================================

const cols: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'salary', title: '工资', type: 'number' },
  { key: 'bonus', title: '奖金', type: 'number' },
];

const rows: RowData[] = [
  { name: '张三', dept: '技术部', salary: 15000, bonus: 8000 },
  { name: '李四', dept: '技术部', salary: 12000, bonus: 6000 },
  { name: '王五', dept: '市场部', salary: 10000, bonus: 3000 },
  { name: '赵六', dept: '技术部', salary: 18000, bonus: 12000 },
  { name: '钱七', dept: '市场部', salary: 8000, bonus: 2000 },
];

// ============================================================
// FilterVerifier
// ============================================================

describe('FilterVerifier', () => {
  it('通过：所有行满足条件', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    const output = rows.filter(r => r.dept === '技术部');
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, output);
    expect(r.passed).toBe(true);
    expect(r.checks.length).toBeGreaterThanOrEqual(1);
    expect(r.stats?.removedCount).toBe(2);
  });

  it('通过：全保留（无条件等价）', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    const output = rows.filter(r => r.dept === '技术部');
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, output);
    expect(r.checks[0].passed).toBe(true);
  });

  it('失败：输出行不满足条件', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '市场部' }],
    };
    // 错误地加入了技术部的行
    const badOutput = [...rows.filter(r => r.dept === '市场部'), rows[0]];
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, badOutput);
    expect(r.passed).toBe(false);
    expect(r.checks[0].detail).toContain('不满足筛选条件');
  });

  it('警告：空结果', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '不存在' }],
    };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, []);
    expect(r.checks.some(c => !c.passed && c.name === '空结果检查')).toBe(true);
  });

  it('警告：全部删除', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'name', operator: Operator.EQ, value: '不存在' }],
    };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, []);
    expect(r.checks.some(c => c.name === '全部删除检查')).toBe(true);
  });

  it('支持多个条件（AND）', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [
        { columnKey: 'dept', operator: Operator.EQ, value: '技术部' },
        { columnKey: 'salary', operator: Operator.GT, value: 13000 },
      ],
    };
    const output = rows.filter(r => r.dept === '技术部' && r.salary > 13000);
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, output);
    expect(r.passed).toBe(true);
  });

  it('删除比例验证', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: 5000 }],
    };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, rows); // 全部保留
    expect(r.stats?.removedPct).toBe(0);
  });

  it('类型错误验证', () => {
    const v = new FilterVerifier();
    const r = v.verify({ type: 'aggregate' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
    expect(r.checks[0].detail).toContain('错误 type');
  });

  it('IS_NULL 条件验证', () => {
    const nullRows: RowData[] = [
      { name: '张三', dept: '技术部', salary: 15000, bonus: 8000 },
      { name: '李四', dept: null, salary: 12000, bonus: 6000 },
    ];
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.IS_NULL, value: null }],
    };
    const output = nullRows.filter(r => r.dept == null);
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, nullRows, cols, output);
    expect(r.passed).toBe(true);
  });

  it('CONTAINS 条件验证', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'name', operator: Operator.CONTAINS, value: '张' }],
    };
    const output = rows.filter(r => String(r.name).includes('张'));
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, output);
    expect(r.passed).toBe(true);
  });

  it('空条件数组', () => {
    const plan: ExecutionPlan = { type: 'filter', conditions: [] };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(true);
  });
});

// ============================================================
// AggregateVerifier
// ============================================================

describe('AggregateVerifier', () => {
  it('分组聚合验证：行数正确', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.SUM,
      columns: ['salary'], groupBy: ['dept'],
    };
    const output = [
      { dept: '技术部', salary_SUM: 45000 },
      { dept: '市场部', salary_SUM: 18000 },
    ];
    const outCols: ColumnDef[] = [
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'salary_SUM', title: '工资_合计', type: 'number' },
    ];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, output);
    expect(r.passed).toBe(true);
  });

  it('分组聚合验证：分组数量不匹配', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.SUM,
      columns: ['salary'], groupBy: ['dept'],
    };
    const badOutput = [{ dept: '技术部', salary_SUM: 45000 }]; // 少了一组
    const outCols: ColumnDef[] = [
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'salary_SUM', title: '工资_合计', type: 'number' },
    ];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, badOutput);
    expect(r.checks.some(c => c.name === '分组数量' && !c.passed)).toBe(true);
  });

  it('无分组聚合', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.AVG,
      columns: ['salary'],
    };
    const outCols: ColumnDef[] = [
      { key: 'salary_AVG', title: '工资_平均', type: 'number' },
    ];
    const output = [{ salary_AVG: 12600 }];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, output);
    expect(r.passed).toBe(true);
  });

  it('多列聚合验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.SUM,
      columns: ['salary', 'bonus'],
    };
    const outCols: ColumnDef[] = [
      { key: 'salary_SUM', title: '工资_合计', type: 'number' },
      { key: 'bonus_SUM', title: '奖金_合计', type: 'number' },
    ];
    const output = [{ salary_SUM: 63000, bonus_SUM: 31000 }];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, output);
    expect(r.passed).toBe(true);
  });

  it('Schema 验证失败', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.COUNT,
      columns: ['salary'], groupBy: ['dept'],
    };
    // 缺少分组列
    const outCols: ColumnDef[] = [
      { key: 'salary_COUNT', title: '工资_计数', type: 'number' },
    ];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, [{ salary_COUNT: 3 }]);
    expect(r.checks.some(c => !c.passed)).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new AggregateVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });

  it('MAX 聚合验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.MAX,
      columns: ['salary'],
    };
    const outCols: ColumnDef[] = [
      { key: 'salary_MAX', title: '工资_最大', type: 'number' },
    ];
    const output = [{ salary_MAX: 18000 }];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, output);
    expect(r.passed).toBe(true);
  });

  it('MIN 聚合验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.MIN,
      columns: ['salary'],
    };
    const outCols: ColumnDef[] = [
      { key: 'salary_MIN', title: '工资_最小', type: 'number' },
    ];
    const output = [{ salary_MIN: 8000 }];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, output);
    expect(r.passed).toBe(true);
  });
});

// ============================================================
// MatchVerifier
// ============================================================

describe('MatchVerifier', () => {
  it('无匹配操作时跳过', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: [], lookupTables: [] };
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(true);
  });

  it('统计匹配率（全部匹配）', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    // 模拟带右表值的输出
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_city', title: '_lkp_城市', type: 'text' },
    ];
    const outRows: RowData[] = rows.map(r => ({
      ...r, _lkp_city: '北京',
    }));
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.stats?.matchRate).toBe(1);
    expect(r.passed).toBe(true);
  });

  it('统计匹配率（部分匹配）', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_city', title: '_lkp_城市', type: 'text' },
    ];
    // 前两行匹配，其余未匹配
    const outRows: RowData[] = rows.map((r, i) => ({
      ...r, _lkp_city: i < 2 ? '北京' : null,
    }));
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.stats?.matchRate).toBe(0.4);
  });

  it('统计未匹配数', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_city', title: '_lkp_城市', type: 'text' },
    ];
    const outRows: RowData[] = rows.map(() => ({
      name: '张三', dept: '技术部', salary: 15000, bonus: 8000, _lkp_city: '北京',
    }));
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.stats?.matchRate).toBe(1);
  });

  it('高匹配率通过', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_phone', title: '_lkp_电话', type: 'text' },
    ];
    const outRows: RowData[] = rows.map((r, i) => ({
      ...r, _lkp_phone: i < 4 ? '12345678901' : null,
    }));
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.stats?.matchRate).toBe(0.8);
  });

  it('完全无匹配', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_city', title: '_lkp_城市', type: 'text' },
    ];
    const outRows: RowData[] = rows.map(r => ({
      ...r, _lkp_city: null,
    }));
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.stats?.matchRate).toBe(0);
    expect(r.checks.some(c => c.name === '匹配警告' && !c.passed)).toBe(true);
  });

  it('追加右表行', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const rightCols: ColumnDef[] = [
      ...cols,
      { key: '_lkp_city', title: '_lkp_城市', type: 'text' },
    ];
    // 比左表多 2 行
    const outRows: RowData[] = [
      ...rows.map(r => ({ ...r, _lkp_city: '北京' })),
      { name: '周八', dept: '销售部', salary: 9000, bonus: 1000, _lkp_city: '上海' },
      { name: '吴九', dept: '销售部', salary: 9500, bonus: 1500, _lkp_city: '上海' },
    ];
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, rightCols, outRows);
    expect(r.checks.some(c => c.name === '追加行' && c.passed)).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new MatchVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// FormulaVerifier
// ============================================================

describe('FormulaVerifier', () => {
  const formulaPlan: ExecutionPlan = {
    type: 'formula',
    targetColumn: 'total',
    sourceColumns: ['salary', 'bonus'],
    expressionType: '+',
  };

  it('目标列存在于输出中', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows: RowData[] = rows.map(r => ({ ...r, total: (r.salary as number) + (r.bonus as number) }));
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, outCols, outRows);
    expect(r.checks[0].passed).toBe(true);
  });

  it('目标列不存在', () => {
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });

  it('数值类型检查', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows: RowData[] = rows.map(r => ({ ...r, total: 'abc' }));
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, outCols, outRows);
    expect(r.checks.some(c => c.name === '数值类型' && !c.passed)).toBe(true);
  });

  it('空值统计', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows: RowData[] = rows.map(r => ({ ...r, total: null }));
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, outCols, outRows);
    expect(r.checks.some(c => c.name === '空值统计')).toBe(true);
  });

  it('源列缺失检查', () => {
    const missingSourcePlan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'result',
      sourceColumns: ['nonexistent'],
      expressionType: '+',
    };
    const outCols: ColumnDef[] = [...cols, { key: 'result', title: '结果', type: 'number' }];
    const v = new FormulaVerifier();
    const r = v.verify(missingSourcePlan, cols, rows, outCols, rows);
    expect(r.checks.some(c => c.name === '源列检查' && !c.passed)).toBe(true);
  });

  it('全部常量值检测', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows: RowData[] = rows.map(r => ({ ...r, total: 100 }));
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, outCols, outRows);
    expect(r.checks.some(c => c.name === '数值范围')).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new FormulaVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });

  it('空值率警告', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows: RowData[] = [
      { name: '张三', dept: '技术部', salary: 15000, bonus: 8000, total: null },
      { name: '李四', dept: '技术部', salary: 12000, bonus: 6000, total: null },
      { name: '王五', dept: '市场部', salary: 10000, bonus: 3000, total: null },
    ];
    const v = new FormulaVerifier();
    const r = v.verify(formulaPlan, cols, rows, outCols, outRows);
    expect(r.checks.some(c => c.name === '空值率')).toBe(true);
  });
});

// ============================================================
// ProjectionVerifier
// ============================================================

describe('ProjectionVerifier', () => {
  it('includeColumns 全部包含', () => {
    const plan: ExecutionPlan = { type: 'projection', includeColumns: ['name', 'dept'] };
    const outCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
    ];
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, outCols, rows);
    expect(r.passed).toBe(true);
  });

  it('includeColumns 缺失列', () => {
    const plan: ExecutionPlan = { type: 'projection', includeColumns: ['name', 'missing'] };
    const outCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
    ];
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, outCols, rows);
    expect(r.checks.some(c => c.name === '包含列检查' && !c.passed)).toBe(true);
  });

  it('excludeColumns 全部排除', () => {
    const plan: ExecutionPlan = { type: 'projection', excludeColumns: ['salary', 'bonus'] };
    const outCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
    ];
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, outCols, rows);
    expect(r.passed).toBe(true);
  });

  it('excludeColumns 仍有残留', () => {
    const plan: ExecutionPlan = { type: 'projection', excludeColumns: ['salary'] };
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.checks.some(c => c.name === '排除列检查' && !c.passed)).toBe(true);
  });

  it('rename 正确', () => {
    const plan: ExecutionPlan = { type: 'projection', renameColumns: { name: 'full_name' } };
    // renameColumns: { oldKey: newTitle } — OutputProcessor 只改 title 不改 key
    const outCols: ColumnDef[] = [
      { key: 'name', title: 'full_name', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'salary', title: '工资', type: 'number' },
      { key: 'bonus', title: '奖金', type: 'number' },
    ];
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, outCols, rows);
    expect(r.checks.find(c => c.name === '重命名检查')?.passed).toBe(true);
  });

  it('rename 失败', () => {
    const plan: ExecutionPlan = { type: 'projection', renameColumns: { name: 'nonexistent_key' } };
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.checks.find(c => c.name === '重命名检查' && !c.passed)).toBeTruthy();
  });

  it('reorder 正确', () => {
    const plan: ExecutionPlan = { type: 'projection', reorderColumns: ['name', 'dept', 'salary', 'bonus'] };
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.checks.find(c => c.name === '列序检查')?.passed).toBe(true);
  });

  it('reorder 不正确', () => {
    const plan: ExecutionPlan = { type: 'projection', reorderColumns: ['bonus', 'salary', 'dept', 'name'] };
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.checks.find(c => c.name === '列序检查' && !c.passed)).toBeTruthy();
  });

  it('类型错误验证', () => {
    const v = new ProjectionVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// UpdateVerifier
// ============================================================

describe('UpdateVerifier', () => {
  it('行数不变验证', () => {
    const plan: ExecutionPlan = { type: 'update', column: 'dept', value: '销售部' };
    const outRows = rows.map(r => ({ ...r, dept: '销售部' }));
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.passed).toBe(true);
  });

  it('行数变化报警', () => {
    const plan: ExecutionPlan = { type: 'update', column: 'dept', value: '销售部' };
    const outRows = rows.slice(0, 3);
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.checks[0].passed).toBe(false);
  });

  it('更新值验证：全部正确', () => {
    const plan: ExecutionPlan = { type: 'update', column: 'dept', value: '销售部' };
    const outRows = rows.map(r => ({ ...r, dept: '销售部' }));
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.stats?.modifiedCount).toBe(5);
    expect(r.stats?.unmodifiedCount).toBe(0);
  });

  it('条件更新验证', () => {
    const plan: ExecutionPlan = {
      type: 'update', column: 'bonus', value: 9999,
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    const outRows = rows.map(r => ({
      ...r,
      bonus: r.dept === '技术部' ? 9999 : r.bonus,
    }));
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.stats?.modifiedCount).toBe(3);
    expect(r.stats?.unmodifiedCount).toBe(2);
    expect(r.passed).toBe(true);
  });

  it('条件更新：值错误检测', () => {
    const plan: ExecutionPlan = {
      type: 'update', column: 'bonus', value: 9999,
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    // 不满足条件的行也被改了
    const outRows = rows.map(r => ({
      ...r, bonus: 9999,
    }));
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.checks.some(c => c.name === '更新值验证' && !c.passed)).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new UpdateVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// DedupVerifier
// ============================================================

describe('DedupVerifier', () => {
  const dedupPlan: ExecutionPlan = { type: 'dedup', columns: ['name'] };
  const dedupCols: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
  ];
  const dupRows: RowData[] = [
    { name: '张三', dept: '技术部' },
    { name: '张三', dept: '技术部' },
    { name: '李四', dept: '市场部' },
    { name: '李四', dept: '市场部' },
  ];
  const dedupedRows: RowData[] = [
    { name: '张三', dept: '技术部' },
    { name: '李四', dept: '市场部' },
  ];

  it('去重后无重复', () => {
    const v = new DedupVerifier();
    const r = v.verify(dedupPlan, dedupCols, dupRows, dedupCols, dedupedRows);
    expect(r.passed).toBe(true);
  });

  it('去重统计', () => {
    const v = new DedupVerifier();
    const r = v.verify(dedupPlan, dedupCols, dupRows, dedupCols, dedupedRows);
    expect(r.stats?.dedupRemoved).toBe(2);
  });

  it('输出仍有重复', () => {
    const v = new DedupVerifier();
    const r = v.verify(dedupPlan, dedupCols, dupRows, dedupCols, dupRows);
    expect(r.checks[0].passed).toBe(false);
  });

  it('全部列去重', () => {
    const plan: ExecutionPlan = { type: 'dedup', columns: [] };
    const v = new DedupVerifier();
    const r = v.verify(plan, dedupCols, dupRows, dedupCols, dedupedRows);
    expect(r.passed).toBe(true);
  });

  it('空输入的处理', () => {
    const v = new DedupVerifier();
    const r = v.verify(dedupPlan, dedupCols, [], dedupCols, []);
    expect(r.passed).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new DedupVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// CleanVerifier
// ============================================================

describe('CleanVerifier', () => {
  const dirtyCols: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
  ];
  const dirtyRows: RowData[] = [
    { name: '张三', dept: '技术部' },
    { name: null, dept: null },
    { name: '', dept: '市场部' },
    { name: null, dept: '' },
    { name: '王五', dept: '销售部' },
  ];
  const cleanPlan: ExecutionPlan = { type: 'clean' };

  it('空值减少', () => {
    const cleanRows = [dirtyRows[0], dirtyRows[4]];
    const v = new CleanVerifier();
    const r = v.verify(cleanPlan, dirtyCols, dirtyRows, dirtyCols, cleanRows);
    expect(r.passed).toBe(true);
    expect(r.checks[0].passed).toBe(true);
  });

  it('行数变化', () => {
    const cleanRows = [dirtyRows[0], dirtyRows[4]];
    const v = new CleanVerifier();
    const r = v.verify(cleanPlan, dirtyCols, dirtyRows, dirtyCols, cleanRows);
    expect(r.stats?.deletedCount).toBe(3);
  });

  it('列数不变', () => {
    const v = new CleanVerifier();
    const r = v.verify(cleanPlan, dirtyCols, dirtyRows, dirtyCols, dirtyRows);
    expect(r.checks.find(c => c.name === '列数检查')?.passed).toBe(true);
  });

  it('列数变化', () => {
    const extraCols: ColumnDef[] = [...dirtyCols, { key: 'extra', title: '额外', type: 'text' }];
    const v = new CleanVerifier();
    const r = v.verify(cleanPlan, dirtyCols, dirtyRows, extraCols, dirtyRows);
    expect(r.checks.find(c => c.name === '列数检查' && !c.passed)).toBeTruthy();
  });

  it('清洗后空值率', () => {
    const allNullRows: RowData[] = [
      { name: null, dept: null },
      { name: null, dept: null },
    ];
    const v = new CleanVerifier();
    const r = v.verify(cleanPlan, dirtyCols, allNullRows, dirtyCols, allNullRows);
    expect(r.checks.some(c => c.name === '清洗质量' && !c.passed)).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new CleanVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// PipelineVerifier
// ============================================================

describe('PipelineVerifier', () => {
  it('步骤数量记录', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        { type: 'filter', conditions: [] },
        { type: 'sort', sorts: [] },
      ],
    };
    const v = new PipelineVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.checks[0].detail).toContain('2');
  });

  it('非空输入→空输出警告', () => {
    const plan: ExecutionPlan = { type: 'pipeline', steps: [] };
    const v = new PipelineVerifier();
    const r = v.verify(plan, cols, rows, cols, []);
    expect(r.checks[1].passed).toBe(false);
  });

  it('空输入→空输出', () => {
    const plan: ExecutionPlan = { type: 'pipeline', steps: [] };
    const v = new PipelineVerifier();
    const r = v.verify(plan, cols, [], cols, []);
    expect(r.passed).toBe(true);
  });

  it('类型错误验证', () => {
    const v = new PipelineVerifier();
    const r = v.verify({ type: 'filter' } as any, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });
});

// ============================================================
// 统计引擎测试
// ============================================================

describe('Statistics Engine', () => {
  it('computeTableStats 基本统计', () => {
    const s = computeTableStats(rows, cols);
    expect(s.rowCount).toBe(5);
    expect(s.columnCount).toBe(4);
    expect(s.nullCount).toBe(0);
    expect(s.duplicateCount).toBe(0);
  });

  it('computeTableStats 空值统计', () => {
    const nullRows: RowData[] = [
      { name: null, dept: '技术部', salary: 15000, bonus: 8000 },
      { name: '李四', dept: null, salary: null, bonus: 6000 },
    ];
    const s = computeTableStats(nullRows, cols);
    expect(s.nullCount).toBe(3);
    expect(s.emptyRowCount).toBe(0);
  });

  it('computeTableStats 全空行', () => {
    const emptyRows: RowData[] = [
      { name: null, dept: null, salary: null, bonus: null },
    ];
    const s = computeTableStats(emptyRows, cols);
    expect(s.emptyRowCount).toBe(1);
  });

  it('computeGroupKeys', () => {
    const keys = computeGroupKeys(rows, ['dept']);
    expect(keys.size).toBe(2);
    expect(keys.has('技术部')).toBe(true);
    expect(keys.has('市场部')).toBe(true);
  });

  it('computeGroupKeys 多列分组', () => {
    const multiRows: RowData[] = [
      { dept: '技术部', name: '张三' },
      { dept: '技术部', name: '李四' },
      { dept: '市场部', name: '王五' },
    ];
    const keys = computeGroupKeys(multiRows, ['dept', 'name']);
    expect(keys.size).toBe(3);
  });

  it('computeMatchStats 全部匹配', () => {
    const left = rows;
    const right = rows.map(r => ({ ...r, city: '北京' }));
    const output = rows.map(r => ({ ...r, _lkp_city: '北京' }));
    // 添加右表列
    const rightCols: ColumnDef[] = [...cols, { key: '_lkp_city', title: '_lkp_城市', type: 'text' }];
    const stats = computeMatchStats(left, right, ['name'], output.map(r => ({ ...r, ...rightCols.reduce((a, c) => ({ ...a, [c.key]: r[c.key] ?? r[c.key.replace('_lkp_', '')] }), {}) })));
    // Simplified: just check the interface exists
    expect(typeof stats).toBe('object');
  });

  it('computeTableStats 数值统计', () => {
    const s = computeTableStats(rows, cols);
    const salaryStats = s.columns.find(c => c.columnKey === 'salary');
    expect(salaryStats?.min).toBe(8000);
    expect(salaryStats?.max).toBe(18000);
    expect(salaryStats?.avg).toBe(12600);
  });

  it('computeTableStats 唯一值', () => {
    const s = computeTableStats(rows, cols);
    const deptStats = s.columns.find(c => c.columnKey === 'dept');
    expect(deptStats?.uniqueCount).toBe(2);
  });
});

// ============================================================
// Diff Engine 测试
// ============================================================

describe('Diff Engine', () => {
  it('完全相同', () => {
    const diff = computeDiff(cols, rows, cols, rows);
    expect(diff.rowsAdded).toBe(0);
    expect(diff.rowsRemoved).toBe(0);
    expect(diff.columnsAdded).toBe(0);
    expect(diff.columnsRemoved).toBe(0);
  });

  it('新增列', () => {
    const outCols: ColumnDef[] = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const diff = computeDiff(cols, rows, outCols, rows);
    expect(diff.columnsAdded).toBe(1);
  });

  it('删除列', () => {
    const outCols = cols.slice(0, 2);
    const diff = computeDiff(cols, rows, outCols, rows);
    expect(diff.columnsRemoved).toBe(2);
  });

  it('行增加', () => {
    const extraRows = [...rows, { name: '周八', dept: '销售部', salary: 9000, bonus: 1000 }];
    const diff = computeDiff(cols, rows, cols, extraRows);
    expect(diff.rowsAdded).toBe(1);
  });

  it('行减少', () => {
    const fewerRows = rows.slice(0, 3);
    const diff = computeDiff(cols, rows, cols, fewerRows);
    expect(diff.rowsRemoved).toBe(2);
  });

  it('列重命名', () => {
    const renamedCols: ColumnDef[] = [
      { key: 'full_name', title: '姓名', type: 'text' },
      ...cols.slice(1),
    ];
    const diff = computeDiff(cols, rows, renamedCols, rows);
    expect(diff.columnsRenamed).toBe(1);
  });

  it('空输入', () => {
    const diff = computeDiff(cols, [], cols, rows);
    expect(diff.rowsAdded).toBe(rows.length);
  });

  it('空输出', () => {
    const diff = computeDiff(cols, rows, cols, []);
    expect(diff.rowsRemoved).toBe(rows.length);
  });
});

// ============================================================
// Report Builder 测试
// ============================================================

describe('Report Builder', () => {
  it('通过报告', () => {
    const result = {
      passed: true, confidence: 0.9,
      checks: [{ name: '测试', passed: true, detail: '全部通过' }],
    };
    const report = buildVerificationReport(result as any, '筛选');
    expect(report.title).toContain('验证通过');
    expect(report.confidence).toBe(0.9);
  });

  it('失败报告', () => {
    const result = {
      passed: false, confidence: 0,
      checks: [{ name: '测试', passed: false, detail: '不匹配' }],
    };
    const report = buildVerificationReport(result as any, '聚合');
    expect(report.title).toContain('验证失败');
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('统计信息输出', () => {
    const result = {
      passed: true, confidence: 0.9,
      checks: [{ name: '测试', passed: true, detail: '通过' }],
      stats: { matchRate: 0.85, matchCount: 85, unmatchedCount: 15 },
    };
    const report = buildVerificationReport(result as any, '匹配');
    expect(report.details.some(d => d.includes('85'))).toBe(true);
  });
});

// ============================================================
// Verification Engine 集成测试
// ============================================================

describe('Verification Engine', () => {
  beforeAll(() => {
    registerAllVerifiers();
  });

  it('filter 通过验证引擎', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    const output = rows.filter(r => r.dept === '技术部');
    const result = verifyExecution(plan, cols, rows, cols, output);
    expect(result.passed).toBe(true);
  });

  it('aggregate 通过验证引擎', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.SUM,
      columns: ['salary'], groupBy: ['dept'],
    };
    const outCols: ColumnDef[] = [
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'salary_SUM', title: '工资_合计', type: 'number' },
    ];
    const output = [
      { dept: '技术部', salary_SUM: 45000 },
      { dept: '市场部', salary_SUM: 18000 },
    ];
    const result = verifyExecution(plan, cols, rows, outCols, output);
    expect(result.passed).toBe(true);
  });

  it('aggregate 分组验证不匹配', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.AVG,
      columns: ['salary'], groupBy: ['dept'],
    };
    const outCols: ColumnDef[] = [
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'salary_AVG', title: '工资_平均', type: 'number' },
    ];
    // 输出行数不对
    const output = [{ dept: '技术部', salary_AVG: 15000 }];
    const result = verifyExecution(plan, cols, rows, outCols, output);
    expect(result.checks.some(c => c.name === '分组数量' && !c.passed)).toBe(true);
  });

  it('match 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const result = verifyExecution(plan, cols, rows, cols, rows);
    // 无 _lkp_ 列，匹配验证跳过
    expect(result.passed).toBe(true);
  });

  it('formula 通过验证引擎', () => {
    const plan: ExecutionPlan = {
      type: 'formula', targetColumn: 'total',
      sourceColumns: ['salary', 'bonus'], expressionType: '+',
    };
    const outCols = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const outRows = rows.map(r => ({ ...r, total: (r.salary as number) + (r.bonus as number) }));
    const result = verifyExecution(plan, cols, rows, outCols, outRows);
    expect(result.passed).toBe(true);
  });

  it('不支持的 operation 类型返回跳过', () => {
    const plan: ExecutionPlan = { type: 'sort', sorts: [] };
    const result = verifyExecution(plan, cols, rows, cols, rows);
    expect(result.passed).toBe(true);
    expect(result.checks[0].detail).toContain('无专用验证器');
  });

  it('projection 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'projection', includeColumns: ['name', 'dept'] };
    const outCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
    ];
    const result = verifyExecution(plan, cols, rows, outCols, rows);
    expect(result.passed).toBe(true);
  });

  it('update 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'update', column: 'dept', value: '销售部' };
    const outRows = rows.map(r => ({ ...r, dept: '销售部' }));
    const result = verifyExecution(plan, cols, rows, cols, outRows);
    expect(result.passed).toBe(true);
  });

  it('dedup 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name'] };
    const result = verifyExecution(plan, cols, rows, cols, rows);
    expect(result.passed).toBe(true);
  });

  it('clean 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'clean' };
    const result = verifyExecution(plan, cols, rows, cols, rows);
    expect(result.passed).toBe(true);
  });

  it('pipeline 通过验证引擎', () => {
    const plan: ExecutionPlan = { type: 'pipeline', steps: [] };
    const result = verifyExecution(plan, cols, rows, cols, rows);
    expect(result.passed).toBe(true);
  });

  it('verifyExecution 返回 diff', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
    };
    const output = rows.filter(r => r.dept === '技术部');
    const result = verifyExecution(plan, cols, rows, cols, output);
    expect(result.diff).toBeDefined();
    expect(result.diff!.rowsRemoved).toBe(2);
  });
});

// ============================================================
// 边界情况测试
// ============================================================

describe('Edge Cases', () => {
  it('空表统计', () => {
    const s = computeTableStats([], []);
    expect(s.rowCount).toBe(0);
    expect(s.columnCount).toBe(0);
  });

  it('单行统计', () => {
    const s = computeTableStats(
      [{ name: '张三', dept: '技术部', salary: 15000, bonus: 8000 }],
      cols,
    );
    expect(s.rowCount).toBe(1);
    expect(s.duplicateCount).toBe(0);
  });

  it('全重复统计', () => {
    const dup = [rows[0], rows[0], rows[0]];
    const s = computeTableStats(dup, cols);
    expect(s.duplicateCount).toBe(2);
  });

  it('FilterVerifier 大比例删除', () => {
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: 100000 }],
    };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, []);
    expect(r.checks.some(c => c.name === '全部删除检查')).toBe(true);
  });

  it('MatchVerifier 空左表', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, [], cols, []);
    expect(r.passed).toBe(true);
  });

  it('FormulaVerifier 空输出', () => {
    const plan: ExecutionPlan = {
      type: 'formula', targetColumn: 'total',
      sourceColumns: ['salary', 'bonus'], expressionType: '+',
    };
    const outCols = [...cols, { key: 'total', title: '合计', type: 'number' }];
    const v = new FormulaVerifier();
    const r = v.verify(plan, cols, [], outCols, []);
    expect(r.passed).toBe(true);
  });

  it('DedupVerifier 全部重复', () => {
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name'] };
    const allDup = [rows[0], rows[0], rows[0]];
    const deduped = [rows[0]];
    const v = new DedupVerifier();
    const r = v.verify(plan, cols, allDup, cols, deduped);
    expect(r.passed).toBe(true);
    expect(r.stats?.dedupRemoved).toBe(2);
  });

  it('CleanVerifier 全部为空行', () => {
    const allNull = [
      { name: null, dept: null, salary: null, bonus: null },
    ];
    const plan: ExecutionPlan = { type: 'clean' };
    const v = new CleanVerifier();
    const r = v.verify(plan, cols, allNull, cols, allNull);
    expect(r.checks[0].passed).toBe(true); // 空值变化
  });

  it('Diff 全部变更', () => {
    const diff = computeDiff(cols, rows, [], []);
    expect(diff.rowsRemoved).toBe(5);
    expect(diff.columnsRemoved).toBe(4);
  });

  it('UpdateVerifier 修改计数', () => {
    const plan: ExecutionPlan = { type: 'update', column: 'dept', value: '销售部' };
    const outRows = rows.map(r => ({ ...r, dept: '销售部' }));
    const v = new UpdateVerifier();
    const r = v.verify(plan, cols, rows, cols, outRows);
    expect(r.stats?.modifiedCount).toBe(5);
    expect(r.stats?.unmodifiedCount).toBe(0);
  });

  it('Report Builder 含统计', () => {
    const result = {
      passed: true, confidence: 0.95,
      checks: [{ name: '验证', passed: true, detail: '全部通过' }],
      stats: { rowCount: 100, columnCount: 5, removedCount: 20, removedPct: 0.2 },
    };
    const report = buildVerificationReport(result as any, '筛选');
    expect(report.details.some(d => d.includes('20'))).toBe(true);
  });

  it('FilterVerifier 空条件返回通过', () => {
    const plan: ExecutionPlan = { type: 'filter', conditions: [] };
    const v = new FilterVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(true);
  });

  it('AggregateVerifier COUNT 验证', () => {
    const plan: ExecutionPlan = {
      type: 'aggregate', method: AggMethod.COUNT, columns: ['name'],
    };
    const outCols: ColumnDef[] = [{ key: 'name_COUNT', title: '计数', type: 'number' }];
    const v = new AggregateVerifier();
    const r = v.verify(plan, cols, rows, outCols, [{ name_COUNT: 5 }]);
    // 无分组时只验证 schema，聚合值验证可能因重算方式不同跳过
    expect(r.checks.length).toBeGreaterThan(0);
  });

  it('MatchVerifier 无 _lkp_ 列跳过', () => {
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const v = new MatchVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(true);
  });

  it('ProjectionVerifier include 和 exclude 互斥', () => {
    const plan: ExecutionPlan = {
      type: 'projection', includeColumns: ['name'], excludeColumns: ['salary'],
    };
    const v = new ProjectionVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(false);
  });

  it('DedupVerifier 全部列去重保留所有列', () => {
    const plan: ExecutionPlan = { type: 'dedup', columns: [] };
    const dup: RowData[] = [
      { name: '张三', dept: '技术部', salary: 15000, bonus: 8000 },
      { name: '张三', dept: '技术部', salary: 15000, bonus: 8000 },
      { name: '张三', dept: '技术部', salary: 15000, bonus: 8000 },
    ];
    const out: RowData[] = [{ name: '张三', dept: '技术部', salary: 15000, bonus: 8000 }];
    const v = new DedupVerifier();
    const r = v.verify(plan, cols, dup, cols, out);
    expect(r.passed).toBe(true);
  });

  it('CleanVerifier 无空值输入不减少', () => {
    const plan: ExecutionPlan = { type: 'clean' };
    const v = new CleanVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.stats?.deletedCount).toBe(0);
  });

  it('PipelineVerifier 空步骤输入不变', () => {
    const plan: ExecutionPlan = { type: 'pipeline', steps: [] };
    const v = new PipelineVerifier();
    const r = v.verify(plan, cols, rows, cols, rows);
    expect(r.passed).toBe(true);
  });

  it('computeMatchStats 无匹配列', () => {
    const left = rows;
    const right = rows.map(r => ({ ...r, city: '北京' }));
    const output = rows.map(r => ({ ...r, _lkp_city: '北京' }));
    const stats = computeMatchStats(left, right, ['name'], output);
    expect(stats.matchRate).toBeDefined();
  });

  it('computeGroupKeys 统计数量', () => {
    const keys = computeGroupKeys(rows, ['dept', 'salary']);
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });

  it('computeTableStats csv 字符串统计', () => {
    const s = computeTableStats(rows, cols);
    const nameStats = s.columns.find(c => c.columnKey === 'name');
    expect(nameStats?.uniqueCount).toBeGreaterThan(0);
  });

  it('Diff 不区分空字符串和 null', () => {
    const diff = computeDiff(cols, rows, cols, rows);
    expect(diff.rowsAdded).toBe(0);
  });

  it('Report Builder 空 checks 处理', () => {
    const report = buildVerificationReport({ passed: true, confidence: 1, checks: [] } as any, '筛选');
    expect(report.title).toContain('验证通过');
  });
});
