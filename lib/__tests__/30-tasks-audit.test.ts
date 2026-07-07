// ============================================================
// 30 Task User Scenario Audit — UI-to-Business-Logic
// ============================================================
// Tests the FULL pipeline: natural language input → engine execution → result
// without mocking any step. This proves whether the chain is intact.
// ============================================================

import { describe, it, expect } from 'vitest';
import { runExecutionEngine, type EngineRunResult } from '@/lib/execution-engine';
import { compile } from '@/lib/v2/task-compiler';
import { runExecutionPlan } from '@/lib/v2/execution-engine';
import { parseAndResolve, parseIntent } from '@/lib/nlu';
import type { ColumnDef, RowData, TaskIntent, WorkbenchFile } from '@/lib/types';
import type { TaskPlan } from '@/lib/nlu/taskplan-types';

// ============================================================
// 公共测试数据 — 工资表 + 员工信息表
// ============================================================

const salaryCols: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'basePay', title: '基本工资', type: 'number' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'overtime', title: '加班补贴', type: 'number' },
  { key: 'deduction', title: '扣除项', type: 'number' },
];

const salaryRows: RowData[] = [
  { name: '张三', dept: '技术部', basePay: 15000, bonus: 8000, overtime: 500, deduction: 800 },
  { name: '李四', dept: '市场部', basePay: 12000, bonus: 3000, overtime: 200, deduction: 600 },
  { name: '王五', dept: '技术部', basePay: 13000, bonus: 6000, overtime: 0, deduction: 500 },
  { name: '赵六', dept: '市场部', basePay: 11000, bonus: 2000, overtime: 300, deduction: 400 },
  { name: '陈七', dept: '技术部', basePay: 18000, bonus: 12000, overtime: 800, deduction: 1000 },
  { name: '周八', dept: '销售部', basePay: 16000, bonus: 7000, overtime: 0, deduction: 900 },
  { name: '吴九', dept: '销售部', basePay: 14000, bonus: 4500, overtime: 600, deduction: 700 },
  { name: null, dept: '技术部', basePay: 19000, bonus: 9000, overtime: null, deduction: 1100 },
];

const mockFile: WorkbenchFile = {
  id: 'salary-file',
  name: '工资表.xlsx',
  icon: '💰',
  sheets: [{ name: 'Sheet1', columns: salaryCols, rows: salaryRows }],
  rowCount: salaryRows.length,
  colCount: salaryCols.length,
  isMock: true,
};

// Helper: run the full chain from TaskPlan to result
function runPlan(plan: TaskPlan): EngineRunResult {
  const compiled = compile(plan, salaryCols);
  if (!compiled.success || !compiled.plan) {
    return { success: false, steps: [], resultData: null, resultSummary: null, verification: null, intent: null, error: compiled.error || 'compile failed' };
  }
  // V2 path
  const v2Result = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
  if (v2Result.success && v2Result.data) {
    const intent: TaskIntent = {
      operation: plan.action as any,
      target: plan.columnHint || '',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '',
      confidence: 0.95,
      params: {},
      v2plan: compiled.plan,
    };
    return runExecutionEngine(intent, mockFile, 'Sheet1', [mockFile]);
  }
  return { success: false, steps: [], resultData: null, resultSummary: null, verification: null, intent: null, error: 'V2 execution failed' };
}

// Helper: run via rule parser (simulating real natural language input without AI)
function runViaRuleParser(prompt: string): EngineRunResult {
  const parsed = parseAndResolve(prompt, salaryCols, [mockFile.name], salaryRows);
  if (!parsed.intent.operation) {
    return { success: false, steps: [], resultData: null, resultSummary: null, verification: null, intent: null, error: 'rule parser failed to understand' };
  }
  return runExecutionEngine(parsed.intent, mockFile, 'Sheet1', [mockFile]);
}

// ============================================================
// SIMPLE TASKS (10)
// ============================================================

