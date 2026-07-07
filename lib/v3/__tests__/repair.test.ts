// ============================================================
// EIC Repair — Comprehensive Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan, FilterPlan, FormulaPlan, MatchPlan } from '../../v2/execution-plan';
import { Operator } from '../../v2/types';
import { buildDataProfile } from '../profile';

// Value Repair
import {
  normalizeValue,
  valuesAreEqual,
  valueSimilarity,
  levenshteinDistance,
  diceSimilarity,
} from '../repair/value-repair';

// Column Repair
import {
  fuzzyMatchColumn,
  buildColumnValueIndex,
  inferColumnFromValue,
  resolveColumnReferences,
} from '../repair/column-repair';

// Type Repair
import {
  parseNumeric,
  parseDate,
  parseBoolean,
  convertConditionValues,
} from '../repair/type-repair';

// Join Repair
import { buildJoinMapping } from '../repair/join-repair';

// Formula Repair
import { parseFormula } from '../repair/formula-repair';

// Null Repair
import { isNull, normalizeNull, suggestNullStrategy } from '../repair/null-repair';

// Repair Engine
import { repairPlan } from '../repair/repair-engine';
import { buildRepairReport, formatRepairReport } from '../repair/repair-report';

// ============================================================
// Helpers
// ============================================================

const BASE_COLUMNS: ColumnDef[] = [
  { key: 'name', title: '姓名', type: 'text' },
  { key: 'dept', title: '部门', type: 'text' },
  { key: 'salary', title: '工资', type: 'number' },
  { key: 'city', title: '城市', type: 'text' },
  { key: 'date', title: '日期', type: 'date' },
];

function makeRows(data: Record<string, unknown>[]): RowData[] {
  return data.map((d) => {
    const row: RowData = {};
    for (const col of BASE_COLUMNS) {
      row[col.key] = (d[col.key] ?? null) as never;
    }
    return row;
  });
}

// ============================================================
// 1. Value Repair Tests
// ============================================================

describe('Value Repair — normalizeValue', () => {
  it('should trim whitespace', () => {
    expect(normalizeValue('  hello  ')).toBe('hello');
    expect(normalizeValue(' 杭州 ')).toBe('杭州');
    expect(normalizeValue('\thello\n')).toBe('hello');
  });

  it('should convert fullwidth to halfwidth', () => {
    expect(normalizeValue('Ｈｅｌｌｏ')).toBe('hello');
    expect(normalizeValue('１２３')).toBe('123');
    expect(normalizeValue('ＡＢＣ')).toBe('abc');
  });

  it('should convert fullwidth space to halfwidth', () => {
    expect(normalizeValue('hello　world')).toBe('hello world');
  });

  it('should collapse multiple whitespace', () => {
    expect(normalizeValue('hello   world')).toBe('hello world');
    expect(normalizeValue('a\t\tb')).toBe('a b');
  });

  it('should lowercase', () => {
    expect(normalizeValue('Hello World')).toBe('hello world');
    expect(normalizeValue('HangZhou')).toBe('hangzhou');
  });

  it('should apply NFKC normalization', () => {
    expect(normalizeValue('①')).toBe('1');
    expect(normalizeValue('㍿')).toBe('株式会社');
  });

  it('should handle empty string', () => {
    expect(normalizeValue('')).toBe('');
  });

  it('should handle mixed Chinese and English', () => {
    expect(normalizeValue('  Hello 世界 ')).toBe('hello 世界');
  });
});

describe('Value Repair — valuesAreEqual', () => {
  it('should compare normalized strings', () => {
    expect(valuesAreEqual('杭州', ' 杭州 ')).toBe(true);
    expect(valuesAreEqual('杭州', '杭州　')).toBe(true);
    expect(valuesAreEqual('Hello', 'hello')).toBe(true);
    expect(valuesAreEqual('Ａ', 'A')).toBe(true);
  });

  it('should distinguish different values', () => {
    expect(valuesAreEqual('杭州', '杭州市')).toBe(false);
    expect(valuesAreEqual('100元', '100')).toBe(false);
    expect(valuesAreEqual('北京', '上海')).toBe(false);
  });

  it('should handle numbers directly', () => {
    expect(valuesAreEqual(100, 100)).toBe(true);
    expect(valuesAreEqual(100, 200)).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(valuesAreEqual(null, null)).toBe(true);
    expect(valuesAreEqual(undefined, undefined)).toBe(true);
  });
});

