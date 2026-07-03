import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '@/lib/v2/predicate';
import { Operator } from '@/lib/v2/types';
import { filterRowsMulti } from '@/lib/data-engine';

// ============================================================
// evaluateCondition 单元测试
// ============================================================

describe('evaluateCondition — Operator.EQ', () => {
  it('equal strings pass', () => {
    expect(evaluateCondition('张三', Operator.EQ, '张三')).toBe(true);
  });
  it('case insensitive', () => {
    expect(evaluateCondition('Zhangsan', Operator.EQ, 'zhangsan')).toBe(true);
  });
  it('unequal strings fail', () => {
    expect(evaluateCondition('张三', Operator.EQ, '李四')).toBe(false);
  });
  it('numeric equality', () => {
    expect(evaluateCondition(5000, Operator.EQ, '5000')).toBe(true);
  });
});

describe('evaluateCondition — Operator.NE', () => {
  it('different strings pass', () => {
    expect(evaluateCondition('张三', Operator.NE, '李四')).toBe(true);
  });
  it('same strings fail', () => {
    expect(evaluateCondition('张三', Operator.NE, '张三')).toBe(false);
  });
});

describe('evaluateCondition — Operator.GT', () => {
  it('8000 > 5000', () => {
    expect(evaluateCondition(8000, Operator.GT, 5000)).toBe(true);
  });
  it('3000 > 5000 fail', () => {
    expect(evaluateCondition(3000, Operator.GT, 5000)).toBe(false);
  });
  it('string numeric comparison', () => {
    expect(evaluateCondition('8000', Operator.GT, '5000')).toBe(true);
  });
});

describe('evaluateCondition — Operator.GTE', () => {
  it('15000 >= 15000', () => {
    expect(evaluateCondition(15000, Operator.GTE, 15000)).toBe(true);
  });
  it('8000 >= 15000 fail', () => {
    expect(evaluateCondition(8000, Operator.GTE, 15000)).toBe(false);
  });
});

describe('evaluateCondition — Operator.LT', () => {
  it('3000 < 5000', () => {
    expect(evaluateCondition(3000, Operator.LT, 5000)).toBe(true);
  });
  it('8000 < 5000 fail', () => {
    expect(evaluateCondition(8000, Operator.LT, 5000)).toBe(false);
  });
});

describe('evaluateCondition — Operator.LTE', () => {
  it('3000 <= 5000', () => {
    expect(evaluateCondition(3000, Operator.LTE, 5000)).toBe(true);
  });
  it('5000 <= 5000', () => {
    expect(evaluateCondition(5000, Operator.LTE, 5000)).toBe(true);
  });
});

describe('evaluateCondition — Operator.CONTAINS', () => {
  it('张三 contains 张', () => {
    expect(evaluateCondition('张三', Operator.CONTAINS, '张')).toBe(true);
  });
  it('张三 not contains 李', () => {
    expect(evaluateCondition('张三', Operator.CONTAINS, '李')).toBe(false);
  });
  it('case insensitive', () => {
    expect(evaluateCondition('HelloWorld', Operator.CONTAINS, 'hello')).toBe(true);
  });
});

describe('evaluateCondition — Operator.STARTS_WITH', () => {
  it('销售部 starts with 销', () => {
    expect(evaluateCondition('销售部', Operator.STARTS_WITH, '销')).toBe(true);
  });
  it('销售部 not starts with 市', () => {
    expect(evaluateCondition('销售部', Operator.STARTS_WITH, '市')).toBe(false);
  });
});

describe('evaluateCondition — Operator.ENDS_WITH', () => {
  it('销售部 ends with 部', () => {
    expect(evaluateCondition('销售部', Operator.ENDS_WITH, '部')).toBe(true);
  });
  it('销售部 not ends with 门', () => {
    expect(evaluateCondition('销售部', Operator.ENDS_WITH, '门')).toBe(false);
  });
});

describe('evaluateCondition — Operator.BETWEEN', () => {
  it('5000 between 1000 and 8000', () => {
    expect(evaluateCondition(5000, Operator.BETWEEN, { start: 1000, end: 8000 })).toBe(true);
  });
  it('5000 between 6000 and 8000 fail', () => {
    expect(evaluateCondition(5000, Operator.BETWEEN, { start: 6000, end: 8000 })).toBe(false);
  });
  it('string between', () => {
    expect(evaluateCondition('2024-01-15', Operator.BETWEEN, { start: '2024-01-01', end: '2024-01-31' })).toBe(true);
  });
});

describe('evaluateCondition — Operator.IN', () => {
  const set = ['张三', '李四'];
  it('张三 in set', () => {
    expect(evaluateCondition('张三', Operator.IN, set)).toBe(true);
  });
  it('王五 not in set', () => {
    expect(evaluateCondition('王五', Operator.IN, set)).toBe(false);
  });
});