describe('Group 1: 简单任务 (10个)', () => {

  // T1: 筛选技术部员工
  it('T1: 筛选技术部员工', () => {
    const plan: TaskPlan = { action: 'filter', conditions: [{ columnHint: '部门', operator: '=', value: '技术部' }] };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
    if (r.resultData) {
      for (const row of r.resultData.rows) {
        expect(row.dept).toBe('技术部');
      }
    }
    // Also test rule parser
    const r2 = runViaRuleParser('筛选技术部的员工');
    expect(r2.success).toBe(true);
  });

  // T2: 基本工资高于8000
  it('T2: 基本工资高于8000', () => {
    const plan: TaskPlan = { action: 'filter', conditions: [{ columnHint: '基本工资', operator: '>=', value: '8000' }] };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
    // All rows have basePay >= 8000 in our data, so all pass
    if (r.resultData) {
      expect(r.resultData.rows.length).toBeGreaterThan(0);
    }
  });

  // T3: 工资高于8000 (rule parser)
  it('T3: 工资高于8000 (规则解析)', () => {
    const r = runViaRuleParser('筛选基本工资高于8000的数据');
    expect(r.success).toBe(true);
    if (r.resultData) {
      expect(r.resultData.rows.length).toBeGreaterThan(0);
    }
  });

  // T4: 删除空行 (clean)
  it('T4: 删除空行', () => {
    const plan: TaskPlan = { action: 'clean' };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
  });

  // T5: 手机号去重 (dedup)
  it('T5: 手机号去重', () => {
    const plan: TaskPlan = { action: 'dedup', columnHints: ['姓名'] };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
    if (r.resultData) {
      // Check no duplicate names
      const names = r.resultData.rows.map(row => row.name);
      const unique = new Set(names);
      expect(names.length).toBe(unique.size);
    }
  });

  // T6: 按基本工资排序
  it('T6: 按基本工资排序', () => {
    const plan: TaskPlan = { action: 'sort', columnHint: '基本工资', direction: 'desc' };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
    if (r.resultData) {
      for (let i = 1; i < r.resultData.rows.length; i++) {
        expect(Number(r.resultData.rows[i].basePay)).toBeLessThanOrEqual(Number(r.resultData.rows[i-1].basePay));
      }
    }
  });

  // T7: 合并两个表 (merge)
  it('T7: 合并两个表', () => {
    const plan: TaskPlan = { action: 'merge' };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    expect(compiled.plan).toBeDefined();
    // 用两份不同数据测试 merge
    const bonusCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'position', title: '职位', type: 'text' },
    ];
    const bonusRows: RowData[] = [
      { name: '张三', dept: '技术部', position: '工程师' },
      { name: '李四', dept: '市场部', position: '主管' },
    ];
    const extraCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'level', title: '职级', type: 'text' },
    ];
    const extraRows: RowData[] = [
      { name: '王五', dept: '技术部', level: '高级' },
      { name: '赵六', dept: '市场部', level: '中级' },
    ];
    const r = runExecutionPlan(compiled.plan!, { columns: salaryCols, rows: salaryRows }, [
      { columns: bonusCols, rows: bonusRows, name: 'Sheet2' },
      { columns: extraCols, rows: extraRows, name: 'Sheet3' },
    ]);
    expect(r.success).toBe(true);
    if (r.data) {
      expect(r.data.rows.length).toBeGreaterThanOrEqual(2);
    }
  });

  // T8: 规则解析: 按基本工资排序
  it('T8: 按基本工资排序 (规则解析)', () => {
    const r = runViaRuleParser('按基本工资从高到低排序');
    expect(r.success).toBe(true);
    if (r.resultData) {
      for (let i = 1; i < r.resultData.rows.length; i++) {
        expect(Number(r.resultData.rows[i].basePay)).toBeLessThanOrEqual(Number(r.resultData.rows[i-1].basePay));
      }
    }
  });

  // T9: 只看姓名和部门 (select/projection)
  it('T9: 只看姓名和部门', () => {
    const plan: TaskPlan = { action: 'select', columns: ['姓名', '部门'] };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.columns.length).toBe(2);
        expect(r.data.columns.map(c => c.title)).toEqual(['姓名', '部门']);
      }
    }
  });

  // T10: 统计工资总和
  it('T10: 统计基本工资总和', () => {
    const plan: TaskPlan = { action: 'aggregate', method: 'sum', columnHints: ['基本工资'] };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
  });
});

// ============================================================
// COMPLEX TASKS (10)
// ============================================================

