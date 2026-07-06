import { describe, it, expect } from 'vitest';
import {
  auditStats,
  auditDuplicates,
  auditNulls,
  auditAnomalies,
  autoFixRows,
  computeQualityScore,
  generateSuggestions,
  runAudit,
} from '../audit-engine';
import { ColumnDef, RowData, DuplicateFinding, NullFinding, AnomalyFinding } from '../types';

function col(key: string, type: ColumnDef['type'] = 'text'): ColumnDef {
  return { key, title: key, type };
}

// ============================================================
// auditStats
// ============================================================
describe('auditStats', () => {
  it('基础统计计数', () => {
    const columns = [col('name'), col('amount', 'number')];
    const rows: RowData[] = [
      { name: '张三', amount: 100 },
      { name: null, amount: null },
    ];
    const stats = auditStats(rows, columns);
    expect(stats.totalRows).toBe(2);
    expect(stats.totalCols).toBe(2);
    expect(stats.blankCells).toBe(2);
    expect(stats.blankRows).toBe(1);
    expect(stats.numericCols).toBe(1);
    expect(stats.textCols).toBe(1);
  });
});

// ============================================================
// auditDuplicates
// ============================================================
describe('auditDuplicates', () => {
  it('检测到完全重复行', () => {
    const columns = [col('name'), col('phone')];
    const rows: RowData[] = [
      { name: '张三', phone: '13800000001' },
      { name: '李四', phone: '13800000002' },
      { name: '张三', phone: '13800000001' },
    ];
    const findings = auditDuplicates(rows, columns);
    expect(findings.length).toBe(1);
    expect(findings[0].count).toBeGreaterThanOrEqual(1);
    expect(findings[0].fieldKey).toBe('_full_row');
  });

  it('无重复时返回空', () => {
    const columns = [col('name')];
    const rows: RowData[] = [{ name: '张三' }, { name: '李四' }];
    const findings = auditDuplicates(rows, columns);
    expect(findings.length).toBe(0);
  });
});

// ============================================================
// auditNulls
// ============================================================
describe('auditNulls', () => {
  it('检测姓名/手机号列空值', () => {
    const columns = [col('姓名'), col('手机号'), col('备注')];
    const rows: RowData[] = [
      { 姓名: '张三', 手机号: '13800000001', 备注: null },
      { 姓名: null, 手机号: null, 备注: '有备注' },
    ];
    const findings = auditNulls(rows, columns);
    // 姓名、手机号、备注都被检测（备注 50% 空值率 > 10% 阈值）
    expect(findings.length).toBe(3);
  });
});

