import { describe, it, expect } from 'vitest';
import { ExecutorRegistry } from '@/lib/v2/executors/registry';
import { FilterExecutor } from '@/lib/v2/executors/FilterExecutor';
import { SortExecutor } from '@/lib/v2/executors/SortExecutor';
import { AggregateExecutor } from '@/lib/v2/executors/AggregateExecutor';
import { DedupExecutor } from '@/lib/v2/executors/DedupExecutor';
import { MatchExecutor } from '@/lib/v2/executors/MatchExecutor';
import { MergeExecutor } from '@/lib/v2/executors/MergeExecutor';
import { CleanExecutor } from '@/lib/v2/executors/CleanExecutor';
import { Operator } from '@/lib/v2/types';
import { SortOrder, AggMethod } from '@/lib/v2/execution-plan';
import type { ExecutionPlan } from '@/lib/v2/execution-plan';
import type { ColumnDef, RowData } from '@/lib/types';
import type { ExecutionContext } from '@/lib/v2/executors/types';

describe('ExecutorRegistry', () => {
  it('register + get + has 正常', () => {
    const r = new ExecutorRegistry();
    expect(r.has('filter')).toBe(false);

    r.register(new FilterExecutor());

    expect(r.has('filter')).toBe(true);
    expect(r.get('filter')).toBeInstanceOf(FilterExecutor);
    expect(r.get('unknown')).toBeUndefined();
  });

  it('registerAll 批量注册', () => {
    const r = new ExecutorRegistry();
    r.registerAll(
      new FilterExecutor(),
      new SortExecutor(),
      new CleanExecutor(),
    );

    expect(r.has('filter')).toBe(true);
    expect(r.has('sort')).toBe(true);
    expect(r.has('clean')).toBe(true);
    expect(r.has('aggregate')).toBe(false);
  });

  it('types() 返回所有已注册 type', () => {
    const r = new ExecutorRegistry();
    r.registerAll(new FilterExecutor(), new SortExecutor());

    const types = r.types();
    expect(types).toContain('filter');
    expect(types).toContain('sort');
  });

  it('重复注册覆盖已有执行器', () => {
    const r = new ExecutorRegistry();
    r.register(new FilterExecutor());
    r.register(new FilterExecutor()); // 第二次注册覆盖
    expect(r.has('filter')).toBe(true);
    expect(r.types()).toHaveLength(1);
  });

  it('注册所有 7 个执行器', () => {
    const r = new ExecutorRegistry();
    r.registerAll(
      new FilterExecutor(),
      new SortExecutor(),
      new AggregateExecutor(),
      new DedupExecutor(),
      new MatchExecutor(),
      new MergeExecutor(),
      new CleanExecutor(),
    );

    const expected = ['filter', 'sort', 'aggregate', 'dedup', 'match', 'merge', 'clean'];
    for (const type of expected) {
      expect(r.has(type)).toBe(true);
    }
    expect(r.types()).toHaveLength(7);
  });
});

describe('FilterExecutor', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const rows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000 },
    { name: '李四', dept: '市场部', bonus: 3000 },
    { name: '王五', dept: '技术部', bonus: 6000 },
  ];

  it('filter 条件生效', () => {
    const executor = new FilterExecutor();
    const plan: ExecutionPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'bonus', operator: Operator.LT, value: 5000 }],
    };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows).toHaveLength(1);
    expect(result.result.rows[0].name).toBe('李四');
  });

  it('空条件返回全部', () => {
    const executor = new FilterExecutor();
    const plan: ExecutionPlan = { type: 'filter', conditions: [] };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows).toHaveLength(3);
  });
});

describe('SortExecutor', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const rows: RowData[] = [
    { name: '张三', bonus: 8000 },
    { name: '李四', bonus: 3000 },
    { name: '王五', bonus: 6000 },
  ];

  it('降序排列', () => {
    const executor = new SortExecutor();
    const plan: ExecutionPlan = {
      type: 'sort',
      sorts: [{ columnKey: 'bonus', order: SortOrder.DESC }],
    };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows[0].bonus).toBe(8000);
    expect(result.result.rows[1].bonus).toBe(6000);
    expect(result.result.rows[2].bonus).toBe(3000);
  });
});

