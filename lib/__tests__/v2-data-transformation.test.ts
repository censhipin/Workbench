import { describe, it, expect } from 'vitest';
import { runExecutionPlan, registry } from '@/lib/v2/execution-engine';
import { Operator } from '@/lib/v2/types';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';

const salaryColumns: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'basePay', title: '基本工资', type: 'number' },
  { key: 'status', title: '状态', type: 'text' },
];

const salaryRows: RowData[] = [
  { name: '张三', dept: '技术部', bonus: 8000, basePay: 15000, status: '已完成' },
  { name: '李四', dept: '市场部', bonus: 3000, basePay: 12000, status: null },
  { name: '王五', dept: '技术部', bonus: 6000, basePay: 13000, status: '进行中' },
  { name: '赵六', dept: '市场部', bonus: 2000, basePay: 11000, status: null },
  { name: '陈七', dept: '技术部', bonus: 12000, basePay: 18000, status: null },
];

const mainSheet = { columns: salaryColumns, rows: salaryRows };

// ========== UpdateExecutor Tests ==========

describe('UpdateExecutor — 批量更新', () => {
  it('无条件批量修改：修改所有行的地区列', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'dept',
      value: '成都',
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
    for (const row of result.data!.rows) {
      expect(row.dept).toBe('成都');
    }
    expect(result.summary?.modifiedCount).toBe(5);
  });

  it('条件更新 WHERE：状态为空的行改为"未完成"', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'status',
      value: '未完成',
      conditions: [{ columnKey: 'status', operator: Operator.IS_NULL, value: null }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    const pendingRows = result.data!.rows.filter((r: any) => r.status === '未完成');
    expect(pendingRows).toHaveLength(3);
    expect(result.data!.rows[0].status).toBe('已完成'); // 不满足条件的保持不变
    expect(result.summary?.modifiedCount).toBe(3);
  });

  it('条件更新不满足条件的行保持不变', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'bonus',
      value: 9999,
      conditions: [{ columnKey: 'name', operator: Operator.EQ, value: '王五' }],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows[2].bonus).toBe(9999); // 王五被修改
    expect(result.data!.rows[0].bonus).toBe(8000); // 张三不变
    expect(result.data!.rows[1].bonus).toBe(3000); // 李四不变
  });

  it('数字值更新', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'basePay',
      value: 20000,
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    for (const row of result.data!.rows) {
      expect(row.basePay).toBe(20000);
    }
  });

  it('不改变行数', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'dept',
      value: '测试部',
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
  });
});

// ========== FormulaExecutor Tests ==========

