// ============================================================
// NLU Semantic Parser — 操作识别/解析单元测试
// ============================================================
// 覆盖：
//   - formula 检测（新增列、=号、关键词）
//   - formula 自然语言推断（金额 = 数量 * 单价）
//   - update 检测（改成、填充、替换）
//   - update 条件解析（IS_NULL 等）
//   - pipeline 检测（再、然后）
//   - 普通操作不受影响（sort / filter / aggregate）
// ============================================================

import { describe, it, expect } from 'vitest';
import { RuleBasedSemanticParser } from '@/lib/nlu/semantic-parser';
import { defaultLexicon } from '@/lib/nlu/intent-lexicon';
import type { ColumnDef } from '@/lib/types';

const parser = new RuleBasedSemanticParser(defaultLexicon);

// ============================================================
// 公共测试列定义（模拟产品表）
// ============================================================
const productColumns: ColumnDef[] = [
  { key: 'product', title: '产品', type: 'text' },
  { key: 'qty', title: '数量', type: 'number' },
  { key: 'price', title: '单价', type: 'number' },
  { key: 'sales', title: '销售额', type: 'number' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'status', title: '状态', type: 'text' },
];

const emptyColumns: ColumnDef[] = [];

// ============================================================
// 1. 操作检测（最高优先级）
// ============================================================