describe('AggregateExecutor', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const rows: RowData[] = [
    { name: '张三', dept: '技术部', bonus: 8000 },
    { name: '李四', dept: '市场部', bonus: 3000 },
    { name: '王五', dept: '技术部', bonus: 6000 },
  ];

  it('SUM 无分组', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
    };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    const aggKey = result.result.columns.find((c) => c.title.includes('合计'))!.key;
    const sumRow = result.result.rows[result.result.rows.length - 1];
    expect(sumRow[aggKey]).toBe(17000);
  });

  it('SUM 分组', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.SUM,
      columns: ['bonus'],
      groupBy: ['dept'],
    };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows).toHaveLength(2);
    for (const row of result.result.rows) {
      if (row.dept === '技术部') expect(row['bonus_合计']).toBe(14000);
      if (row.dept === '市场部') expect(row['bonus_合计']).toBe(3000);
    }
  });

  it('AVG 空数据返回 null', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = {
      type: 'aggregate',
      method: AggMethod.AVG,
      columns: ['bonus'],
    };
    // 全部为 null 的行
    const emptyCtx: ExecutionContext = { mainSheet: { columns, rows: [{ name: '张三', dept: '技术部', bonus: null }] } };
    const result = executor.execute(plan, emptyCtx);
    const aggKey = result.result.columns.find((c) => c.title.includes('平均'))!.key;
    expect(result.result.rows[0][aggKey]).toBeNull();
  });

  it('MAX 空数据返回 null', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = { type: 'aggregate', method: AggMethod.MAX, columns: ['bonus'] };
    const emptyCtx: ExecutionContext = { mainSheet: { columns, rows: [{ name: '张三', dept: '技术部', bonus: null }] } };
    const result = executor.execute(plan, emptyCtx);
    const aggKey = result.result.columns.find((c) => c.title.includes('最大'))!.key;
    expect(result.result.rows[0][aggKey]).toBeNull();
  });

  it('MIN 空数据返回 null', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = { type: 'aggregate', method: AggMethod.MIN, columns: ['bonus'] };
    const emptyCtx: ExecutionContext = { mainSheet: { columns, rows: [{ name: '张三', dept: '技术部', bonus: null }] } };
    const result = executor.execute(plan, emptyCtx);
    const aggKey = result.result.columns.find((c) => c.title.includes('最小'))!.key;
    expect(result.result.rows[0][aggKey]).toBeNull();
  });

  it('COUNT 空数据返回 0', () => {
    const executor = new AggregateExecutor();
    const plan: ExecutionPlan = { type: 'aggregate', method: AggMethod.COUNT, columns: ['bonus'] };
    const emptyCtx: ExecutionContext = { mainSheet: { columns, rows: [{ name: '张三', dept: '技术部', bonus: null }] } };
    const result = executor.execute(plan, emptyCtx);
    const aggKey = result.result.columns.find((c) => c.title.includes('计数'))!.key;
    expect(result.result.rows[0][aggKey]).toBe(0);
  });
});

describe('DedupExecutor', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const rows: RowData[] = [
    { name: '张三', bonus: 8000 },
    { name: '李四', bonus: 3000 },
    { name: '张三', bonus: 8000 },
    { name: '张三', bonus: 8000 },
  ];

  it('按 name 去重', () => {
    const executor = new DedupExecutor();
    const plan: ExecutionPlan = { type: 'dedup', columns: ['name'] };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows).toHaveLength(2);
    expect(result.summary.deletedCount).toBe(2);
  });
});

describe('CleanExecutor', () => {
  const columns: ColumnDef[] = [
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'bonus', title: '绩效奖金', type: 'number' },
  ];

  const rows: RowData[] = [
    { name: '张三', bonus: 8000 },
    { name: '', bonus: null },
  ];

  it('清洗空行', () => {
    const executor = new CleanExecutor();
    const plan: ExecutionPlan = { type: 'clean' };
    const ctx: ExecutionContext = { mainSheet: { columns, rows } };

    const result = executor.execute(plan, ctx);

    expect(result.result.rows).toHaveLength(1);
    expect(result.result.rows[0].name).toBe('张三');
  });
});