describe('evaluateCondition — Operator.NOT_IN', () => {
  const set = ['张三', '李四'];
  it('王五 not in set passes', () => {
    expect(evaluateCondition('王五', Operator.NOT_IN, set)).toBe(true);
  });
  it('张三 in set fails NOT_IN', () => {
    expect(evaluateCondition('张三', Operator.NOT_IN, set)).toBe(false);
  });
});

describe('evaluateCondition — Operator.IS_NULL', () => {
  it('null passes', () => {
    expect(evaluateCondition(null, Operator.IS_NULL, null)).toBe(true);
  });
  it('undefined passes', () => {
    expect(evaluateCondition(undefined, Operator.IS_NULL, null)).toBe(true);
  });
  it('empty string passes', () => {
    expect(evaluateCondition('', Operator.IS_NULL, null)).toBe(true);
  });
  it('non-null fails', () => {
    expect(evaluateCondition('张三', Operator.IS_NULL, null)).toBe(false);
  });
});

describe('evaluateCondition — Operator.NOT_NULL', () => {
  it('non-null passes', () => {
    expect(evaluateCondition('张三', Operator.NOT_NULL, null)).toBe(true);
  });
  it('null fails', () => {
    expect(evaluateCondition(null, Operator.NOT_NULL, null)).toBe(false);
  });
  it('empty string fails', () => {
    expect(evaluateCondition('', Operator.NOT_NULL, null)).toBe(false);
  });
});

// ============================================================
// filterRowsMulti 集成测试（通过旧接口验证兼容性）
// ============================================================

const sampleRows = [
  { name: '张三', dept: '销售部', salary: 8000, bonus: 3500 },
  { name: '李四', dept: '技术部', salary: 12000, bonus: 4000 },
  { name: '王五', dept: '销售部', salary: 6000, bonus: 2800 },
  { name: '赵六', dept: '技术部', salary: 7000, bonus: 2000 },
  { name: '钱七', dept: '市场部', salary: 11000, bonus: 5000 },
  { name: '孙八', dept: '销售部', salary: 8500, bonus: 3200 },
  { name: '周九', dept: '技术部', salary: 13000, bonus: 4500 },
  { name: '吴十', dept: '市场部', salary: 6500, bonus: 2200 },
];

describe('filterRowsMulti — 实际场景集成', () => {
  it('绩效奖金 < 5000', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'bonus', operator: 'lt', value: 5000 },
    ]);
    expect(r.length).toBe(7); // 只有钱七 bonus=5000 被排除
    expect(r.every(row => row.bonus! < 5000)).toBe(true);
  });

  it('工资 >= 15000', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'salary', operator: 'gte', value: 15000 },
    ]);
    expect(r.length).toBe(0);
  });

  it('工资 >= 10000', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'salary', operator: 'gte', value: 10000 },
    ]);
    expect(r.length).toBe(3); // 李四 12000, 钱七 11000, 周九 13000
    expect(r.every(row => row.salary! >= 10000)).toBe(true);
  });

  it('奖金 BETWEEN 1000 AND 3000', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'bonus', operator: 'between', value: { start: 1000, end: 3000 } },
    ]);
    // 奖金在 1000-3000 之间的：王五2800、赵六2000、吴十2200 = 3人
    expect(r.length).toBe(3);
    expect(r.every(row => row.bonus! >= 1000 && row.bonus! <= 3000)).toBe(true);
  });

  it('contains 销售部', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'dept', operator: 'contains', value: '销售' },
    ]);
    expect(r.length).toBe(3); // 张三、王五、孙八
    expect(r.every(row => (row.dept as string).includes('销售'))).toBe(true);
  });

  it('多条件 AND：销售部 AND salary > 7000', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'dept', operator: 'eq', value: '销售部' },
      { column: 'salary', operator: 'gt', value: 7000 },
    ]);
    expect(r.length).toBe(2); // 张三8000、孙八8500（王五6000被排除）
    expect(r.every(row => row.dept === '销售部' && row.salary! > 7000)).toBe(true);
  });

  it('IN 操作符', () => {
    const r = filterRowsMulti(sampleRows, [
      { column: 'name', operator: 'in', value: ['张三', '李四'] },
    ]);
    expect(r.length).toBe(2);
  });

  it('IS_NULL 操作符', () => {
    const rowsWithNull = [
      ...sampleRows,
      { name: '未知', dept: null, salary: 5000, bonus: 1000 },
    ];
    const r = filterRowsMulti(rowsWithNull, [
      { column: 'dept', operator: 'isNull', value: null },
    ]);
    expect(r.length).toBe(1);
  });
});
