// ============================================================
// EIC Profile → ValidatePlan 集成测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildDataProfile } from '../profile';
import { validatePlan } from '../../v2/plan-validator';
import type { ColumnDef, RowData } from '../../lib/types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import { AggMethod } from '../../v2/execution-plan';
import { Operator } from '../../v2/types';

const TEST_COLUMNS: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'salary', title: '工资', type: 'number' },
  { key: 'city', title: '城市', type: 'text' },
  { key: 'date', title: '日期', type: 'date' },
];

function makeRows(data: Record<string, unknown>[]): RowData[] {
  return data.map((d) => {
    const row: RowData = {};
    for (const col of TEST_COLUMNS) {
      row[col.key] = (d[col.key] ?? null) as never;
    }
    return row;
  });
}

describe('Profile → Filter validation', () => {
  it('should warn when filter column has > 50% nulls', () => {
    const rows = makeRows([
      { salary: null }, { salary: null }, { salary: null },
      { salary: 10000 }, { salary: 20000 },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: 5000 }],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const nullWarnings = result.issues.filter(
      (i) => i.field.includes('salary') && i.message.includes('空值率'),
    );
    expect(nullWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn when numeric column used with text operator', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: 30000 }, { salary: 40000 }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.CONTAINS, value: '1000' }],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const opWarnings = result.issues.filter(
      (i) => i.message.includes('不支持') && i.message.includes('CONTAINS'),
    );
    expect(opWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass with clean data and valid filter', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: 30000 }, { salary: 40000 }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: 15000 }],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const profileIssues = result.issues.filter(
      (i) => i.field.startsWith('conditions') && !i.field.startsWith('conditions['),
    );
    // Should have no profile warnings for clean data
    expect(profileIssues.length).toBe(0);
  });
});

describe('Profile → Aggregate validation', () => {
  it('should error when aggregating non-numeric column', () => {
    const rows = makeRows([
      { name: '张三' }, { name: '李四' }, { name: '王五' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['name'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const typeErrors = result.issues.filter(
      (i) => i.severity === 'error' && i.message.includes('不是数值类型'),
    );
    expect(typeErrors.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn when aggregate column has nulls', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: null }, { salary: 30000 }, { salary: null }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.AVG,
      columns: ['salary'],
      groupBy: ['dept'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const nullWarnings = result.issues.filter(
      (i) => i.field.includes('salary') && i.message.includes('空值'),
    );
    expect(nullWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass with clean numeric aggregation', () => {
    const rows = makeRows([
      { salary: 10000, dept: '技术部' },
      { salary: 20000, dept: '销售部' },
      { salary: 30000, dept: '技术部' },
      { salary: 40000, dept: '销售部' },
      { salary: 50000, dept: '技术部' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['salary'],
      groupBy: ['dept'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    expect(result.valid).toBe(true);
  });
});

describe('Profile → Match validation', () => {
  it('should warn when match key has low uniqueness', () => {
    const rows = makeRows([
      { city: '北京' }, { city: '北京' }, { city: '北京' },
      { city: '北京' }, { city: '北京' }, { city: '北京' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'match',
      matchColumns: ['city'],
      lookupTables: ['表2'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const matchWarnings = result.issues.filter(
      (i) => i.message.includes('唯一值率') && i.message.includes('匹配键'),
    );
    expect(matchWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn when match key has nulls', () => {
    const rows = makeRows([
      { city: '北京' }, { city: null }, { city: '上海' }, { city: null }, { city: '广州' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'match',
      matchColumns: ['city'],
      lookupTables: ['表2'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const nullWarnings = result.issues.filter(
      (i) => i.message.includes('空值') && i.message.includes('匹配'),
    );
    expect(nullWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass with high-quality match key', () => {
    const rows = makeRows([
      { city: '北京' }, { city: '上海' }, { city: '广州' }, { city: '深圳' }, { city: '杭州' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'match',
      matchColumns: ['city'],
      lookupTables: ['表2'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    // No profile-specific match warnings
    const matchWarnings = result.issues.filter((i) => i.field.startsWith('matchColumns'));
    expect(matchWarnings.length).toBe(0);
  });
});

describe('Profile → Dedup validation', () => {
  it('should warn when dedup column has many nulls', () => {
    const rows = makeRows([
      { name: null }, { name: null }, { name: '张三' }, { name: null }, { name: '李四' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'dedup',
      columns: ['name'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const nullWarnings = result.issues.filter(
      (i) => i.message.includes('空值率') && i.message.includes('去重'),
    );
    expect(nullWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn when overall duplicate rate is high', () => {
    const rows = makeRows([
      { name: '张三', dept: '技术部' },
      { name: '张三', dept: '技术部' },
      { name: '张三', dept: '技术部' },
      { name: '李四', dept: '销售部' },
      { name: '王五', dept: '技术部' },
    ]);
    const profile = buildDataProfile(TEST_COLUMNS, rows);
    const plan: ExecutionPlan = {
      type: 'dedup',
      columns: ['name'],
    };

    const result = validatePlan(plan, TEST_COLUMNS, profile);
    const dupWarnings = result.issues.filter((i) => i.message.includes('重复'));
    expect(dupWarnings.length).toBeGreaterThanOrEqual(1);
  });
});
