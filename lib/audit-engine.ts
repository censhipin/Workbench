import {
  ColumnDef, RowData,
  AuditStats, DuplicateFinding, NullFinding,
  AnomalyFinding, AnomalyRecord, DuplicateRecord, NullRecord,
  FixSuggestion, FixResult, AuditReport,
} from './types';

type SeenEntry = { count: number; firstIdx: number; dupRows: number[]; sample: RowData };

// ---- 基础统计 ----
export function auditStats(rows: RowData[], columns: ColumnDef[]): AuditStats {
  let blankCells = 0, blankRows = 0;
  let numericCols = 0, textCols = 0, dateCols = 0;
  for (let ci = 0; ci < columns.length; ci++) {
    if (columns[ci].type === 'number') numericCols++;
    else if (columns[ci].type === 'date') dateCols++;
    else textCols++;
  }
  for (let ri = 0; ri < rows.length; ri++) {
    let hasValue = false;
    for (let ci2 = 0; ci2 < columns.length; ci2++) {
      const v = rows[ri][columns[ci2].key];
      if (v === null || v === undefined || String(v).trim() === '') blankCells++;
      else hasValue = true;
    }
    if (!hasValue) blankRows++;
  }
  return { totalRows: rows.length, totalCols: columns.length, blankCells, blankRows, numericCols, textCols, dateCols };
}

// ---- 重复检测（整行全列匹配 + 行级详情） ----
export function auditDuplicates(rows: RowData[], columns: ColumnDef[]): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  if (columns.length === 0 || rows.length === 0) return findings;

  // sig → { count, firstRowIndex, sample }
  const seen = new Map<string, SeenEntry>();
  for (let ri = 0; ri < rows.length; ri++) {
    const parts: string[] = [];
    for (let ci = 0; ci < columns.length; ci++) parts.push(String(rows[ri][columns[ci].key] ?? ''));
    const sig = parts.join('||');
    if (!sig.trim()) continue;
    const prev = seen.get(sig);
    if (prev) { prev.count++; prev.dupRows.push(ri); }
    else seen.set(sig, { count: 1, firstIdx: ri, dupRows: [], sample: rows[ri] });
  }

  const allRecords: DuplicateRecord[] = [];
  const sampleStrs: string[] = [];
  seen.forEach((info: SeenEntry) => {
    if (info.count > 1) {
      for (let di = 0; di < info.dupRows.length; di++) {
        const rowIdx = info.dupRows[di];
        const vals: Record<string, string> = {};
        for (let ci = 0; ci < columns.length; ci++) vals[columns[ci].title] = String(rows[rowIdx][columns[ci].key] ?? '');
        allRecords.push({ rowIndex: rowIdx, duplicateOf: info.firstIdx, values: vals });
      }
    }
  });
  if (allRecords.length > 0) {
    const sampleRows: RowData[] = [];
    seen.forEach((info: SeenEntry) => { if (info.count > 1) sampleRows.push(info.sample); });
    for (let si = 0; si < Math.min(3, sampleRows.length); si++) {
      const p2: string[] = [];
      for (let ci3 = 0; ci3 < columns.length; ci3++) p2.push(columns[ci3].title + '=' + (sampleRows[si][columns[ci3].key] ?? '-'));
      sampleStrs.push(p2.join(', '));
    }
    findings.push({ fieldKey: '_full_row', fieldLabel: '整行', count: allRecords.length, sampleValues: sampleStrs, records: allRecords });
  }
  return findings;
}

// ---- 列名匹配辅助 ----

/** 文本字段关键词集合（空值检测目标） */
var NULL_TARGET_KEYWORDS = [
  '姓名', '名称', '名字', '手机', '电话', '身份证', '证件', '邮箱', '邮件',
  'email', '地址', '联系', '负责人', '客户', '供应商',
];

function matchKeyword(label: string, keywords: string[]): boolean {
  var lower = label.toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    if (lower.indexOf(keywords[i]) >= 0) return true;
  }
  return false;
}

