import { describe, it, expect } from 'vitest';
import {
  sumColumn,
  sortRows,
  filterRows,
  filterByDateRange,
  dedupRows,
  matchMultiTables,
  mergeTables,
  cleanData,
  aggregateRows,
  normalizeStr,
  levenshteinDistance,
  fuzzyFind,
} from '../data-engine';
import { ColumnDef, RowData } from '../types';

// ---- 工具函数：创建测试用 ColumnDef ----
function col(key: string, type: ColumnDef['type'] = 'text'): ColumnDef {
  return { key, title: key, type };
}

// ============================================================
// sumColumn
// ============================================================
describe('sumColumn', () => {
  it('正常数字求和', () => {
    const rows: RowData[] = [{ amount: 100 }, { amount: 200 }, { amount: 300 }];
    const result = sumColumn(rows, 'amount');
    expect(result.total).toBe(600);
    expect(result.count).toBe(3);
  });

  it('混合 null 值时跳过', () => {
    const rows: RowData[] = [{ amount: 100 }, { amount: null }, { amount: 200 }];
    const result = sumColumn(rows, 'amount');
    expect(result.total).toBe(300);
    expect(result.count).toBe(2);
  });

  it('非数字值跳过', () => {
    const rows: RowData[] = [{ amount: 'xx' as unknown as number }, { amount: 500 }];
    const result = sumColumn(rows, 'amount');
    expect(result.total).toBe(500);
    expect(result.count).toBe(1);
  });
});

// ============================================================
// sortRows
// ============================================================
describe('sortRows', () => {
  const rows: RowData[] = [
    { 金额: 300 },
    { 金额: 100 },
    { 金额: 200 },
    { 金额: null },
  ];

  it('数字列升序排列', () => {
    const result = sortRows(rows, '金额', true);
    expect(result.map((r) => r.金额)).toEqual([100, 200, 300, null]);
  });

  it('数字列降序排列', () => {
    const result = sortRows(rows, '金额', false);
    expect(result.map((r) => r.金额)).toEqual([300, 200, 100, null]);
  });

  it('两个 null 值返回 0，排序稳定', () => {
    const rowsWithNull: RowData[] = [
      { name: 'A', 金额: null },
      { name: 'B', 金额: null },
    ];
    const result = sortRows(rowsWithNull, '金额', true);
    // 都 null 时保持原序
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });
});

// ============================================================
// filterRows
// ============================================================
describe('filterRows', () => {
  const rows: RowData[] = [
    { name: '张三', department: '技术部' },
    { name: '李四', department: '市场部' },
    { name: '王五', department: '技术部' },
  ];

  it('eq 精确筛选', () => {
    const result = filterRows(rows, 'department', 'eq', '技术部');
    expect(result.length).toBe(2);
  });

  it('contains 模糊筛选', () => {
    const result = filterRows(rows, 'name', 'contains', '张');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('张三');
  });
});

// ============================================================
// filterByDateRange
// ============================================================
describe('filterByDateRange', () => {
  const rows: RowData[] = [
    { date: '2024-01-05', name: 'A' },
    { date: '2024-01-15', name: 'B' },
    { date: '2024-02-01', name: 'C' },
  ];

  it('筛选日期范围内的行', () => {
    const result = filterByDateRange(rows, 'date', '2024-01-01', '2024-01-31');
    expect(result.length).toBe(2);
    expect(result.map((r) => r.name)).toEqual(['A', 'B']);
  });
});

// ============================================================
// dedupRows
// ============================================================
describe('dedupRows', () => {
  const rows: RowData[] = [
    { phone: '13800000001', name: '张三' },
    { phone: '13800000002', name: '李四' },
    { phone: '13800000001', name: '张三' },
    { phone: '13800000003', name: '王五' },
  ];

  it('按单列去重', () => {
    const result = dedupRows(rows, ['phone']);
    expect(result.result.length).toBe(3);
    expect(result.deleted).toBe(1);
  });

  it('去重统计 duplicates 数量', () => {
    const result = dedupRows(rows, ['phone']);
    expect(result.duplicates.length).toBe(1);
    expect(result.duplicates[0].count).toBe(2);
  });
});