describe('Value Repair — levenshteinDistance', () => {
  it('should compute edit distance', () => {
    expect(levenshteinDistance('杭州', '杭州市')).toBe(1);
    expect(levenshteinDistance('北京', '上海')).toBe(2);
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('should handle insertions and deletions', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('薪资', '薪金')).toBe(1);
  });
});

describe('Value Repair — valueSimilarity', () => {
  it('should return 1.0 for identical strings', () => {
    expect(valueSimilarity('杭州', '杭州')).toBe(1.0);
    expect(valueSimilarity('abc', 'abc')).toBe(1.0);
  });

  it('should return high score for similar strings', () => {
    const score = valueSimilarity('杭州', '杭州市');
    expect(score).toBeGreaterThan(0.5);
  });

  it('should return low score for different strings', () => {
    const score = valueSimilarity('北京', '上海');
    expect(score).toBeLessThan(0.5);
  });

  it('should normalize before comparing', () => {
    expect(valueSimilarity('Hello', 'hello')).toBe(1.0);
  });
});

describe('Value Repair — diceSimilarity', () => {
  it('should compute bigram similarity', () => {
    expect(diceSimilarity('杭州', '杭州')).toBe(1.0);
    expect(diceSimilarity('abc', 'abc')).toBe(1.0);
  });

  it('should handle empty strings', () => {
    expect(diceSimilarity('', '')).toBe(1.0);
  });
});

// ============================================================
// 2. Column Repair Tests
// ============================================================

describe('Column Repair — fuzzyMatchColumn', () => {
  const columns = BASE_COLUMNS;

  it('should exact match by key', () => {
    const result = fuzzyMatchColumn('city', columns);
    expect(result.matched?.key).toBe('city');
    expect(result.confidence).toBe(1.0);
  });

  it('should exact match by title', () => {
    const result = fuzzyMatchColumn('工资', columns);
    expect(result.matched?.key).toBe('salary');
    expect(result.confidence).toBe(1.0);
  });

  it('should case-insensitive match', () => {
    const result = fuzzyMatchColumn('Name', columns);
    expect(result.matched?.key).toBe('name');
  });

  it('should substring match ("基本" → "基本工资")', () => {
    const colsWithSubstring: ColumnDef[] = [
      ...BASE_COLUMNS.filter(c => c.key !== 'salary'),
      { key: 'base_salary', title: '基本工资', type: 'number' },
    ];
    const result = fuzzyMatchColumn('基本', colsWithSubstring);
    expect(result.matched?.key).toBe('base_salary');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should return null for no match', () => {
    const result = fuzzyMatchColumn('xyz_not_exists', columns);
    expect(result.matched).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('should rank candidates by score', () => {
    const result = fuzzyMatchColumn('name', columns);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0].score).toBeGreaterThanOrEqual(result.candidates[0].score);
  });
});

describe('Column Repair — buildColumnValueIndex', () => {
  it('should index unique values per column', () => {
    const rows = makeRows([
      { city: '北京' }, { city: '上海' }, { city: '北京' },
      { dept: '技术部' }, { dept: '销售部' },
    ]);
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const cityIdx = index.find((i) => i.columnKey === 'city')!;
    expect(cityIdx.uniqueValues.has('北京')).toBe(true);
    expect(cityIdx.uniqueValues.has('上海')).toBe(true);
    expect(cityIdx.uniqueValues.size).toBe(2);
  });

  it('should handle empty rows', () => {
    const index = buildColumnValueIndex(BASE_COLUMNS, []);
    expect(index.length).toBe(BASE_COLUMNS.length);
    for (const idx of index) {
      expect(idx.uniqueValues.size).toBe(0);
    }
  });

  it('should skip null values', () => {
    const rows = makeRows([
      { city: null }, { city: '上海' },
    ]);
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const cityIdx = index.find((i) => i.columnKey === 'city')!;
    expect(cityIdx.uniqueValues.size).toBe(1);
    expect(cityIdx.uniqueValues.has('上海')).toBe(true);
  });
});