// ---- 空值检测（行级详情 + 覆盖所有列） ----
export function auditNulls(rows: RowData[], columns: ColumnDef[]): NullFinding[] {
  const findings: NullFinding[] = [];
  const checked = new Set<string>();

  // Tier 1: 检查关键词匹配列（姓名、手机、邮箱等 PII 字段）
  const targets: ColumnDef[] = [];
  for (let ci = 0; ci < columns.length; ci++) {
    const l = columns[ci].title.toLowerCase();
    if (matchKeyword(l, NULL_TARGET_KEYWORDS)) {
      targets.push(columns[ci]);
      checked.add(columns[ci].key);
    }
  }

  // Tier 2: 如果没有任何列匹配关键词 → 取空值率最高的文本列
  if (targets.length === 0) {
    var bestCol: ColumnDef | null = null;
    var bestRate = 0;
    for (let ci = 0; ci < columns.length; ci++) {
      if (columns[ci].type !== 'number' && !checked.has(columns[ci].key)) {
        var nulls = 0;
        for (let ri = 0; ri < Math.min(rows.length, 100); ri++) {
          var v = rows[ri][columns[ci].key];
          if (v === null || v === undefined || String(v).trim() === '') nulls++;
        }
        var rate = rows.length > 0 ? nulls / Math.min(rows.length, 100) : 0;
        if (rate > bestRate) { bestRate = rate; bestCol = columns[ci]; }
      }
    }
    if (bestCol) { targets.push(bestCol); checked.add(bestCol.key); }
  }

  // Tier 1: 收集 tier1 列的空值
  for (let ti = 0; ti < targets.length; ti++) {
    const col = targets[ti];
    const records: NullRecord[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const v = rows[ri][col.key];
      if (v === null || v === undefined || String(v).trim() === '') {
        records.push({ rowIndex: ri, fieldKey: col.key, fieldLabel: col.title });
      }
    }
    if (records.length > 0) {
      findings.push({ fieldKey: col.key, fieldLabel: col.title, missingCount: records.length, records: records });
    }
  }

  // Tier 3: 扫描所有未检查列（包括数值列），只要有空值就报告
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    if (checked.has(col.key)) continue;

    let nullCount = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const v = rows[ri][col.key];
      if (v === null || v === undefined || String(v).trim() === '') nullCount++;
    }

    if (nullCount > 0) {
      const records: NullRecord[] = [];
      for (let ri = 0; ri < rows.length; ri++) {
        const v = rows[ri][col.key];
        if (v === null || v === undefined || String(v).trim() === '') {
          records.push({ rowIndex: ri, fieldKey: col.key, fieldLabel: col.title });
        }
      }
      findings.push({ fieldKey: col.key, fieldLabel: col.title, missingCount: records.length, records });
    }
  }

  return findings;
}

// ---- 表格值验证 ----
function isValidPhone(v: string): boolean {
  return /^1\d{10}$/.test(v.replace(/[\s\-()（）]/g, ''));
}
function isValidIdCard(v: string): boolean {
  return /^\d{17}[\dXx]?$/.test(v.replace(/\s/g, ''));
}
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function isValidDate(v: string): boolean {
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) return false;
  return !isNaN(new Date(v).getTime());
}
function isFutureDate(v: string): boolean {
  return new Date(v) > new Date(new Date().setHours(0, 0, 0, 0));
}
var AMOUNT_KEYWORDS = ['金额', '工资', '收入', '价格', '奖金', '补贴', '单价', '费用', '成本', '合计', '总计', '总额', '小计'];

function isAmountLike(label: string): boolean {
  return matchKeyword(label, AMOUNT_KEYWORDS);
}

// ---- 中文数字 → 阿拉伯数字 ----
const CN_DIGITS: Record<string, number> = {
  '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9, '貳': 2, '參': 3,
};
const CN_SCALES: Record<string, number> = {
  '十': 10, '百': 100, '千': 1000, '拾': 10, '佰': 100, '仟': 1000, '萬': 10000, '万': 10000, '亿': 100000000, '億': 100000000,
};

/** 将中文数字字符串转为阿拉伯数字，无法转换时返回 null */
export function chineseToNumber(str: string): number | null {
  let s = str.trim().replace(/[约大概左右多余元圆块钱毛分整\s\-]/g, '').trim();
  if (!s) return null;

  // 检查是否包含中文数字字符
  if (![...s].some(c => c in CN_DIGITS || c in CN_SCALES)) return null;

  let negative = false;
  if (s.startsWith('负') || s.startsWith('負')) {
    negative = true;
    s = s.slice(1);
  }

  let total = 0;
  let current = 0;
  let num = 0;
  let lastScale = 0;
  let i = 0;

  while (i < s.length) {
    const c = s[i];

    if (c >= '0' && c <= '9') {
      // 阿拉伯数字：收集连续数字段
      let digitStr = '';
      while (i < s.length && s[i] >= '0' && s[i] <= '9') {
        digitStr += s[i];
        i++;
      }
      const digitNum = parseInt(digitStr, 10);
      // 有 scale 挂载到当前段，否则直接加到 current
      if (lastScale > 0 && lastScale < 10000) {
        current += (num || 0) * lastScale + digitNum;
        num = 0;
      } else {
        current += digitNum;
      }
      continue;
    }
    if (c in CN_DIGITS) {
      const d = CN_DIGITS[c];
      if (d === 0 && lastScale > 0) {
        lastScale = 0;
        num = 0;
      } else {
        num = d;
      }
    } else if (c in CN_SCALES) {
      const scale = CN_SCALES[c];
      if (scale >= 10000) {
        current += num || 0;
        total += (current || 1) * scale;
        current = 0;
        num = 0;
      } else {
        current += (num || 1) * scale;
        num = 0;
      }
      lastScale = scale;
    }
    i++;
  }

  // 处理残余数字
  if (num > 0) {
    if (lastScale >= 10000) {
      current += num * 1000;
    } else if (lastScale >= 1000) {
      current += num * 100;
    } else if (lastScale >= 100) {
      current += num * 10;
    } else {
      current += num;
    }
  }

  total += current;
  if (total === 0) return null;
  return negative ? -total : total;
}