// ============================================================
// auditAnomalies
// ============================================================
describe('auditAnomalies', () => {
  it('识别非法手机号', () => {
    const columns = [col('手机号')];
    const rows: RowData[] = [
      { 手机号: '13800138000' },
      { 手机号: '12345678901' },  // 不是有效手机号
      { 手机号: '1380013800' },   // 位数不够
    ];
    const findings = auditAnomalies(rows, columns);
    expect(findings.length).toBeGreaterThan(0);
    const phoneFinding = findings.find((f) => f.issueType === '手机号格式异常');
    expect(phoneFinding).toBeDefined();
    expect(phoneFinding!.count).toBeGreaterThanOrEqual(1);
  });

  it('正常手机号不报错', () => {
    const columns = [col('手机号')];
    const rows: RowData[] = [
      { 手机号: '13800138000' },
      { 手机号: '15900123001' },
    ];
    const findings = auditAnomalies(rows, columns);
    expect(findings.filter((f) => f.issueType === '手机号格式异常').length).toBe(0);
  });

  it('识别非法邮箱', () => {
    const columns = [col('邮箱')];
    const rows: RowData[] = [
      { 邮箱: 'user@example.com' },
      { 邮箱: 'invalid-email' },
    ];
    const findings = auditAnomalies(rows, columns);
    expect(findings.length).toBe(1);
    expect(findings[0].issueType).toBe('邮箱格式异常');
  });

  it('识别非法身份证号', () => {
    const columns = [col('身份证号')];
    const rows: RowData[] = [
      { 身份证号: '310101199001011234' },
      { 身份证号: '123' },
    ];
    const findings = auditAnomalies(rows, columns);
    expect(findings.length).toBe(1);
    expect(findings[0].issueType).toBe('身份证号格式异常');
  });

  it('识别未来日期', () => {
    const columns = [col('日期', 'date')];
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureStr = futureDate.toISOString().split('T')[0];
    const rows: RowData[] = [
      { 日期: '2024-01-15' },
      { 日期: futureStr },
    ];
    const findings = auditAnomalies(rows, columns);
    const futureFinding = findings.find((f) => f.issueType === '未来日期');
    expect(futureFinding).toBeDefined();
  });

  it('识别负值金额', () => {
    const columns = [col('金额', 'number')];
    const rows: RowData[] = [
      { 金额: 100 },
      { 金额: -50 },
    ];
    const findings = auditAnomalies(rows, columns);
    const negFinding = findings.find((f) => f.issueType === '负值金额');
    expect(negFinding).toBeDefined();
    expect(negFinding!.count).toBe(1);
  });

  it('金额格式异常（货币符号）可自动修复', () => {
    const columns = [col('金额', 'number')];
    const rows: RowData[] = [
      { 金额: '￥1,200' as unknown as number },
    ];
    const findings = auditAnomalies(rows, columns);
    const fmtFinding = findings.find((f) => f.issueType === '金额格式异常');
    expect(fmtFinding).toBeDefined();
    expect(fmtFinding!.canAutoFix).toBe(true);
    expect(fmtFinding!.records[0].fixedValue).toBe('1200');
  });
});

// ============================================================
// autoFixRows
// ============================================================
describe('autoFixRows', () => {
  it('自动修复手机号中的空格和横线', () => {
    const rows: RowData[] = [{ 手机号: '138-0001-0001' }];
    const anomalies: AnomalyFinding[] = [{
      fieldKey: '手机号',
      fieldLabel: '手机号',
      issueType: '手机号格式异常',
      count: 1,
      affectedRows: [0],
      canAutoFix: true,
      records: [{ rowIndex: 0, fieldKey: '手机号', fieldLabel: '手机号', originalValue: '138-0001-0001', issueType: '手机号格式异常', issueReason: '包含非法字符', canAutoFix: true, fixedValue: '13800010001' }],
    }];
    const result = autoFixRows(rows, anomalies);
    expect(result.fixedRows[0].手机号).toBe('13800010001');
    expect(result.fixResults.length).toBe(1);
  });
});

// ============================================================
// computeQualityScore
// ============================================================
describe('computeQualityScore', () => {
  it('干净数据满分为100', () => {
    const stats = { totalRows: 100, totalCols: 5, blankCells: 0, blankRows: 0, numericCols: 2, textCols: 2, dateCols: 1 };
    const result = computeQualityScore(stats, [], [], []);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('优秀');
  });

  it('大量空值应降低评分', () => {
    const stats = { totalRows: 10, totalCols: 5, blankCells: 30, blankRows: 5, numericCols: 2, textCols: 2, dateCols: 1 };
    const result = computeQualityScore(stats, [], [], []);
    expect(result.score).toBeLessThan(80);
  });
});

// ============================================================
// runAudit 集成测试
// ============================================================
describe('runAudit', () => {
  it('完整检测流程返回报告', () => {
    const columns = [col('姓名'), col('手机号')];
    const rows: RowData[] = [
      { 姓名: '张三', 手机号: '13800138000' },
      { 姓名: '张三', 手机号: '13800138000' },
      { 姓名: null, 手机号: 'abc' },
    ];
    const report = runAudit(rows, columns);
    expect(report.stats).toBeDefined();
    expect(report.qualityScore).toBeDefined();
    expect(report.qualityGrade).toBeDefined();
    // 有重复、有空值、有异常
    expect(report.duplicates.length + report.nulls.length + report.anomalies.length).toBeGreaterThan(0);
  });
});