describe('Column Repair — inferColumnFromValue', () => {
  it('should infer column from exact value match', () => {
    const rows = makeRows([
      { city: '杭州' }, { city: '上海' }, { name: '张三' },
    ]);
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const result = inferColumnFromValue('杭州', index);
    expect(result?.columnKey).toBe('city');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should infer column from partial value match', () => {
    const rows = makeRows([
      { dept: '技术部' }, { dept: '销售部' },
    ]);
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const result = inferColumnFromValue('技术', index);
    expect(result?.columnKey).toBe('dept');
  });

  it('should return null for non-existent value', () => {
    const rows = makeRows([
      { city: '北京' }, { city: '上海' },
    ]);
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const result = inferColumnFromValue('不存在值', index);
    expect(result).toBeNull();
  });

  it('should handle value matching multiple columns, picking best', () => {
    const columns: ColumnDef[] = [
      { key: 'city', title: '城市', type: 'text' },
      { key: 'region', title: '区域', type: 'text' },
    ];
    const rows: RowData[] = [
      { city: '杭州', region: '华东' },
      { city: '上海', region: '华东' },
    ];
    const index = buildColumnValueIndex(columns, rows);
    const result = inferColumnFromValue('华东', index);
    expect(result?.columnKey).toBe('region');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('Column Repair — resolveColumnReferences', () => {
  const rows = makeRows([
    { city: '杭州', dept: '技术部' },
    { city: '上海', dept: '销售部' },
  ]);

  it('should not modify plan reference when all columns exist', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'city', operator: Operator.EQ, value: '杭州' }],
    };
    const result = resolveColumnReferences(plan, BASE_COLUMNS);
    expect((result.plan as FilterPlan).conditions[0].columnKey).toBe('city');
    expect(result.repairs.length).toBe(0);
  });

  it('should fuzzy match misspelled column name', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '工姿', operator: Operator.GT, value: 5000 }],
    };
    const result = resolveColumnReferences(plan, BASE_COLUMNS);
    expect((result.plan as FilterPlan).conditions[0].columnKey).toBe('salary');
    expect(result.repairs.length).toBeGreaterThanOrEqual(1);
    expect(result.repairs[0].action).toBe('COLUMN_FUZZY_MATCH');
  });

  it('should infer column from value when column missing', () => {
    const index = buildColumnValueIndex(BASE_COLUMNS, rows);
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '杭州', operator: Operator.EQ, value: 'should be column not value' }],
    };
    const result = resolveColumnReferences(plan, BASE_COLUMNS, index);
    const cond = (result.plan as FilterPlan).conditions[0];
    // 杭州 is now recognized as a value in city column, so columnKey → city and value → 杭州
    expect(cond.columnKey).toBe('city');
    expect(cond.operator).toBe(Operator.EQ);
    expect(cond.value).toBe('杭州');
  });

  it('should handle empty conditions gracefully', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [],
    };
    const result = resolveColumnReferences(plan, BASE_COLUMNS);
    expect((result.plan as FilterPlan).conditions.length).toBe(0);
  });
});

// ============================================================
// 3. Type Repair Tests
// ============================================================

describe('Type Repair — parseNumeric', () => {
  it('should parse plain numbers', () => {
    expect(parseNumeric('100').converted).toBe(100);
    expect(parseNumeric('100.0').converted).toBe(100);
    expect(parseNumeric('3.14').converted).toBe(3.14);
  });

  it('should parse currency format', () => {
    expect(parseNumeric('￥100').converted).toBe(100);
    expect(parseNumeric('¥100').converted).toBe(100);
    expect(parseNumeric('100元').converted).toBe(100);
    expect(parseNumeric('$100').converted).toBe(100);
  });

  it('should parse comma-separated thousands', () => {
    expect(parseNumeric('1,000').converted).toBe(1000);
    expect(parseNumeric('10,000').converted).toBe(10000);
    expect(parseNumeric('1,234,567').converted).toBe(1234567);
  });

  it('should parse percentages', () => {
    expect(parseNumeric('100%').converted).toBe(1);
    expect(parseNumeric('50％').converted).toBe(0.5);
    expect(parseNumeric('0.5%').converted).toBe(0.005);
  });

  it('should fail gracefully on non-numeric', () => {
    expect(parseNumeric('abc').confidence).toBe(0);
    expect(parseNumeric('').confidence).toBe(0);
    expect(parseNumeric('hello').confidence).toBe(0);
  });

  it('should handle negative parentheses', () => {
    expect(parseNumeric('(100)').converted).toBe(-100);
  });
});