describe('FormulaExecutor — 公式计算', () => {
  it('乘法：新增金额列 = 数量 × 单价', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '产品', type: 'text' },
        { key: 'qty', title: '数量', type: 'number' },
        { key: 'price', title: '单价', type: 'number' },
      ],
      rows: [
        { name: '产品A', qty: 10, price: 50 },
        { name: '产品B', qty: 5, price: 100 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'amount',
      sourceColumns: ['qty', 'price'],
      expressionType: '*',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].amount).toBe(500);
    expect(result.data!.rows[1].amount).toBe(500);
    // 新列应在列定义中
    expect(result.data!.columns.find((c: any) => c.key === 'amount')).toBeDefined();
  });

  it('减法：利润 = 销售额 - 成本', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '产品', type: 'text' },
        { key: 'revenue', title: '销售额', type: 'number' },
        { key: 'cost', title: '成本', type: 'number' },
      ],
      rows: [
        { name: '产品A', revenue: 1000, cost: 600 },
        { name: '产品B', revenue: 2000, cost: 1500 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'profit',
      sourceColumns: ['revenue', 'cost'],
      expressionType: '-',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].profit).toBe(400);
    expect(result.data!.rows[1].profit).toBe(500);
  });

  it('ROUND：单价保留两位小数', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '产品', type: 'text' },
        { key: 'price', title: '单价', type: 'number' },
      ],
      rows: [
        { name: '产品A', price: 3.14159 },
        { name: '产品B', price: 2.71828 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'price_round',
      sourceColumns: ['price'],
      expressionType: 'ROUND',
      decimalPlaces: 2,
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].price_round).toBe(3.14);
    expect(result.data!.rows[1].price_round).toBe(2.72);
  });

  it('ABS：绝对值', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '产品', type: 'text' },
        { key: 'diff', title: '差异', type: 'number' },
      ],
      rows: [
        { name: 'A', diff: -10 },
        { name: 'B', diff: 20 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'abs_diff',
      sourceColumns: ['diff'],
      expressionType: 'ABS',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].abs_diff).toBe(10);
    expect(result.data!.rows[1].abs_diff).toBe(20);
  });

  it('除法', () => {
    const sheet = {
      columns: [
        { key: 'total', title: '总额', type: 'number' },
        { key: 'count', title: '数量', type: 'number' },
      ],
      rows: [
        { total: 100, count: 4 },
        { total: 60, count: 3 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'avg_price',
      sourceColumns: ['total', 'count'],
      expressionType: '/',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].avg_price).toBe(25);
    expect(result.data!.rows[1].avg_price).toBe(20);
  });

  it('除法零保护', () => {
    const sheet = {
      columns: [
        { key: 'a', title: 'A', type: 'number' },
        { key: 'b', title: 'B', type: 'number' },
      ],
      rows: [
        { a: 10, b: 0 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'result',
      sourceColumns: ['a', 'b'],
      expressionType: '/',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].result).toBe(Infinity);
  });

  it('SUM 多列求和', () => {
    const sheet = {
      columns: [
        { key: 'a', title: 'A', type: 'number' },
        { key: 'b', title: 'B', type: 'number' },
        { key: 'c', title: 'C', type: 'number' },
      ],
      rows: [
        { a: 10, b: 20, c: 30 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'total',
      sourceColumns: ['a', 'b', 'c'],
      expressionType: 'SUM',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].total).toBe(60);
  });

  it('AVG 多列求平均', () => {
    const sheet = {
      columns: [
        { key: 'a', title: 'A', type: 'number' },
        { key: 'b', title: 'B', type: 'number' },
      ],
      rows: [
        { a: 10, b: 20 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'avg_val',
      sourceColumns: ['a', 'b'],
      expressionType: 'AVG',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].avg_val).toBe(15);
  });

  it('更新已有列', () => {
    const sheet = {
      columns: [
        { key: 'a', title: 'A', type: 'number' },
        { key: 'b', title: 'B', type: 'number' },
      ],
      rows: [
        { a: 5, b: 3 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'a',
      sourceColumns: ['a', 'b'],
      expressionType: '*',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].a).toBe(15); // 5 * 3
  });
});

// ========== PipelineExecutor Tests ==========

describe('PipelineExecutor — 管道多步执行', () => {
  it('两步管道：筛选 + 排序', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        {
          type: 'filter',
          conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
        },
        {
          type: 'sort',
          sorts: [{ columnKey: 'bonus', order: 'DESC' as any }],
        },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    // 技术部：张三(8000)、王五(6000)、陈七(12000) → 按 bonus 降序：陈七→张三→王五
    expect(result.data!.rows).toHaveLength(3);
    expect(result.data!.rows[0].name).toBe('陈七');
    expect(result.data!.rows[1].name).toBe('张三');
    expect(result.data!.rows[2].name).toBe('王五');
  });

  it('三步管道：筛选 + 排序 + 投影', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        {
          type: 'filter',
          conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
        },
        {
          type: 'sort',
          sorts: [{ columnKey: 'basePay', order: 'DESC' as any }],
        },
        {
          type: 'projection',
          includeColumns: ['name', 'basePay'],
        },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
    expect(result.data!.columns.map((c: any) => c.key)).toEqual(['name', 'basePay']);
    expect(result.data!.rows[0].name).toBe('陈七'); // 18000 最高
    expect(result.data!.rows[1].name).toBe('张三'); // 15000
    expect(result.data!.rows[2].name).toBe('王五'); // 13000
  });

  it('三步管道：筛选 + 更新 + 公式计算', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        {
          type: 'filter',
          conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
        },
        {
          type: 'update',
          column: 'status',
          value: '处理中',
        },
        {
          type: 'formula',
          targetColumn: 'total',
          sourceColumns: ['bonus', 'basePay'],
          expressionType: 'SUM',
        },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);

    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
    // 所有状态被更新
    for (const row of result.data!.rows) {
      expect(row.status).toBe('处理中');
    }
    // 新增 total 列 = bonus + basePay
    expect(result.data!.rows[0].total).toBe(8000 + 15000);
    expect(result.data!.rows[1].total).toBe(6000 + 13000);
    expect(result.data!.rows[2].total).toBe(12000 + 18000);
    // 新增列在列定义中
    expect(result.data!.columns.find((c: any) => c.key === 'total')).toBeDefined();
  });

  it('空管道第一步返回原数据', () => {
    // 虽然在接口层不该出现空steps，但防御处理
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [],
    };

    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
  });
});