// ============================================================
// matchMultiTables
// ============================================================
describe('matchMultiTables', () => {
  it('两张表按公共字段匹配', () => {
    const table1 = {
      columns: [col('ID'), col('姓名')],
      rows: [
        { ID: '1', 姓名: '张三' },
        { ID: '2', 姓名: '李四' },
      ],
      name: '表1',
    };
    const table2 = {
      columns: [col('ID'), col('部门')],
      rows: [
        { ID: '1', 部门: '技术' },
        { ID: '999', 部门: '其他' },
      ],
      name: '表2',
    };
    const result = matchMultiTables([table1, table2]);
    expect(result.summary.matchedCount).toBe(1);
    expect(result.summary.unmatchedCount).toBe(1);
    expect(result.rows[0]._lkp_部门).toBe('技术');
    // 李四的 ID='2'，在表2中没有匹配
    expect(result.rows[1]._lkp_部门).toBeNull();
  });

  it('三张表匹配 — 累加 matched/unmatched 计数（回归：#matchMultiTables 累加 bug）', () => {
    const table1 = {
      columns: [col('ID'), col('姓名')],
      rows: [
        { ID: '1', 姓名: '张三' },
        { ID: '2', 姓名: '李四' },
      ],
      name: '表1',
    };
    const table2 = {
      columns: [col('ID'), col('部门')],
      rows: [
        { ID: '1', 部门: '技术' },
      ],
      name: '表2',
    };
    const table3 = {
      columns: [col('ID'), col('薪资')],
      rows: [
        { ID: '1', 薪资: '10000' },
      ],
      name: '表3',
    };
    const result = matchMultiTables([table1, table2, table3]);
    expect(result.summary.matchedCount).toBe(2);
    expect(result.summary.unmatchedCount).toBe(0);
    expect(result.rows[0]._lkp_部门).toBe('技术');
    expect(result.rows[0]._lkp_薪资).toBe('10000');
  });

  it('仅一张表时返回原数据', () => {
    const table1 = {
      columns: [col('ID')],
      rows: [{ ID: '1' }, { ID: '2' }],
      name: '表1',
    };
    const result = matchMultiTables([table1]);
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.matchedCount).toBeUndefined();
  });
});

// ============================================================
// mergeTables
// ============================================================
describe('mergeTables', () => {
  it('纵向拼接两张表', () => {
    const table1 = {
      columns: [col('name'), col('age')],
      rows: [{ name: '张三', age: 25 }],
    };
    const table2 = {
      columns: [col('name'), col('age')],
      rows: [{ name: '李四', age: 30 }],
    };
    const result = mergeTables([table1, table2]);
    expect(result.rows.length).toBe(2);
    expect(result.summary.totalRecords).toBe(2);
  });

  it('额外列用 null 补齐', () => {
    const table1 = {
      columns: [col('name')],
      rows: [{ name: '张三' }],
    };
    const table2 = {
      columns: [col('name'), col('age')],
      rows: [{ name: '李四', age: 30 }],
    };
    const result = mergeTables([table1, table2]);
    expect(result.rows[0].name).toBe('张三');
    expect(result.rows[0].age).toBeNull();
  });
});

// ============================================================
// cleanData
// ============================================================
describe('cleanData', () => {
  const columns: ColumnDef[] = [col('name'), col('amount', 'number')];

  it('移除全空行', () => {
    const rows: RowData[] = [
      { name: '张三', amount: 100 },
      { name: null, amount: null },
    ];
    const result = cleanData(rows, columns);
    expect(result.result.length).toBe(1);
    expect(result.removedEmptyRows).toBe(1);
  });

  it('修复数值列非法单元格', () => {
    const rows: RowData[] = [{ name: '张三', amount: '不是数字' as unknown as number }];
    const result = cleanData(rows, columns);
    expect(result.removedInvalidCells).toBe(1);
    expect(result.result[0].amount).toBeNull();
  });
});