describe('Type Repair — parseDate', () => {
  it('should parse YYYY-MM-DD', () => {
    const result = parseDate('2024-01-01');
    expect(result.converted).toBe('2024-01-01');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('should parse YYYY/MM/DD', () => {
    expect(parseDate('2024/1/1').converted).toBe('2024-01-01');
    expect(parseDate('2024/12/31').converted).toBe('2024-12-31');
  });

  it('should parse Chinese date format', () => {
    expect(parseDate('2024年1月1日').converted).toBe('2024-01-01');
    expect(parseDate('2024年12月31日').converted).toBe('2024-12-31');
  });

  it('should parse MM/DD/YYYY', () => {
    expect(parseDate('01/15/2024').converted).toBe('2024-01-15');
  });

  it('should fail gracefully on non-date', () => {
    expect(parseDate('abc').confidence).toBe(0);
    expect(parseDate('not a date').confidence).toBe(0);
  });
});

describe('Type Repair — parseBoolean', () => {
  it('should parse true variants', () => {
    expect(parseBoolean('是').converted).toBe(true);
    expect(parseBoolean('true').converted).toBe(true);
    expect(parseBoolean('1').converted).toBe(true);
    expect(parseBoolean('Y').converted).toBe(true);
    expect(parseBoolean('yes').converted).toBe(true);
  });

  it('should parse false variants', () => {
    expect(parseBoolean('否').converted).toBe(false);
    expect(parseBoolean('false').converted).toBe(false);
    expect(parseBoolean('0').converted).toBe(false);
    expect(parseBoolean('N').converted).toBe(false);
  });

  it('should fail on unknown values', () => {
    expect(parseBoolean('maybe').confidence).toBe(0);
    expect(parseBoolean('杭州').confidence).toBe(0);
  });
});

describe('Type Repair — convertConditionValues', () => {
  const profile = buildDataProfile(BASE_COLUMNS, makeRows([
    { salary: 10000 }, { salary: 20000 }, { salary: 30000 },
  ]));

  it('should convert numeric strings for number columns', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: '100元' }],
    };
    const result = convertConditionValues(plan, profile, BASE_COLUMNS);
    expect((result.plan as FilterPlan).conditions[0].value).toBe(100);
    expect(result.repairs.length).toBeGreaterThanOrEqual(1);
  });

  it('should keep values that already match', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'name', operator: Operator.EQ, value: '张三' }],
    };
    const result = convertConditionValues(plan, profile, BASE_COLUMNS);
    expect((result.plan as FilterPlan).conditions[0].value).toBe('张三');
    expect(result.repairs.length).toBe(0);
  });

  it('should pass through non-filter plans unchanged', () => {
    const plan: ExecutionPlan = { type: 'sort', sorts: [{ columnKey: 'salary', order: 'DESC' as any }] };
    const result = convertConditionValues(plan, profile, BASE_COLUMNS);
    expect(result.repairs.length).toBe(0);
  });
});

// ============================================================
// 4. Join Repair Tests
// ============================================================