// ---- 异常检测（行级详情 + 可修复标记） ----
export function auditAnomalies(rows: RowData[], columns: ColumnDef[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const label = col.title;
    const key = col.key;

    // 手机号
    if (matchKeyword(label, ['手机', '电话'])) {
      const records: AnomalyRecord[] = [];
      for (let i = 0; i < rows.length; i++) {
        const raw = String(rows[i][key] ?? '').trim();
        if (!raw) continue;
        if (!isValidPhone(raw)) {
          const cleaned = raw.replace(/[\s\-()（）]/g, '');
          const canFix = /^1\d{10}$/.test(cleaned);
          const reason = '号码格式错误';
          records.push({ rowIndex: i, fieldKey: key, fieldLabel: label, originalValue: raw, issueType: '手机号格式异常', issueReason: reason, canAutoFix: canFix, fixedValue: canFix ? cleaned : undefined });
        }
      }
      if (records.length > 0) {
        let allFixable = true;
        for (let ri2 = 0; ri2 < records.length; ri2++) { if (!records[ri2].canAutoFix) { allFixable = false; break; } }
        findings.push({ fieldKey: key, fieldLabel: label, issueType: '手机号格式异常', count: records.length, affectedRows: records.map((r) => r.rowIndex), records, canAutoFix: allFixable });
      }
    }

    // 身份证
    if (matchKeyword(label, ['身份证', '证件'])) {
      const records2: AnomalyRecord[] = [];
      for (let i2 = 0; i2 < rows.length; i2++) {
        const raw2 = String(rows[i2][key] ?? '').trim();
        if (!raw2) continue;
        if (!isValidIdCard(raw2)) {
          records2.push({ rowIndex: i2, fieldKey: key, fieldLabel: label, originalValue: raw2, issueType: '身份证号格式异常', issueReason: raw2.length < 18 ? '长度异常' : '格式异常', canAutoFix: false });
        }
      }
      if (records2.length > 0) findings.push({ fieldKey: key, fieldLabel: label, issueType: '身份证号格式异常', count: records2.length, affectedRows: records2.map((r) => r.rowIndex), records: records2, canAutoFix: false });
    }

    // 邮箱
    if (matchKeyword(label, ['邮箱', '邮件', 'email'])) {
      const records3: AnomalyRecord[] = [];
      for (let i3 = 0; i3 < rows.length; i3++) {
        const raw3 = String(rows[i3][key] ?? '').trim();
        if (!raw3) continue;
        if (!isValidEmail(raw3)) {
          const fixed3 = raw3.replace(/\s/g, '');
          const canFix3 = isValidEmail(fixed3);
          records3.push({ rowIndex: i3, fieldKey: key, fieldLabel: label, originalValue: raw3, issueType: '邮箱格式异常', issueReason: raw3.indexOf(' ') >= 0 ? '包含多余空格' : '格式错误', canAutoFix: canFix3, fixedValue: canFix3 ? fixed3 : undefined });
        }
      }
      if (records3.length > 0) {
        let allFixable3 = true;
        for (let ri3 = 0; ri3 < records3.length; ri3++) { if (!records3[ri3].canAutoFix) { allFixable3 = false; break; } }
        findings.push({ fieldKey: key, fieldLabel: label, issueType: '邮箱格式异常', count: records3.length, affectedRows: records3.map((r) => r.rowIndex), records: records3, canAutoFix: allFixable3 });
      }
    }

    // 日期
    if (col.type === 'date' || matchKeyword(label, ['日期', '时间'])) {
      const records4: AnomalyRecord[] = [];
      const records5: AnomalyRecord[] = [];
      for (let i4 = 0; i4 < rows.length; i4++) {
        const raw4 = String(rows[i4][key] ?? '').trim();
        if (!raw4) continue;
        if (!isValidDate(raw4)) {
          const fixed4 = raw4.replace(/\//g, '-');
          const canFix4 = isValidDate(fixed4);
          records4.push({ rowIndex: i4, fieldKey: key, fieldLabel: label, originalValue: raw4, issueType: '非法日期', issueReason: '日期格式不正确', canAutoFix: canFix4, fixedValue: canFix4 ? fixed4 : undefined });
        } else if (isFutureDate(raw4)) {
          records5.push({ rowIndex: i4, fieldKey: key, fieldLabel: label, originalValue: raw4, issueType: '未来日期', issueReason: '日期超过当前日期', canAutoFix: false });
        }
      }
      if (records4.length > 0) {
        let allFixable4 = true;
        for (let ri4 = 0; ri4 < records4.length; ri4++) { if (!records4[ri4].canAutoFix) { allFixable4 = false; break; } }
        findings.push({ fieldKey: key, fieldLabel: label, issueType: '非法日期', count: records4.length, affectedRows: records4.map((r) => r.rowIndex), records: records4, canAutoFix: allFixable4 });
      }
      if (records5.length > 0) findings.push({ fieldKey: key, fieldLabel: label, issueType: '未来日期', count: records5.length, affectedRows: records5.map((r) => r.rowIndex), records: records5, canAutoFix: false });
    }

    // 金额
    // 注意：RowData 的值可能是 string 或 number，需要统一转为数字再判断
    if (isAmountLike(label)) {
      const records6: AnomalyRecord[] = [];
      const records7: AnomalyRecord[] = [];
      for (let i5 = 0; i5 < rows.length; i5++) {
        const raw5 = rows[i5][key];
        if (raw5 === null || raw5 === undefined) continue;
        const rawStr = String(raw5).trim();
        if (!rawStr) continue;
        // 检查是否为格式异常的金额（如 '12,300' 或 '￥12,300'）
        if (/[￥,，]/.test(rawStr)) {
          const fixed5 = rawStr.replace(/[￥,，\s]/g, '');
          const num5 = Number(fixed5);
          if (!isNaN(num5)) {
            records6.push({ rowIndex: i5, fieldKey: key, fieldLabel: label, originalValue: rawStr, issueType: '金额格式异常', issueReason: '包含货币符号或千分位分隔符', canAutoFix: true, fixedValue: fixed5 });
            if (num5 < 0) records7.push({ rowIndex: i5, fieldKey: key, fieldLabel: label, originalValue: String(num5), issueType: '负值金额', issueReason: '金额为负数', canAutoFix: false });
            continue;
          }
        }
        const v5 = Number(rawStr);
        if (isNaN(v5)) continue;
        if (v5 < 0) records7.push({ rowIndex: i5, fieldKey: key, fieldLabel: label, originalValue: String(v5), issueType: '负值金额', issueReason: '金额为负数', canAutoFix: false });
      }
      if (records6.length > 0) findings.push({ fieldKey: key, fieldLabel: label, issueType: '金额格式异常', count: records6.length, affectedRows: records6.map((r) => r.rowIndex), records: records6, canAutoFix: true });
      if (records7.length > 0) findings.push({ fieldKey: key, fieldLabel: label, issueType: '负值金额', count: records7.length, affectedRows: records7.map((r) => r.rowIndex), records: records7, canAutoFix: false });
    }
  }
  return findings;
}

// ---- 列格式推断检测 -- "数据自己说话" ----
export function auditFormatMismatches(rows: RowData[], columns: ColumnDef[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const key = col.key;
    let numericCount = 0, totalValid = 0;
    const nonNumericRows: { rowIndex: number; raw: string; chineseNum: number | null }[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const raw = rows[ri][key];
      if (raw === null || raw === undefined) continue;
      const rawStr = String(raw).trim();
      if (!rawStr) continue;
      totalValid++;
      if (!isNaN(Number(rawStr))) { numericCount++; }
      else { nonNumericRows.push({ rowIndex: ri, raw: rawStr, chineseNum: chineseToNumber(rawStr) }); }
    }
    if (totalValid < 5 || numericCount / totalValid <= 0.5) continue;
    if (nonNumericRows.length > 0) {
      const records: AnomalyRecord[] = [];
      let allCanFix = true;
      for (const n of nonNumericRows) {
        const canAutoFix = n.chineseNum !== null;
        if (!canAutoFix) allCanFix = false;
        records.push({
          rowIndex: n.rowIndex, fieldKey: key, fieldLabel: col.title, originalValue: n.raw,
          issueType: '格式异常', issueReason: n.chineseNum !== null ? '包含中文数字' : '非数字格式',
          canAutoFix, fixedValue: n.chineseNum !== null ? String(n.chineseNum) : undefined,
        });
      }
      findings.push({ fieldKey: key, fieldLabel: col.title, issueType: '格式异常', count: records.length, affectedRows: records.map(r => r.rowIndex), records, canAutoFix: allCanFix });
    }
  }
  return findings;
}

// ---- 自动修复函数 ----
export function autoFixRows(rows: RowData[], anomalies: AnomalyFinding[]): { fixedRows: RowData[]; fixResults: FixResult[] } {
  const fixed = rows.map((r) => { const o: RowData = {}; Object.keys(r).forEach((k) => { o[k] = r[k]; }); return o; });
  const fixResults: FixResult[] = [];

  for (let ai = 0; ai < anomalies.length; ai++) {
    const finding = anomalies[ai];
    if (!finding.canAutoFix) continue;
    let fixedCount = 0;
    for (let ri = 0; ri < finding.records.length; ri++) {
      const rec = finding.records[ri];
      if (rec.canAutoFix && rec.fixedValue) {
        fixed[rec.rowIndex][rec.fieldKey] = rec.fixedValue;
        fixedCount++;
      }
    }
    if (fixedCount > 0) {
      fixResults.push({ fixedCount, message: '已修复 ' + finding.fieldLabel + ' — ' + finding.issueType, category: finding.fieldLabel + '异常' });
    }
  }
  return { fixedRows: fixed, fixResults };
}

// ---- 质量评分 ----
export function computeQualityScore(stats: AuditStats, duplicates: DuplicateFinding[], nulls: NullFinding[], anomalies: AnomalyFinding[]): { score: number; grade: string } {
  let score = 100;
  const blankPct = (stats.totalRows > 0 && stats.totalCols > 0) ? stats.blankCells / (stats.totalRows * stats.totalCols) : 0;
  score -= Math.min(30, blankPct * 80);
  score -= duplicates.length * 5;
  score -= nulls.length * 3;
  score -= anomalies.length * 5;
  score = Math.max(0, Math.round(score));
  const grade = score >= 95 ? '优秀' : score >= 80 ? '良好' : score >= 60 ? '一般' : '需处理';
  return { score, grade };
}

// ---- 修复建议 ----
export function generateSuggestions(duplicates: DuplicateFinding[], nulls: NullFinding[], anomalies: AnomalyFinding[]): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  let id = 0;
  for (let di = 0; di < duplicates.length; di++) {
    id++;
    suggestions.push({ id: 'sug-' + id, text: '删除重复' + duplicates[di].fieldLabel + '（共 ' + duplicates[di].count + ' 条）', fixType: 'dedup', findingKey: duplicates[di].fieldKey });
  }
  for (let ni = 0; ni < nulls.length; ni++) {
    id++;
    suggestions.push({ id: 'sug-' + id, text: '补充缺失' + nulls[ni].fieldLabel + '（共 ' + nulls[ni].missingCount + ' 条）', fixType: 'clean', findingKey: nulls[ni].fieldKey });
  }
  for (let ai = 0; ai < anomalies.length; ai++) {
    id++;
    const a = anomalies[ai];
    suggestions.push({ id: 'sug-' + id, text: (a.canAutoFix ? '修复' : '标记') + a.fieldLabel + '的"' + a.issueType + '"（共 ' + a.count + ' 条）', fixType: a.canAutoFix ? 'format' : 'clean', findingKey: a.fieldKey + '|' + a.issueType });
  }
  return suggestions;
}

// ---- 完整检测 ----
export function runAudit(rows: RowData[], columns: ColumnDef[]): AuditReport {
  const stats = auditStats(rows, columns);
  const duplicates = auditDuplicates(rows, columns);
  const nulls = auditNulls(rows, columns);
  const anomalies = auditAnomalies(rows, columns);
  // 列格式推断检测 — "数据自己说话"
  const mismatches = auditFormatMismatches(rows, columns);
  const allAnomalies = anomalies.concat(mismatches);
  const result = computeQualityScore(stats, duplicates, nulls, allAnomalies);
  const suggestions = generateSuggestions(duplicates, nulls, allAnomalies);
  return { stats, duplicates, nulls, anomalies: allAnomalies, qualityScore: result.score, qualityGrade: result.grade, suggestions };
}
