// ============================================================
// EIC Profile — 单元测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildDataProfile } from '../profile';
import type { ColumnDef, RowData } from '../../lib/types';

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

describe('EIC Profile — type-infer', () => {
  it('should infer number type when >= 80% values are numeric', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: 30000 }, { salary: '四千' }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const salaryCol = profile.columns.find((c) => c.columnKey === 'salary')!;
    expect(salaryCol.type).toBe('number');
    expect(salaryCol.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should infer string type as default', () => {
    const rows = makeRows([
      { name: '张三' }, { name: '李四' }, { name: '王五' },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const nameCol = profile.columns.find((c) => c.columnKey === 'name')!;
    expect(nameCol.type).toBe('string');
  });

  it('should infer date type when values look like dates', () => {
    const rows = makeRows([
      { date: '2024-01-01' }, { date: '2024-02-15' }, { date: '2024/03/20' }, { date: '2024年12月31日' },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const dateCol = profile.columns.find((c) => c.columnKey === 'date')!;
    expect(dateCol.type).toBe('date');
  });
});

describe('EIC Profile — null detection', () => {
  it('should detect nullCount and nullRate correctly', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: null }, { salary: 30000 }, { salary: null }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const salaryCol = profile.columns.find((c) => c.columnKey === 'salary')!;
    expect(salaryCol.nullCount).toBe(2);
    expect(salaryCol.nullRate).toBe(0.4);
  });

  it('should generate warning when nullRate > 0.3', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: null }, { salary: null }, { salary: null }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const warnings = profile.warnings.filter((w) => w.code === 'PROFILE_HIGH_NULL_RATE');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => w.columnKey === 'salary')).toBe(true);
  });

  it('should generate info when nullRate > 0.1 but <= 0.3', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: null }, { salary: 40000 }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const warnings = profile.warnings.filter((w) => w.code === 'PROFILE_NULL_EXISTS');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('EIC Profile — unique/duplicate detection', () => {
  it('should compute uniqueCount and uniqueRate', () => {
    const rows = makeRows([
      { city: '北京' }, { city: '北京' }, { city: '上海' }, { city: '上海' }, { city: '广州' },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const cityCol = profile.columns.find((c) => c.columnKey === 'city')!;
    expect(cityCol.uniqueCount).toBe(3);
    expect(cityCol.uniqueRate).toBe(0.6);
  });

  it('should detect duplicate rows', () => {
    const rows = makeRows([
      { name: '张三', dept: '技术部' },
      { name: '李四', dept: '销售部' },
      { name: '张三', dept: '技术部' },  // duplicate
      { name: '王五', dept: '技术部' },
      { name: '张三', dept: '技术部' },  // another duplicate
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    expect(profile.globalStats.duplicateRowRate).toBeGreaterThan(0);
    expect(profile.rowCount).toBe(5);
  });
});

describe('EIC Profile — numeric stats', () => {
  it('should compute min/max/avg for numeric columns', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: 30000 }, { salary: 40000 }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const salaryCol = profile.columns.find((c) => c.columnKey === 'salary')!;
    expect(salaryCol.min).toBe(10000);
    expect(salaryCol.max).toBe(50000);
    expect(salaryCol.avg).toBe(30000);
  });

  it('should skip non-numeric values in numeric stats', () => {
    const rows = makeRows([
      { salary: 'N/A' }, { salary: 20000 }, { salary: 'unknown' }, { salary: 40000 }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const salaryCol = profile.columns.find((c) => c.columnKey === 'salary')!;
    expect(salaryCol.type).toBe('unknown'); // only 3/5 numeric
  });
});

describe('EIC Profile — sample values', () => {
  it('should contain up to 5 sample values', () => {
    const rows = makeRows(Array.from({ length: 100 }, (_, i) => ({
      city: `城市${i % 10}`,
    })));
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const cityCol = profile.columns.find((c) => c.columnKey === 'city')!;
    expect(cityCol.sampleValues.length).toBeLessThanOrEqual(5);
    expect(cityCol.sampleValues.length).toBeGreaterThan(0);
  });
});

describe('EIC Profile — empty data', () => {
  it('should handle empty rows', () => {
    const profile = buildDataProfile(BASE_COLUMNS, []);
    expect(profile.rowCount).toBe(0);
    expect(profile.columns.length).toBe(BASE_COLUMNS.length);
    for (const col of profile.columns) {
      expect(col.nullCount).toBe(0);
      expect(col.uniqueCount).toBe(0);
    }
  });

  it('should handle all-null column', () => {
    const rows = makeRows([
      { salary: null }, { salary: null }, { salary: null },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const salaryCol = profile.columns.find((c) => c.columnKey === 'salary')!;
    expect(salaryCol.nullRate).toBe(1);
    expect(salaryCol.type).toBe('string');
    expect(salaryCol.confidence).toBeLessThan(0.5);
  });
});

describe('EIC Profile — type confidence', () => {
  it('should generate low confidence warning for mixed types', () => {
    const rows = makeRows([
      { salary: 10000 }, { salary: 20000 }, { salary: '三千' }, { salary: 'N/A' }, { salary: 50000 },
    ]);
    const profile = buildDataProfile(BASE_COLUMNS, rows);
    const warnings = profile.warnings.filter((w) => w.code === 'PROFILE_LOW_TYPE_CONFIDENCE');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});