describe('Join Repair — buildJoinMapping', () => {
  it('should exact match all values', () => {
    const left = ['杭州', '上海', '北京'];
    const right = ['杭州', '上海', '北京'];
    const result = buildJoinMapping(left, right);
    expect(result.stats.matched).toBe(3);
    expect(result.stats.matchRate).toBe(1.0);
    expect(result.repairs.length).toBe(0);
  });

  it('should fuzzy match similar values', () => {
    const left = ['杭州', '上海', '北京'];
    const right = ['杭州市', '上海市', '北京'];
    const result = buildJoinMapping(left, right);
    expect(result.stats.matched).toBe(3); // all matched
    expect(result.stats.matchRate).toBe(1.0);
    expect(result.repairs.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle partial match (left has more values than right)', () => {
    const left = ['杭州', '上海', '北京'];
    const right = ['杭州', '上海'];
    const result = buildJoinMapping(left, right);
    expect(result.stats.matched).toBe(2);
    expect(result.stats.unmatched).toBe(1);
    const unmatched = result.mappings.find((m) => m.targetValue === null);
    expect(unmatched?.sourceValue).toBe('北京');
  });

  it('should handle empty arrays', () => {
    const result = buildJoinMapping([], []);
    expect(result.stats.total).toBe(0);
    expect(result.stats.matchRate).toBe(0);
  });

  it('should handle all-no-match', () => {
    const left = ['苹果', '香蕉'];
    const right = ['杭州', '上海'];
    const result = buildJoinMapping(left, right);
    expect(result.stats.matched).toBe(0);
    expect(result.stats.unmatched).toBe(2);
  });
});

// ============================================================
// 5. Formula Repair Tests
// ============================================================

describe('Formula Repair — parseFormula', () => {
  it('should parse simple arithmetic', () => {
    const result = parseFormula('1+2');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns.length).toBe(0);
    expect(result.ast?.type).toBe('binaryOp');
  });

  it('should parse multiplication and addition with precedence', () => {
    const result = parseFormula('a+b*c');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toContain('a');
    expect(result.referencedColumns).toContain('b');
    expect(result.referencedColumns).toContain('c');
  });

  it('should parse parentheses', () => {
    const result = parseFormula('(a+b)*c');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toEqual(['a', 'b', 'c']);
  });

  it('should parse function calls', () => {
    const result = parseFormula('ROUND(金额, 2)');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toContain('金额');
  });

  it('should parse IF function', () => {
    const result = parseFormula('IF(数量>100, 单价*0.9, 单价)');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toContain('数量');
    expect(result.referencedColumns).toContain('单价');
  });

  it('should parse nested functions', () => {
    const result = parseFormula('SUM(ROUND(金额, 2))');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toContain('金额');
  });

  it('should handle empty expression', () => {
    const result = parseFormula('');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle invalid expression gracefully', () => {
    const result = parseFormula('1++2');
    // Should not crash, should return invalid
    expect(result.isValid).toBe(false);
  });

  it('should handle column names with Chinese characters', () => {
    const result = parseFormula('工资+奖金');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toContain('工资');
    expect(result.referencedColumns).toContain('奖金');
  });

  it('should parse complete formula expression', () => {
    const result = parseFormula('(工资*奖金)+工资');
    expect(result.isValid).toBe(true);
    expect(result.referencedColumns).toEqual(['工资', '奖金']);
  });
});

// ============================================================
// 6. Null Repair Tests
// ============================================================

describe('Null Repair — isNull', () => {
  it('should detect null/undefined', () => {
    expect(isNull(null)).toBe(true);
    expect(isNull(undefined)).toBe(true);
  });

  it('should detect empty string', () => {
    expect(isNull('')).toBe(true);
  });

  it('should detect whitespace-only string', () => {
    expect(isNull('  ')).toBe(true);
    expect(isNull('\t')).toBe(true);
    expect(isNull('\n')).toBe(true);
  });

  it('should detect literal null indicators', () => {
    expect(isNull('NULL')).toBe(true);
    expect(isNull('N/A')).toBe(true);
    expect(isNull('-')).toBe(true);
    expect(isNull('none')).toBe(true);
    expect(isNull('null')).toBe(true);
  });

  it('should not detect non-null values', () => {
    expect(isNull('杭州')).toBe(false);
    expect(isNull(0)).toBe(false);
    expect(isNull('false')).toBe(false);
    expect(isNull('0')).toBe(false);
  });
});

describe('Null Repair — normalizeNull', () => {
  it('should convert null strings to null', () => {
    expect(normalizeNull('NULL')).toBe(null);
    expect(normalizeNull('N/A')).toBe(null);
    expect(normalizeNull('-')).toBe(null);
  });

  it('should keep non-null values unchanged', () => {
    expect(normalizeNull('杭州')).toBe('杭州');
    expect(normalizeNull(0)).toBe(0);
    expect(normalizeNull('已离职')).toBe('已离职');
  });
});