describe('MatchExecutor / MergeExecutor — 缺表降级', () => {
  it('match 缺表不抛异常，降级保留左表', () => {
    const executor = new MatchExecutor();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: [] };
    const ctx: ExecutionContext = { mainSheet: { columns: [], rows: [] } };

    const result = executor.execute(plan, ctx);
    expect(result.summary.totalRecords).toBe(0);
  });

  it('merge 缺表抛异常', () => {
    const executor = new MergeExecutor();
    const plan: ExecutionPlan = { type: 'merge', sourceTables: [] };
    const ctx: ExecutionContext = { mainSheet: { columns: [], rows: [] } };

    expect(() => executor.execute(plan, ctx)).toThrow('至少 2 个表');
  });
});

describe('MatchExecutor — Left Join 语义验证', () => {
  it('左表全部保留，右表未匹配不新增行', () => {
    const executor = new MatchExecutor();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const leftCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
    ];
    const leftRows: RowData[] = [
      { name: '张三', dept: '技术部' },
      { name: '李四', dept: '市场部' },
      { name: '王五', dept: '销售部' },
    ];
    const rightCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'city', title: '城市', type: 'text' },
    ];
    const rightRows: RowData[] = [
      { name: '张三', city: '北京' },
      { name: '赵六', city: '广州' }, // 赵六不应出现在结果中
    ];
    const ctx: ExecutionContext = {
      mainSheet: { columns: leftCols, rows: leftRows },
      taskSheets: [{ columns: rightCols, rows: rightRows, name: 't2' }],
    };
    const r = executor.execute(plan, ctx);
    // 结果应是 3 行（左表全部保留）
    expect(r.result.rows.length).toBe(3);
    const zhangRow = r.result.rows.find((row: RowData) => row.name === '张三');
    expect(zhangRow?.['_lkp_city']).toBe('北京');
    const wangRow = r.result.rows.find((row: RowData) => row.name === '王五');
    expect(wangRow?.['_lkp_city']).toBeNull();
    // 赵六不应存在于结果中
    const zhaoRow = r.result.rows.find((row: RowData) => row.name === '赵六');
    expect(zhaoRow).toBeUndefined();
  });

  it('多列复合键匹配', () => {
    const executor = new MatchExecutor();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name', 'dept'], lookupTables: ['t2'] };
    const leftCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
    ];
    const leftRows: RowData[] = [
      { name: '张三', dept: '技术部' },
      { name: '张三', dept: '市场部' },
    ];
    const rightCols: ColumnDef[] = [
      { key: 'name', title: '姓名', type: 'text' },
      { key: 'dept', title: '部门', type: 'text' },
      { key: 'city', title: '城市', type: 'text' },
    ];
    const rightRows: RowData[] = [
      { name: '张三', dept: '技术部', city: '北京' },
    ];
    const ctx: ExecutionContext = {
      mainSheet: { columns: leftCols, rows: leftRows },
      taskSheets: [{ columns: rightCols, rows: rightRows, name: 't2' }],
    };
    const r = executor.execute(plan, ctx);
    expect(r.result.rows.length).toBe(2);
    const techZhang = r.result.rows.find((row: RowData) => row.name === '张三' && row.dept === '技术部');
    expect(techZhang?.['_lkp_city']).toBe('北京');
  });

  it('空右表不抛异常', () => {
    const executor = new MatchExecutor();
    const plan: ExecutionPlan = { type: 'match', matchColumns: ['name'], lookupTables: ['t2'] };
    const ctx: ExecutionContext = {
      mainSheet: { columns: [{ key: 'name', title: '姓名', type: 'text' }], rows: [{ name: '张三' }] },
      taskSheets: [],
    };
    const r = executor.execute(plan, ctx);
    expect(r.result.rows.length).toBe(1);
    expect(r.summary.totalRecords).toBe(1);
  });
});
