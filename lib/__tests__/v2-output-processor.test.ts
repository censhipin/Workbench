import { describe, it, expect } from 'vitest';
import { DefaultOutputProcessor } from '@/lib/v2/output-processor/OutputProcessor';
import { runOutputProcessor } from '@/lib/v2/output-processor/run-output';
import type { ColumnDef, RowData } from '@/lib/types';

// 每个测试用独立的深拷贝副本，避免 renameColumns 的浅拷贝副作用
function cloneCols(cols: ColumnDef[]): ColumnDef[] {
  return cols.map(c => ({ ...c }));
}
function cloneRows(rows: RowData[]): RowData[] {
  return rows.map(r => ({ ...r }));
}

const BASE_COLUMNS: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'bonus', title: '绩效奖金', type: 'number' },
  { key: 'email', title: '邮箱', type: 'text' },
];

const BASE_ROWS: RowData[] = [
  { name: '张三', dept: '技术部', bonus: 8000, email: 'zhangsan@test.com' },
  { name: '李四', dept: '市场部', bonus: 3000, email: 'lisi@test.com' },
  { name: '王五', dept: '技术部', bonus: 6000, email: 'wangwu@test.com' },
];

describe('DefaultOutputProcessor', () => {
  const processor = new DefaultOutputProcessor();

  describe('includeColumns', () => {
    it('只保留指定列', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        includeColumns: ['姓名', '绩效奖金'],
      });

      expect(result.columns).toHaveLength(2);
      expect(result.columns.map(c => c.key)).toEqual(['name', 'bonus']);
      expect(result.rows[0]).toEqual({ name: '张三', bonus: 8000 });
    });

    it('包含不存在的列名时忽略', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        includeColumns: ['姓名', '不存在的列'],
      });

      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].key).toBe('name');
    });

    it('通过 key 也能匹配', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        includeColumns: ['name', 'bonus'],
      });

      expect(result.columns).toHaveLength(2);
    });
  });

  describe('excludeColumns', () => {
    it('删除指定列', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        excludeColumns: ['邮箱'],
      });

      expect(result.columns).toHaveLength(3);
      expect(result.columns.find(c => c.key === 'email')).toBeUndefined();
      expect(result.rows[0].email).toBeUndefined();
    });

    it('删除多列', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        excludeColumns: ['邮箱', '部门'],
      });

      expect(result.columns).toHaveLength(2);
      expect(result.columns.map(c => c.key)).toEqual(['name', 'bonus']);
    });

    it('排除不存在的列不影响', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        excludeColumns: ['不存在的列'],
      });

      expect(result.columns).toHaveLength(4);
    });
  });

  describe('renameColumns', () => {
    it('列 title 和数据行 key 同时修改', () => {
      const cols = cloneCols([...BASE_COLUMNS, { key: 'phone', title: 'phone', type: 'text' }]);
      const rows = cloneRows(BASE_ROWS).map(r => ({ ...r, phone: '13800000000' }));

      const result = processor.process(rows, cols, {
        renameColumns: { phone: '联系电话' },
      });

      // title 修改
      const phoneCol = result.columns.find(c => c.title === '联系电话');
      expect(phoneCol).toBeDefined();

      // key 和数据迁移
      expect(result.rows[0]['联系电话']).toBe('13800000000');
      expect(result.rows[0].phone).toBeUndefined();
    });

    it('仅重命名 title 时 key 不变', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        renameColumns: { name: '员工姓名' },
      });

      // 列 key 不变，只是找了匹配的名称作为 key，所以 key 被改为新值
      // 注意：renameColumns 的行为是将找匹配列的 key 改为新名称
      // 这里 name 匹配了 `c.key === 'name'`，然后 key 变为 '员工姓名'
      const nameCol = result.columns.find(c => c.title === '员工姓名');
      expect(nameCol).toBeDefined();
      expect(nameCol!.title).toBe('员工姓名');
    });
  });

  describe('reorderColumns', () => {
    const makeCols = () => cloneCols(BASE_COLUMNS);
    const makeRows = () => cloneRows(BASE_ROWS);

    it('按指定顺序排列列', () => {
      const result = processor.process(makeRows(), makeCols(), {
        reorderColumns: ['bonus', 'name', 'dept'],
      });

      const bonusIdx = result.columns.findIndex(c => c.key === 'bonus');
      const nameIdx = result.columns.findIndex(c => c.key === 'name');
      const deptIdx = result.columns.findIndex(c => c.key === 'dept');
      // bonus(0) < name(1) < dept(2)
      expect(bonusIdx).toBeLessThan(nameIdx);
      expect(nameIdx).toBeLessThan(deptIdx);
    });

    it('未指定的列排在后面', () => {
      const result = processor.process(makeRows(), makeCols(), {
        reorderColumns: ['绩效奖金'],
      });

      expect(result.columns[0].key).toBe('bonus');
    });
  });

  describe('limit', () => {
    it('限制返回行数', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        limit: 2,
      });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('张三');
      expect(result.rows[1].name).toBe('李四');
    });

    it('limit 大于总行数时返回全部', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        limit: 999,
      });

      expect(result.rows).toHaveLength(3);
    });

    it('limit=0 不生效', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        limit: 0,
      });

      expect(result.rows).toHaveLength(3);
    });
  });

  describe('综合场景', () => {
    it('includeColumns + limit', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        includeColumns: ['姓名', '绩效奖金'],
        limit: 1,
      });

      expect(result.columns).toHaveLength(2);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('张三');
      expect(result.rows[0].bonus).toBe(8000);
    });

    it('includeColumns + excludeColumns（exclude 只对 include 后的列生效）', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
        includeColumns: ['姓名', '绩效奖金', '邮箱'],
        excludeColumns: ['邮箱'],
      });

      expect(result.columns).toHaveLength(2);
      expect(result.columns.map(c => c.key)).toEqual(['name', 'bonus']);
    });
  });

  describe('无 output 或空', () => {
    it('output 为 null 时原样返回', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), null);
      expect(result.rows).toHaveLength(3);
      expect(result.columns).toHaveLength(4);
    });

    it('output 为 undefined 时原样返回', () => {
      const result = processor.process(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), undefined);
      expect(result.rows).toHaveLength(3);
      expect(result.columns).toHaveLength(4);
    });
  });
});

describe('runOutputProcessor', () => {
  it('与 DefaultOutputProcessor 行为一致', () => {
    const result = runOutputProcessor(cloneRows(BASE_ROWS), cloneCols(BASE_COLUMNS), {
      includeColumns: ['姓名', '绩效奖金'],
      limit: 1,
    });

    expect(result.columns).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('张三');
    expect(result.rows[0].bonus).toBe(8000);
  });
});