// ============================================================
// aggregateRows
// ============================================================
describe('aggregateRows', () => {
  const cols: ColumnDef[] = [
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'salary', title: '工资', type: 'number' },
  ];
  const rows: RowData[] = [
    { dept: '技术部', name: '张三', salary: 10000 },
    { dept: '技术部', name: '李四', salary: 12000 },
    { dept: '市场部', name: '王五', salary: 8000 },
    { dept: '市场部', name: '赵六', salary: 9000 },
  ];

  it('无分组时 SUM 等价于全局求和', () => {
    const r = aggregateRows(rows, [], 'salary', 'SUM', cols);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].salary_合计).toBe(39000);
  });

  it('按部门分组 SUM', () => {
    const r = aggregateRows(rows, ['dept'], 'salary', 'SUM', cols);
    expect(r.rows.length).toBe(2);
    const tech = r.rows.find((row) => row.dept === '技术部');
    const mkt = r.rows.find((row) => row.dept === '市场部');
    expect(tech!.salary_合计).toBe(22000);
    expect(mkt!.salary_合计).toBe(17000);
  });

  it('AVG 聚合', () => {
    const r = aggregateRows(rows, ['dept'], 'salary', 'AVG', cols);
    const tech = r.rows.find((row) => row.dept === '技术部');
    expect(tech!.salary_平均).toBe(11000);
  });

  it('COUNT 聚合', () => {
    const r = aggregateRows(rows, ['dept'], 'salary', 'COUNT', cols);
    const tech = r.rows.find((row) => row.dept === '技术部');
    expect(tech!.salary_计数).toBe(2);
  });

  it('MAX / MIN 聚合', () => {
    const maxR = aggregateRows(rows, ['dept'], 'salary', 'MAX', cols);
    const minR = aggregateRows(rows, ['dept'], 'salary', 'MIN', cols);
    const techMax = maxR.rows.find((row) => row.dept === '技术部');
    const techMin = minR.rows.find((row) => row.dept === '技术部');
    expect(techMax!.salary_最大).toBe(12000);
    expect(techMin!.salary_最小).toBe(10000);
  });
});

// ============================================================
// normalizeStr / levenshteinDistance / fuzzyFind
// ============================================================
describe('模糊匹配工具', () => {
  it('normalizeStr 去空格和全角转半角', () => {
    expect(normalizeStr(' 张 三 ')).toBe('张三');
    expect(normalizeStr('Ｈｅｌｌｏ')).toBe('hello');
  });

  it('levenshteinDistance 正确计算编辑距离', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('abc', 'abd')).toBe(1);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('张三', '张 三')).toBe(1);
  });

  it('fuzzyFind 精确匹配优先', () => {
    expect(fuzzyFind('张三', ['张三', '李四'])).toBe('张三');
  });

  it('fuzzyFind 模糊匹配（空格干扰）', () => {
    expect(fuzzyFind('Zhangsan', ['Zhang san', 'Li si'])).toBe('Zhang san');
  });

  it('fuzzyFind 低于阈值返回 null', () => {
    const r = fuzzyFind('abc', ['xyz'], 0.85);
    expect(r).toBeNull();
  });
});

// ============================================================
// matchMultiTables 模糊匹配
// ============================================================
describe('matchMultiTables 模糊匹配', () => {
  it('有空格干扰时仍能匹配上', () => {
    const table1 = {
      columns: [col('姓名'), col('部门')],
      rows: [{ 姓名: '张三', 部门: '技术部' }],
      name: '表1',
    };
    const table2 = {
      columns: [col('姓名'), col('工资')],
      rows: [{ 姓名: '张 三', 工资: '10000' }],
      name: '表2',
    };
    const result = matchMultiTables([table1, table2]);
    expect(result.summary.matchedCount).toBe(1);
    expect(result.rows[0]._lkp_工资).toBe('10000');
  });

  it('大小写差异仍能匹配', () => {
    const table1 = {
      columns: [col('姓名'), col('部门')],
      rows: [{ 姓名: 'Zhao Liu', 部门: '市场部' }],
      name: '表1',
    };
    const table2 = {
      columns: [col('姓名'), col('工资')],
      rows: [{ 姓名: 'zhao liu', 工资: '9000' }],
      name: '表2',
    };
    const result = matchMultiTables([table1, table2]);
    expect(result.summary.matchedCount).toBe(1);
    expect(result.rows[0]._lkp_工资).toBe('9000');
  });
});