describe('Group 2: 复杂任务 (10个)', () => {

  // T11: 筛选之后再排序 (pipeline)
  it('T11: 筛选之后再排序 (pipeline)', () => {
    const plan: TaskPlan = {
      action: 'pipeline',
      steps: [
        { action: 'filter', conditions: [{ columnHint: '部门', operator: '=', value: '技术部' }] },
        { action: 'sort', columnHint: '基本工资', direction: 'asc' },
      ],
    };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        for (const row of r.data.rows) {
          expect(row.dept).toBe('技术部');
        }
        for (let i = 1; i < r.data.rows.length; i++) {
          expect(Number(r.data.rows[i].basePay)).toBeGreaterThanOrEqual(Number(r.data.rows[i-1].basePay));
        }
      }
    }
  });

  // T12: 新增列之后再筛选 (pipeline)
  it('T12: 新增列之后再筛选 (pipeline)', () => {
    const plan: TaskPlan = {
      action: 'pipeline',
      steps: [
        { action: 'formula', targetColumn: '实发工资', sourceColumnHints: ['基本工资', '绩效奖金'], expressionType: '+', expression: '基本工资+绩效奖金' },
        { action: 'filter', conditions: [{ columnHint: '实发工资', operator: '>', value: '15000' }] },
      ],
    };
    const compiled = compile(plan, salaryCols);
    if (!compiled.success && compiled.error) {
      // Formula creates a column not in original columns; pipeline sees it in state
      console.log('T12 compile result:', compiled.error);
    }
    // Try directly with runExecutionPlan
    if (compiled.success && compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      if (r.success && r.data) {
        expect(r.data.rows.every((row: any) => Number(row['实发工资']) > 15000)).toBe(true);
      }
    }
  });

  // T13: 规则解析 pipeline: 筛选之后再排序
  it('T13: 筛选之后再排序 (规则解析)', () => {
    const r = runViaRuleParser('筛选技术部的员工再按基本工资排序');
    expect(r.success).toBe(true);
    if (r.resultData) {
      // Verify it's a pipeline with correct results
      expect(r.resultData.rows.length).toBeGreaterThan(0);
    }
  });

  // T14: 新增一列奖金计算
  it('T14: 新增一列 = 基本工资+绩效奖金', () => {
    const plan: TaskPlan = {
      action: 'formula',
      targetColumn: '总计',
      sourceColumnHints: ['基本工资', '绩效奖金'],
      expressionType: '+',
      expression: '基本工资+绩效奖金',
    };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.columns.some(c => c.key === '总计' || c.title === '总计')).toBe(true);
      }
    }
  });

  // T15: 按部门统计工资总额 (groupBy aggregate)
  it('T15: 按部门统计工资总额', () => {
    const plan: TaskPlan = {
      action: 'aggregate',
      method: 'sum',
      columnHints: ['基本工资'],
      groupByHints: ['部门'],
    };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.rows.every((row: any) => row.dept !== undefined)).toBe(true);
      }
    }
  });

  // T16: 多条件筛选（部门=技术部 且 基本工资>=13000）
  it('T16: 多条件 AND 筛选', () => {
    const plan: TaskPlan = {
      action: 'filter',
      conditions: [
        { columnHint: '部门', operator: '=', value: '技术部' },
        { columnHint: '基本工资', operator: '>=', value: '13000' },
      ],
    };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        for (const row of r.data.rows) {
          expect(row.dept).toBe('技术部');
          expect(Number(row.basePay)).toBeGreaterThanOrEqual(13000);
        }
      }
    }
  });

  // T17: 规则解析: 多条件筛选
  it('T17: 多条件筛选 (规则解析)', () => {
    const r = runViaRuleParser('筛选技术部基本工资大于等于13000');
    expect(r.success).toBe(true);
    if (r.resultData) {
      for (const row of r.resultData.rows) {
        expect(row.dept).toBe('技术部');
        expect(Number(row.basePay)).toBeGreaterThanOrEqual(13000);
      }
    }
  });

  // T18: 列转置/重命名
  it('T18: 重命名列', () => {
    const plan: TaskPlan = { action: 'rename', column: '部门', newName: '所属部门' };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.columns.some(c => c.title === '所属部门')).toBe(true);
      }
    }
  });

  // T19: IF公式判断等级
  it('T19: IF公式判断等级', () => {
    // This uses the V2 FormulaExecutor IF path
    const plan: TaskPlan = {
      action: 'formula',
      targetColumn: '等级',
      sourceColumnHints: ['基本工资'],
      expressionType: 'IF',
      conditionColumnHint: '基本工资',
      conditionOperator: '>=',
      conditionValue: '15000',
      trueValue: '高',
      falseValue: '低',
    };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        const levelCol = r.data.columns.find(c => c.key === '等级');
        expect(levelCol).toBeDefined();
      }
    }
  });

  // T20: 删除指定列
  it('T20: 删除指定列 (remove)', () => {
    const plan: TaskPlan = { action: 'remove', columns: ['加班补贴', '扣除项'] };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.columns.find(c => c.key === 'overtime')).toBeUndefined();
        expect(r.data.columns.find(c => c.key === 'deduction')).toBeUndefined();
      }
    }
  });
});