// ========== Error handling ==========

describe('ExecutorRegistry — 新执行器已注册', () => {
  it('FormulaExecutor: LEFT 文本函数', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '姓名', type: 'text' },
      ],
      rows: [
        { name: '产品A' },
        { name: null },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'first_char',
      sourceColumns: ['name'],
      expressionType: 'LEFT',
      charCount: 2,
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].first_char).toBe('产品');
    expect(result.data!.rows[1].first_char).toBe(''); // null → 空字符串
  });

  it('FormulaExecutor: RIGHT 文本函数', () => {
    const sheet = {
      columns: [
        { key: 'code', title: '编号', type: 'text' },
      ],
      rows: [
        { code: 'ABC-001' },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'last3',
      sourceColumns: ['code'],
      expressionType: 'RIGHT',
      charCount: 3,
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].last3).toBe('001');
  });

  it('FormulaExecutor: MID 文本函数', () => {
    const sheet = {
      columns: [
        { key: 'phone', title: '手机号', type: 'text' },
      ],
      rows: [
        { phone: '13800138000' },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'middle4',
      sourceColumns: ['phone'],
      expressionType: 'MID',
      startPos: 3,
      charCount: 4,
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].middle4).toBe('8001');
  });

  it('FormulaExecutor: LEN 文本函数', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '姓名', type: 'text' },
      ],
      rows: [
        { name: '张三丰' },
        { name: '' },
        { name: null },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'len',
      sourceColumns: ['name'],
      expressionType: 'LEN',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].len).toBe(3);
    expect(result.data!.rows[1].len).toBe(0); // '' → 0
    expect(result.data!.rows[2].len).toBe(0); // null → 0
  });

  it('FormulaExecutor: TODAY 返回日期字符串', () => {
    const sheet = {
      columns: [{ key: 'dummy', title: '占位', type: 'text' }],
      rows: [{ dummy: 'x' }],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'today',
      sourceColumns: [],
      expressionType: 'TODAY',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('FormulaExecutor: YEAR/MONTH/DAY 日期函数', () => {
    const sheet = {
      columns: [{ key: 'dt', title: '日期', type: 'date' }],
      rows: [{ dt: '2026-07-01' }],
    };

    const yearPlan: ExecutionPlan = { type: 'formula', targetColumn: 'y', sourceColumns: ['dt'], expressionType: 'YEAR' };
    const yearResult = runExecutionPlan(yearPlan, sheet);
    expect(yearResult.success).toBe(true);
    expect(yearResult.data!.rows[0].y).toBe(2026);

    const monthPlan: ExecutionPlan = { type: 'formula', targetColumn: 'm', sourceColumns: ['dt'], expressionType: 'MONTH' };
    const monthResult = runExecutionPlan(monthPlan, sheet);
    expect(monthResult.success).toBe(true);
    expect(monthResult.data!.rows[0].m).toBe(7);

    const dayPlan: ExecutionPlan = { type: 'formula', targetColumn: 'd', sourceColumns: ['dt'], expressionType: 'DAY' };
    const dayResult = runExecutionPlan(dayPlan, sheet);
    expect(dayResult.success).toBe(true);
    expect(dayResult.data!.rows[0].d).toBe(1);
  });

  it('FormulaExecutor: DATEDIF 返回年数', () => {
    const sheet = {
      columns: [{ key: 'hired', title: '入职日期', type: 'date' }, { key: 'today', title: '今天', type: 'date' }],
      rows: [{ hired: '2020-01-01', today: '2026-07-01' }],
    };

    const plan: ExecutionPlan = { type: 'formula', targetColumn: 'years', sourceColumns: ['hired', 'today'], expressionType: 'DATEDIF' };
    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].years).toBe(6); // 2020→2026 = 6年
  });

  it('FormulaExecutor: SUMIF 条件求和', () => {
    const sheet = {
      columns: [
        { key: 'name', title: '姓名', type: 'text' },
        { key: 'dept', title: '部门', type: 'text' },
        { key: 'salary', title: '工资', type: 'number' },
      ],
      rows: [
        { name: '张三', dept: '技术部', salary: 10000 },
        { name: '李四', dept: '市场部', salary: 8000 },
        { name: '王五', dept: '技术部', salary: 12000 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'tech_sum',
      sourceColumns: ['salary'],
      expressionType: 'SUMIF',
      conditionColumn: 'dept',
      conditionOperator: '=',
      conditionValue: '技术部',
    };
    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].tech_sum).toBe(22000); // 10000+12000
  });

  it('FormulaExecutor: COUNTIF 条件计数', () => {
    const sheet = {
      columns: [{ key: 'dept', title: '部门', type: 'text' }, { key: 'bonus', title: '绩效奖金', type: 'number' }],
      rows: [
        { dept: '技术部', bonus: 8000 },
        { dept: '市场部', bonus: 3000 },
        { dept: '技术部', bonus: 6000 },
      ],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'count',
      sourceColumns: ['bonus'],
      expressionType: 'COUNTIF',
      conditionColumn: 'bonus',
      conditionOperator: '>',
      conditionValue: 5000,
    };
    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].count).toBe(2); // 8000 and 6000 > 5000
  });

  it('FormulaExecutor: 不存在的列返回常量', () => {
    const sheet = {
      columns: [{ key: 'a', title: 'A', type: 'number' }],
      rows: [{ a: 5 }],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'result',
      sourceColumns: ['nonexistent', 'another'],
      expressionType: '+',
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    // 不存在的列值视为 0
    expect(result.data!.rows[0].result).toBe(0);
  });

  it('FormulaExecutor: 常量操作数 — 金额×0.9', () => {
    const sheet = {
      columns: [{ key: 'amount', title: '金额', type: 'number' }],
      rows: [{ amount: 100 }, { amount: 200 }],
    };

    const plan: ExecutionPlan = {
      type: 'formula',
      targetColumn: 'discounted',
      sourceColumns: ['amount'],
      expressionType: '*',
      constantOperand: 0.9,
    };

    const result = runExecutionPlan(plan, sheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows[0].discounted).toBe(90);
    expect(result.data!.rows[1].discounted).toBe(180);
  });

  it('UpdateExecutor: 不存在的列名不报错且不修改', () => {
    const plan: ExecutionPlan = {
      type: 'update',
      column: 'nonexistent_col',
      value: 'test',
    };

    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(5);
    // 每行都没有新增列
    for (const row of result.data!.rows) {
      expect(row.nonexistent_col).toBeUndefined();
    }
  });

  it('Pipeline: 子步骤 output limit 生效', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        {
          type: 'sort',
          sorts: [{ columnKey: 'bonus', order: 'DESC' as any }],
          output: { limit: 2 },
        },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(2); // limit 2
    expect(result.data!.rows[0].name).toBe('陈七'); // bonus=12000 最高
    expect(result.data!.rows[1].name).toBe('张三'); // bonus=8000
  });

  it('Pipeline: 子步骤 output includeColumns 生效', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        {
          type: 'filter',
          conditions: [{ columnKey: 'dept', operator: Operator.EQ, value: '技术部' }],
          output: { includeColumns: ['name', 'bonus'] },
        },
      ],
    };

    const result = runExecutionPlan(plan, mainSheet);
    expect(result.success).toBe(true);
    expect(result.data!.rows).toHaveLength(3);
    expect(result.data!.columns.map((c: any) => c.key)).toEqual(['name', 'bonus']);
  });

  it('UpdateExecutor 已注册', () => {
    expect(registry.has('update')).toBe(true);
  });

  it('FormulaExecutor 已注册', () => {
    expect(registry.has('formula')).toBe(true);
  });

  it('PipelineExecutor 已注册', () => {
    expect(registry.has('pipeline')).toBe(true);
  });
});
