// ============================================================
// EIC Repair -> Execution Engine Integration Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildDataProfile } from '../profile';
import { repairPlan } from '../repair/repair-engine';
import { buildColumnValueIndex } from '../repair/column-repair';
import type { ColumnDef, RowData } from '../../types';
import type { FilterPlan, ExecutionPlan } from '../../v2/execution-plan';
import { Operator } from '../../v2/types';
import { validatePlan } from '../../v2/plan-validator';
import { runExecutionPlan } from '../../v2/execution-engine';

const TEST_COLUMNS: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'salary', title: '工资', type: 'number' },
  { key: 'city', title: '城市', type: 'text' },
  { key: 'date', title: '日期', type: 'date' },
];

const TEST_ROWS: RowData[] = [
  { name: '张三', dept: '技术部', salary: 10000, city: '杭州', date: '2024-01-01' },
  { name: '李四', dept: '销售部', salary: 20000, city: '上海', date: '2024-02-01' },
  { name: '王五', dept: '技术部', salary: 15000, city: '北京', date: '2024-03-01' },
  { name: '赵六', dept: '销售部', salary: 8000, city: '杭州', date: '2024-04-01' },
];

const profile = buildDataProfile(TEST_COLUMNS, TEST_ROWS);
const columnIndex = buildColumnValueIndex(TEST_COLUMNS, TEST_ROWS);

describe('Repair -> Validate -> Execution full chain', () => {
  it('should repair fuzzy column name then execute successfully', () => {
    const originalPlan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }],
    };

    const repairResult = repairPlan(originalPlan, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });
    expect(repairResult.autoFixApplied).toBe(true);

    const validation = validatePlan(repairResult.plan, TEST_COLUMNS, profile);
    expect(validation.valid).toBe(true);

    const execResult = runExecutionPlan(repairResult.plan, { columns: TEST_COLUMNS, rows: TEST_ROWS });
    expect(execResult.success).toBe(true);
    expect(execResult.data?.rows.length).toBe(2);
  });

  it('should repair type conversion then execute successfully', () => {
    const originalPlan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: '100元' }],
    };

    const repairResult = repairPlan(originalPlan, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });
    expect(repairResult.autoFixApplied).toBe(true);
    const cond = (repairResult.plan as FilterPlan).conditions[0];
    expect(typeof cond.value).toBe('number');
    expect(cond.value).toBe(100);

    const validation = validatePlan(repairResult.plan, TEST_COLUMNS, profile);
    expect(validation.valid).toBe(true);

    const execResult = runExecutionPlan(repairResult.plan, { columns: TEST_COLUMNS, rows: TEST_ROWS });
    expect(execResult.success).toBe(true);
  });

  it('should not modify a plan that needs no repair', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'city', operator: Operator.EQ, value: '杭州' }],
    };

    const repairResult = repairPlan(plan, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });
    expect(repairResult.autoFixApplied).toBe(false);
    expect(repairResult.report.repairs.length).toBe(0);

    const validation = validatePlan(repairResult.plan, TEST_COLUMNS, profile);
    expect(validation.valid).toBe(true);

    const execResult = runExecutionPlan(repairResult.plan, { columns: TEST_COLUMNS, rows: TEST_ROWS });
    expect(execResult.success).toBe(true);
  });

  it('should handle the value-to-column inference scenario', () => {
    // "杭州" is a value in city column, not a column name
    const originalPlan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '杭州', operator: Operator.EQ, value: 'dummy' }],
    };

    const repairResult = repairPlan(originalPlan, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });

    const cond = (repairResult.plan as FilterPlan).conditions[0];
    expect(cond.columnKey).toBe('city');
    expect(cond.value).toBe('杭州');

    const execResult = runExecutionPlan(repairResult.plan, { columns: TEST_COLUMNS, rows: TEST_ROWS });
    expect(execResult.success).toBe(true);
    expect(execResult.data?.rows.length).toBe(2);
  });
});

describe('EngineRunResult extension fields', () => {
  it('should include report and plan', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }],
    };

    const repairResult = repairPlan(plan, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });

    expect(repairResult.plan).toBeDefined();
    expect(repairResult.report).toBeDefined();
    expect(typeof repairResult.autoFixApplied).toBe('boolean');
    expect(repairResult.report.repairs).toBeInstanceOf(Array);
    expect(repairResult.report.summary.length).toBeGreaterThan(0);
    expect(repairResult.plan.type).toBe('filter');
  });
});

describe('Pipeline recursive repair', () => {
  it('should repair columns in pipeline sub-steps', () => {
    const pipeline: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        { type: 'filter', conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }] },
        { type: 'sort', sorts: [{ columnKey: '工资', order: 'DESC' as const }] },
      ],
    };

    const repairResult = repairPlan(pipeline, {
      columns: TEST_COLUMNS, rows: TEST_ROWS, profile, columnIndex,
    });

    expect(repairResult.autoFixApplied).toBe(true);

    const pr = repairResult.plan as any;
    expect(pr.steps[0].conditions[0].columnKey).toBe('city');
    // "工资" matches salary by exact title - stays as-is (V2 validatePlan does title->key)
    expect(pr.steps[1].sorts[0].columnKey).toBe('工资');
  });
});