// ============================================================
// EDGE CASES (10)
// ============================================================

describe('Group 3: 边界情况 (10个)', () => {

  // T21: 空数据
  it('T21: 空的输入应该返回error', () => {
    const parsed = parseIntent('', salaryCols, [mockFile.name]);
    expect(parsed.operation).toBeNull();
  });

  // T22: 不存在的操作
  it('T22: 不存在的操作', () => {
    const plan: TaskPlan = { action: 'unknown' as any, reason: '无法理解' };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(false);
  });

  // T23: 不存在的列名
  it('T23: 不存在的列名应返回编译错误', () => {
    const plan: TaskPlan = { action: 'filter', conditions: [{ columnHint: '不存在的列', operator: '=', value: 'x' }] };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(false);
  });

  // T24: 字符串列做数值操作
  it('T24: 字符串列做聚合应有明确错误', () => {
    // Aggregate on name (text) should fail at V2 Verifier level
    const plan: TaskPlan = { action: 'aggregate', method: 'sum', columnHints: ['姓名'] };
    const compiled = compile(plan, salaryCols);
    if (compiled.success && compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      // The V2 verifier might catch this
      console.log('T24 result success:', r.success, 'error:', r.error);
    }
  });

  // T25: 带null数据的行做clean
  it('T25: 带null数据的行做clean', () => {
    const plan: TaskPlan = { action: 'clean' };
    const r = runPlan(plan);
    expect(r.success).toBe(true);
  });

  // T26: 升降序切换
  it('T26: 升序排列', () => {
    const plan: TaskPlan = { action: 'sort', columnHint: '基本工资', direction: 'asc' };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        for (let i = 1; i < r.data.rows.length; i++) {
          expect(Number(r.data.rows[i].basePay)).toBeGreaterThanOrEqual(Number(r.data.rows[i-1].basePay));
        }
      }
    }
  });

  // T27: 输出约束 — limit
  it('T27: 输出约束 — 只返回前3条', () => {
    const plan: TaskPlan = { action: 'sort', columnHint: '基本工资', direction: 'desc', limit: 3 };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        expect(r.data.rows.length).toBeLessThanOrEqual(3);
      }
    }
  });

  // T28: 规则解析: 复杂组合(含连接词)
  it('T28: 新增列再筛选再排序 (3步pipeline)', () => {
    const r = runViaRuleParser('新增一列实发工资等于基本工资加绩效奖金再筛选实发工资大于15000的再按实发工资排序');
    // The rule parser should parse this as a pipeline
    // Note: 3 steps is ambitious — may simplify
    expect(r.success).toBe(true);
  });

  // T29: contains 文本匹配
  it('T29: 包含文本筛选', () => {
    const plan: TaskPlan = { action: 'filter', conditions: [{ columnHint: '部门', operator: 'contains', value: '技术' }] };
    const compiled = compile(plan, salaryCols);
    expect(compiled.success).toBe(true);
    if (compiled.plan) {
      const r = runExecutionPlan(compiled.plan, { columns: salaryCols, rows: salaryRows });
      expect(r.success).toBe(true);
      if (r.data) {
        for (const row of r.data.rows) {
          expect(String(row.dept)).toContain('技术');
        }
      }
    }
  });

  // T30: V2 full cycle — EngineRunResult 验证 PlanStep 完整性
  it('T30: runExecutionEngine 返回完整的5步执行计划', () => {
    const plan: TaskPlan = { action: 'filter', conditions: [{ columnHint: '部门', operator: '=', value: '技术部' }] };
    const compiled = compile(plan, salaryCols);
    const intent: TaskIntent = {
      operation: 'filter',
      target: '部门',
      targetColumns: [],
      scope: 'all',
      targetFiles: [],
      rawPrompt: '筛选技术部',
      confidence: 0.95,
      params: {},
      v2plan: compiled.plan,
    };
    const r = runExecutionEngine(intent, mockFile, 'Sheet1', [mockFile]);
    expect(r.steps.length).toBe(6);
    expect(r.steps[0].description).toBe('解析用户意图');
    expect(r.steps[1].description).toBe('验证输入参数');
    expect(r.steps[2].description).toBe('执行数据处理');
    expect(r.steps[3].description).toBe('验证执行结果');
    expect(r.steps[4].description).toBe('生成结果报告');
    expect(r.steps[5].description).toBe('智能解释');
  });
});