describe('detectOperation', () => {
  describe('formula detection', () => {
    it('"新增一列金额" → formula', () => {
      const result = parser.detectOperation('新增一列金额', '新增一列金额', productColumns);
      expect(result.operation).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('"新增一列金额，计算每个产品的总金额" → formula', () => {
      const result = parser.detectOperation(
        '新增一列金额，计算每个产品的总金额',
        '新增一列金额，计算每个产品的总金额',
        productColumns
      );
      expect(result.operation).toBe('formula');
    });

    it('"金额=数量*单价" → formula（含等号）', () => {
      const result = parser.detectOperation('金额=数量*单价', '金额=数量*单价', productColumns);
      expect(result.operation).toBe('formula');
    });

    it('"添加列总价，数量乘以单价" → formula', () => {
      const result = parser.detectOperation('添加列总价，数量乘以单价', '添加列总价，数量乘以单价', productColumns);
      expect(result.operation).toBe('formula');
    });

    it('"增加一列利润" → formula', () => {
      const result = parser.detectOperation('增加一列利润', '增加一列利润', productColumns);
      expect(result.operation).toBe('formula');
    });
  });

  describe('update detection', () => {
    it('"将部门全部改成技术部" → update', () => {
      const result = parser.detectOperation('将部门全部改成技术部', '将部门全部改成技术部', productColumns);
      expect(result.operation).toBe('update');
    });

    it('"将姓名为空的填充未知" → update', () => {
      const result = parser.detectOperation('将姓名为空的填充未知', '将姓名为空的填充未知', productColumns);
      expect(result.operation).toBe('update');
    });

    it('"姓名为空填充未知" → update', () => {
      const result = parser.detectOperation('姓名为空填充未知', '姓名为空填充未知', productColumns);
      expect(result.operation).toBe('update');
    });

    it('"把状态改成已完成" → update', () => {
      const result = parser.detectOperation('把状态改成已完成', '把状态改成已完成', productColumns);
      expect(result.operation).toBe('update');
    });

    it('"将状态更新为已完成" → update', () => {
      const result = parser.detectOperation('将状态更新为已完成', '将状态更新为已完成', productColumns);
      expect(result.operation).toBe('update');
    });

    it('"替换所有部门为技术部" → update', () => {
      const result = parser.detectOperation('替换所有部门为技术部', '替换所有部门为技术部', productColumns);
      expect(result.operation).toBe('update');
    });
  });

  describe('other operations', () => {
    it('"筛选销售额大于1000" → filter', () => {
      const result = parser.detectOperation('筛选销售额大于1000', '筛选销售额大于1000', productColumns);
      expect(result.operation).toBe('filter');
    });

    it('"按数量升序排序" → sort', () => {
      const result = parser.detectOperation('按数量升序排序', '按数量升序排序', productColumns);
      expect(result.operation).toBe('sort');
    });

    it('"统计工资" → sum (aggregate)', () => {
      const result = parser.detectOperation('统计工资', '统计工资', productColumns);
      // 应被 lexicon 识别为 sum
      expect(result.operation).not.toBeNull();
    });
  });
});

// ============================================================
// 2. Formula 解析
// ============================================================

describe('parseFormulaIntent', () => {
  it('"新增一列金额" → targetColumn=金额，不推断表达式', () => {
    const intent = parser.parseFormulaIntent('新增一列金额', '新增一列金额', productColumns, []);
    expect(intent.operation).toBe('formula');
    expect(intent.params.targetColumn).toBe('金额');
    // 规则层不猜列名，留给 DeepSeek
    expect(intent.params.expressionType).toBeUndefined();
    expect(intent.params.sourceColumnHints).toBeUndefined();
  });

  it('"计算每个产品的总金额" → 只识别 formula，不推断', () => {
    const intent = parser.parseFormulaIntent('计算每个产品的总金额', '计算每个产品的总金额', productColumns, []);
    expect(intent.operation).toBe('formula');
    // "产品的总金额" 是 tailMatch 的结果，精度有限
    expect(intent.params.targetColumn).toBeTruthy();
    // 规则层不猜列名和表达式
    expect(intent.params.expressionType).toBeUndefined();
  });

  it('"金额=数量*单价" → 解析等号两边', () => {
    const intent = parser.parseFormulaIntent('金额=数量*单价', '金额=数量*单价', productColumns, []);
    expect(intent.operation).toBe('formula');
    expect(intent.params.targetColumn).toBe('金额');
    expect(intent.params.sourceColumnHints).toContain('数量');
    expect(intent.params.sourceColumnHints).toContain('单价');
  });

  it('不含 columnHint 字段', () => {
    const intent = parser.parseFormulaIntent('新增一列金额', '新增一列金额', productColumns, []);
    expect((intent as any).columnHint).toBeUndefined();
    expect(intent.targetColumns).toEqual([]);
  });

  it('不走 column resolver — 无列时也能解析', () => {
    // 即使没有 availableColumns，formula 检测仍然可以工作
    const result = parser.detectOperation('新增一列金额', '新增一列金额', []);
    expect(result.operation).toBe('formula');
  });
});

// ============================================================
// 3. Update 解析
// ============================================================

describe('parseUpdateIntent', () => {
  it('"将部门全部改成技术部" → column=部门, value=技术部', () => {
    const intent = parser.parseUpdateIntent('将部门全部改成技术部', '将部门全部改成技术部', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('部门');
    expect(intent.params.value).toBe('技术部');
  });

  it('"将姓名为空的填充未知" → column=姓名, value=未知, condition=IS_NULL', () => {
    const intent = parser.parseUpdateIntent('将姓名为空的填充未知', '将姓名为空的填充未知', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('姓名');
    expect(intent.params.value).toBe('未知');
    // 应该有 IS_NULL 条件
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBeGreaterThan(0);
    expect(intent.params.updateCondition).toBe('eq');
  });

  it('"姓名为空填充未知" → column=姓名, value=未知, condition=IS_NULL', () => {
    const intent = parser.parseUpdateIntent('姓名为空填充未知', '姓名为空填充未知', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('姓名');
    expect(intent.params.value).toBe('未知');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBeGreaterThan(0);
  });

  it('"将状态修改为已完成" → column=状态, value=已完成', () => {
    const intent = parser.parseUpdateIntent('将状态修改为已完成', '将状态修改为已完成', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('状态');
    expect(intent.params.value).toBe('已完成');
  });

  it('update 不应走 column resolver', () => {
    const intent = parser.parseUpdateIntent('将部门改成技术部', '将部门改成技术部', productColumns, []);
    expect(intent.targetColumns).toEqual([]);
    expect(intent.resolvedColumns).toBeUndefined();
  });
});

// ============================================================
// 4. Pipeline 解析
// ============================================================

describe('pipeline', () => {
  it('"筛选状态已完成，然后按销售额降序" → pipeline steps', () => {
    const intent = parser.parse('筛选状态已完成，然后按销售额降序', productColumns, []);
    expect(intent.operation).toBe('pipeline');
    expect(intent.steps).toBeDefined();
    expect(intent.steps!.length).toBe(2);
    expect(intent.steps![0].operation).toBe('filter');
    expect(intent.steps![1].operation).toBe('sort');
  });

  it('"筛选部门为技术部，再按数量排序" → pipeline: filter + sort', () => {
    const intent = parser.parse('筛选部门为技术部，再按数量排序', productColumns, []);
    expect(intent.operation).toBe('pipeline');
    expect(intent.steps).toBeDefined();
    expect(intent.steps!.length).toBe(2);
  });

  it('单步操作不生成 pipeline', () => {
    const intent = parser.parse('筛选状态已完成', productColumns, []);
    expect(intent.operation).not.toBe('pipeline');
  });

  it('不含连接词不生成 pipeline', () => {
    const intent = parser.parse('筛选销售额大于1000', productColumns, []);
    expect(intent.operation).toBe('filter');
    expect((intent as any).steps).toBeUndefined();
  });
});

// ============================================================
// 5. 标准操作不受影响
// ============================================================

describe('standard operations unaffected', () => {
  it('filter 操作正常工作', () => {
    const intent = parser.parse('筛选销售额大于1000', productColumns, []);
    expect(intent.operation).toBe('filter');
    expect(intent.target).toBeTruthy();
  });

  it('sort 操作正常工作', () => {
    const intent = parser.parse('按数量升序排序', productColumns, []);
    expect(intent.operation).toBe('sort');
    expect(intent.params.asc).toBe(true);
  });

  it('aggregate 操作正常工作', () => {
    const intent = parser.parse('按部门统计销售总额', productColumns, []);
    expect(intent.operation).toBe('sum');
    expect(intent.groupBy).toBeDefined();
  });
});

// ============================================================
// 6. 完全体：parse() 一次调用验证全链路
// ============================================================

describe('parse() — 完整调用', () => {
  it('formula: "新增一列金额，计算每个产品的总金额"', () => {
    const intent = parser.parse('新增一列金额，计算每个产品的总金额', productColumns, []);
    expect(intent.operation).toBe('formula');
    expect(intent.params.targetColumn).toBe('金额');
  });

  it('update: "将部门全部改成技术部" → type=update, column=部门', () => {
    const intent = parser.parse('将部门全部改成技术部', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('部门');
    expect(intent.params.value).toBe('技术部');
  });

  it('update: "姓名为空填充未知" → conditions IS_NULL', () => {
    const intent = parser.parse('姓名为空填充未知', productColumns, []);
    expect(intent.operation).toBe('update');
    expect(intent.target).toBe('姓名');
    expect(intent.params.value).toBe('未知');
    expect(intent.filters).toBeDefined();
    const filter = intent.filters![0];
    // verify IS_NULL condition is present
    expect(filter.column).toBe('姓名');
    expect(filter.operator).toBe('eq');
    expect(filter.value).toBe('');
  });

  it('pipeline: "筛选状态已完成，然后按销售额降序"', () => {
    const intent = parser.parse('筛选状态已完成，然后按销售额降序', productColumns, []);
    expect(intent.operation).toBe('pipeline');
    expect(intent.steps).toHaveLength(2);
    expect(intent.steps![0].operation).toBe('filter');
    expect(intent.steps![1].operation).toBe('sort');
  });
});

// ============================================================
// 7. Filter 管线 — 多条件、嵌套条件、OR 逻辑
// ============================================================

describe('filter pipeline — multi-condition & logic', () => {
  const employeeColumns: ColumnDef[] = [
    { key: 'dept', title: '部门', type: 'text' },
    { key: 'base_salary', title: '基本工资', type: 'number' },
    { key: 'performance', title: '绩效', type: 'number' },
    { key: 'name', title: '姓名', type: 'text' },
    { key: 'total_salary', title: '工资', type: 'number' },
    { key: 'city', title: '城市', type: 'text' },
  ];

  const sampleRows: Record<string, string | number | null>[] = [
    { dept: '技术部', base_salary: 18000, performance: 0.9, name: '张三', total_salary: 18000, city: '北京' },
    { dept: '销售部', base_salary: 12000, performance: 0.85, name: '李四', total_salary: 12000, city: '上海' },
    { dept: '技术部', base_salary: 15000, performance: 0.95, name: '王五', total_salary: 15000, city: '北京' },
    { dept: '销售部', base_salary: 8000, performance: 0.6, name: '赵六', total_salary: 8000, city: '广州' },
  ];

  it('测试1: "筛选技术部工资大于15000的数据" → 部门=技术部 AND 工资>15000', () => {
    const intent = parser.parse('筛选技术部工资大于15000的数据', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(2);

    const deptCond = intent.filters!.find(f => f.column === '部门');
    expect(deptCond).toBeDefined();
    expect(deptCond!.operator).toBe('eq');
    expect(deptCond!.value).toBe('技术部');

    const salaryCond = intent.filters!.find(f => f.operator === 'gt' || f.operator === 'gte');
    expect(salaryCond).toBeDefined();
  });

  it('测试2: "筛选部门是技术部基本工资大于15000的数据" → 两个条件', () => {
    const intent = parser.parse('筛选部门是技术部基本工资大于15000的数据', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(2);
  });

  it('测试3: "销售部绩效大于0.8工资小于12000" → 三条件', () => {
    const intent = parser.parse('销售部绩效大于0.8工资小于12000', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(3);
  });

  it('测试4: "技术部员工" → 应解析为部门=技术部', () => {
    const intent = parser.parse('筛选技术部员工', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(1);
    expect(intent.filters![0].column).toBe('部门');
    expect(intent.filters![0].value).toBe('技术部');
  });

  it('测试5: OR 逻辑 — "工资>10000或绩效>0.9"', () => {
    const intent = parser.parse('筛选工资>10000或绩效>0.9', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(2);
    // At least one condition should have OR logic
    const hasOr = intent.filters!.some(f => f.logic === 'OR');
    expect(hasOr).toBe(true);
  });

  it('测试6: 技术部基本工资>=13000且绩效>0.8', () => {
    const intent = parser.parse('筛选技术部基本工资>=13000且绩效>0.8', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(3);
  });

  it('测试7: AND 条件保持兼容 — "筛选部门是技术部"', () => {
    const intent = parser.parse('筛选部门是技术部', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(1);
  });

  it('测试8: 条件值作为列名不覆盖 — "技术部"不能被当成列名', () => {
    const intent = parser.parse('技术部', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(1);
    // 技术部应该被解析为值，不是列名
    expect(intent.filters![0].column).toBe('部门');
    expect(intent.filters![0].value).toBe('技术部');
  });

  it('测试9: 没有行数据时也能解析多条件', () => {
    // 无 rows → FieldResolver 无法做值反转, 但条件数量必须保留
    const intent = parser.parse('筛选技术部基本工资大于15000', employeeColumns, []);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    // 即使没有行数据，也应该有2个条件（数量保留）
    expect(intent.filters!.length).toBe(2);
  });

  it('测试10: "销售部基本工资小于8000" → 部门=销售部 AND 基本工资<8000', () => {
    const intent = parser.parse('筛选销售部基本工资小于8000', employeeColumns, [], sampleRows);
    expect(intent.operation).toBe('filter');
    expect(intent.filters).toBeDefined();
    expect(intent.filters!.length).toBe(2);

    const deptCond = intent.filters!.find(f => f.column === '部门');
    expect(deptCond).toBeDefined();
    expect(deptCond!.value).toBe('销售部');

    const salaryCond = intent.filters!.find(f => f.column === '基本工资');
    expect(salaryCond).toBeDefined();
    expect(salaryCond!.operator === 'lt' || salaryCond!.operator === 'lte').toBe(true);
  });
});