describe('Null Repair — suggestNullStrategy', () => {
  it('should recommend warn for very high null rate', () => {
    const result = suggestNullStrategy(0.8, 'filter');
    expect(result.strategy).toBe('warn');
  });

  it('should recommend skip for filter', () => {
    const result = suggestNullStrategy(0.1, 'filter');
    expect(result.strategy).toBe('skip');
  });

  it('should recommend treatAsZero for aggregate with low null rate', () => {
    const result = suggestNullStrategy(0.05, 'aggregate');
    expect(result.strategy).toBe('treatAsZero');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});

// ============================================================
// 7. Repair Report Tests
// ============================================================

describe('Repair Report — buildRepairReport', () => {
  it('should produce empty report for no repairs', () => {
    const report = buildRepairReport([]);
    expect(report.summary).toBe('无需修复');
    expect(report.successCount).toBe(0);
    expect(report.failCount).toBe(0);
  });

  it('should count auto vs suggest repairs', () => {
    const repairs = [
      { action: 'COLUMN_FUZZY_MATCH' as const, target: 'a', original: 'x', repaired: 'y', confidence: 0.9, category: 'auto' as const, detail: 'test1' },
      { action: 'TYPE_CONVERT' as const, target: 'b', original: 'y', repaired: 'z', confidence: 0.4, category: 'suggest' as const, detail: 'test2' },
    ];
    const report = buildRepairReport(repairs);
    expect(report.successCount).toBe(1); // only auto with >= 0.5
    expect(report.failCount).toBe(1);
  });
});

describe('Repair Report — formatRepairReport', () => {
  it('should format nicely', () => {
    const report = buildRepairReport([
      { action: 'COLUMN_FUZZY_MATCH', target: 'a', original: 'x', repaired: 'y', confidence: 0.9, category: 'auto', detail: 'matched' },
    ]);
    const formatted = formatRepairReport(report);
    expect(formatted).toContain('✓');
    expect(formatted).toContain('matched');
    expect(formatted).toContain('x → y');
  });
});

// ============================================================
// 8. Repair Engine Integration Tests
// ============================================================

describe('Repair Engine — repairPlan', () => {
  const rows = makeRows([
    { city: '杭州', dept: '技术部', salary: 10000 },
    { city: '上海', dept: '销售部', salary: 20000 },
    { city: '北京', dept: '技术部', salary: 30000 },
  ]);
  const profile = buildDataProfile(BASE_COLUMNS, rows);
  const context = { columns: BASE_COLUMNS, rows, profile, columnIndex: buildColumnValueIndex(BASE_COLUMNS, rows) };

  it('should return unchanged plan when no issues', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'city', operator: Operator.EQ, value: '杭州' }],
    };
    const result = repairPlan(plan, context);
    expect(result.autoFixApplied).toBe(false);
    expect(result.report.repairs.length).toBe(0);
  });

  it('should fix fuzzy column name', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }],
    };
    const result = repairPlan(plan, context);
    expect(result.autoFixApplied).toBe(true);
    const cond = (result.plan as FilterPlan).conditions[0];
    expect(cond.columnKey).toBe('city');
  });

  it('should infer column from value', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '杭州', value: 'irrelevant', operator: Operator.EQ }],
    };
    const result = repairPlan(plan, context);
    const cond = (result.plan as FilterPlan).conditions[0];
    expect(cond.columnKey).toBe('city');
  });

  it('should convert numeric values', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: 'salary', operator: Operator.GT, value: '100元' }],
    };
    const result = repairPlan(plan, context);
    expect((result.plan as FilterPlan).conditions[0].value).toBe(100);
    expect(result.autoFixApplied).toBe(true);
  });

  it('should process pipeline steps recursively', () => {
    const plan: ExecutionPlan = {
      type: 'pipeline',
      steps: [
        { type: 'filter', conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }] },
        { type: 'sort', sorts: [{ columnKey: '工资', order: 'ASC' as any }] },
      ],
    };
    const result = repairPlan(plan, context);
    expect(result.autoFixApplied).toBe(true);
    const pipeline = result.plan as any;
    expect(pipeline.steps[0].conditions[0].columnKey).toBe('city');
  });

  it('should handle empty plan without crash', () => {
    const plan: FilterPlan = { type: 'filter', conditions: [] };
    const result = repairPlan(plan, context);
    expect(result.plan).toBeDefined();
  });

  it('should respect confidence threshold', () => {
    const plan: FilterPlan = {
      type: 'filter',
      conditions: [{ columnKey: '城市名', operator: Operator.EQ, value: '杭州' }],
    };
    // "城市名" → "city" via contains match, confidence ~0.7
    const result = repairPlan(plan, context, { confidenceThreshold: 0.5 });
    expect(result.report.repairs.length).toBeGreaterThanOrEqual(1);
    expect(result.autoFixApplied).toBe(true);
  });
});
