import { ColumnDef, RowData, ResultSummary } from './types';
import { evaluateCondition } from './v2/predicate';
import { Operator } from './v2/types';

// ============================================================
// Fuzzy matching utilities
// ============================================================

/** Normalize string: trim, lowercase, fullwidth->halfwidth */
export function normalizeStr(str: string): string {
  return str.trim()
    .replace(/\s+/g, '')
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .toLowerCase();
}

/** Levenshtein edit distance */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1);
    }
  }
  return dp[m][n];
}

/** Fuzzy find best match, returns original candidate; default threshold 0.85 */
export function fuzzyFind(value: string, candidates: string[], threshold = 0.85): string | null {
  const nv = normalizeStr(value);
  if (!nv) return null;
  const normed = candidates.map((c) => ({ orig: c, norm: normalizeStr(c) })).filter((x) => x.norm);
  const exact = normed.find((x) => x.norm === nv);
  if (exact) return exact.orig;
  // Limit fuzzy candidates to prevent UI freeze on large datasets
  const MAX_FUZZY = 200;
  const sampled = normed.length > MAX_FUZZY
    ? normed.slice(0, MAX_FUZZY)
    : normed;
  let bestScore = 0;
  let bestMatch: string | null = null;
  for (const { orig, norm } of sampled) {
    const dist = levenshteinDistance(nv, norm);
    const maxLen = Math.max(nv.length, norm.length);
    const sim = maxLen > 0 ? 1 - dist / maxLen : 1;
    if (sim > bestScore) { bestScore = sim; bestMatch = orig; }
  }
  return bestScore >= threshold ? bestMatch : null;
}

/** Aggregation method Chinese label */
export function aggMethodLabel(method: string): string {
  switch (method) {
    case 'SUM': return '合计';
    case 'AVG': return '平均';
    case 'COUNT': return '计数';
    case 'MAX': return '最大';
    case 'MIN': return '最小';
    default: return '聚合';
  }
}

/** Execute aggregation on a set of values */
function aggregate(values: number[], method: string, decimalPlaces?: number): number | null {
  if (values.length === 0) return null;
  let result: number;
  switch (method) {
    case 'SUM': result = values.reduce((s, v) => s + v, 0); break;
    case 'AVG': result = values.reduce((s, v) => s + v, 0) / values.length; break;
    case 'COUNT': result = values.length; break;
    case 'MAX': result = Math.max(...values); break;
    case 'MIN': result = Math.min(...values); break;
    default: result = values.reduce((s, v) => s + v, 0);
  }
  if (decimalPlaces !== undefined && Number.isFinite(result)) {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(result * factor) / factor;
  }
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : result;
}

/**
 * 鍒嗙粍鑱氬悎
 * @param rows 鏁版嵁琛? * @param groupByCols 鍒嗙粍鍒?key 鍒楄〃锛堢┖ = 涓嶅垎缁勶紝姹囨€讳负涓€琛岋級
 * @param aggCol 鑱氬悎鐩爣鍒?key
 * @param method 鑱氬悎鏂瑰紡 SUM/AVG/COUNT/MAX/MIN
 * @param allColumns 瀹屾暣鍒楀畾涔夛紙鐢ㄤ簬鑾峰彇鍒嗙粍鍒楃殑鍏冧俊鎭級
 */
export function aggregateRows(
  rows: RowData[],
  groupByCols: string[],
  aggCol: string,
  method: string,
  allColumns: ColumnDef[]
): { columns: ColumnDef[]; rows: RowData[] } {
  const suffix = aggMethodLabel(method);
  const aggDef = allColumns.find((c) => c.key === aggCol);
  const aggResultKey = aggDef ? `${aggDef.key}_${suffix}` : `agg_${suffix}`;
  const aggResultTitle = aggDef ? `${aggDef.title}_${suffix}` : `鑱氬悎缁撴灉_${suffix}`;

  // 无分组 → 全局聚合
  if (groupByCols.length === 0) {
    let resultVal: number | null;
    if (method === 'COUNT') {
      resultVal = rows.filter(r => r[aggCol] != null && r[aggCol] !== '').length;
    } else {
      const nums = rows.map((r) => r[aggCol]).filter((v) => v != null && !isNaN(Number(v))).map(Number);
      resultVal = aggregate(nums, method);
    }
    const row: RowData = {};
    row[aggResultKey] = resultVal;
    return { columns: [{ key: aggResultKey, title: aggResultTitle, type: 'number' }], rows: [row] };
  }

  // 鍒嗙粍
  const groups = new Map<string, RowData[]>();
  for (const row of rows) {
    const key = groupByCols.map((c) => String(row[c] ?? '')).join('||');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // 缁撴灉鍒楀畾涔?
 const resultCols: ColumnDef[] = groupByCols.map((c) => {
    const def = allColumns.find((x) => x.key === c);
    return def || { key: c, title: c, type: 'text' };
  });
  resultCols.push({ key: aggResultKey, title: aggResultTitle, type: 'number' });

  // 缁撴灉琛?
 const resultRows: RowData[] = [];
  for (const [gk, gRows] of groups) {
    const vals = gk.split('||');
    const row: RowData = {};
    groupByCols.forEach((c, i) => { row[c] = vals[i] || null; });
    if (method === 'COUNT') {
      // COUNT 不要求数值类型，只计非空行数
      row[aggResultKey] = gRows.filter(r => r[aggCol] != null && r[aggCol] !== '').length;
    } else {
      const nums = gRows.map((r) => r[aggCol]).filter((v) => v != null && !isNaN(Number(v))).map(Number);
      row[aggResultKey] = aggregate(nums, method);
    }
    resultRows.push(row);
  }

  return { columns: resultCols, rows: resultRows };
}

// ---- 姹傚拰 ----
export function sumColumn(rows: RowData[], columnKey: string): { total: number; count: number } {
  let total = 0, count = 0;
  for (const row of rows) {
    const v = row[columnKey];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!isNaN(n)) { total += n; count++; }
  }
  return { total, count };
}

// ---- 鎺掑簭锛堝崟鍒楋紝鍏煎锛?----
export function sortRows(rows: RowData[], columnKey: string, asc: boolean): RowData[] {
  return sortRowsMulti(rows, [{ key: columnKey, asc }]);
}

/** 澶氬垪鎺掑簭 */
export function sortRowsMulti(
  rows: RowData[],
  sorters: { key: string; asc: boolean }[]
): RowData[] {
  if (sorters.length === 0) return [...rows];
  return [...rows].sort((a, b) => {
    for (const s of sorters) {
      const va = a[s.key], vb = b[s.key];
      if (va == null && vb == null) continue;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = Number(va), nb = Number(vb);
      let cmp: number;
      if (!isNaN(na) && !isNaN(nb)) {
        cmp = na - nb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      if (cmp !== 0) return s.asc ? cmp : -cmp;
    }
    return 0;
  });
}

// ---- 绛涢€?----
export function filterRows(rows: RowData[], col: string, operator: string, value: unknown): RowData[] {
  return filterRowsMulti(rows, [{ column: col, operator, value }]);
}

/** 澶氭潯浠?AND 绛涢€?*/
export function filterRowsMulti(
  rows: RowData[],
  conditions: { column: string; operator: string; value: unknown; logic?: 'AND' | 'OR' }[]
): RowData[] {
  if (conditions.length === 0) return [...rows];

  // 将字符串 operator 转为枚举（兼容旧接口传入的字符串）
  const parsed = conditions.map((c) => ({
    column: c.column,
    operator: parseOperator(c.operator),
    value: c.value,
    logic: c.logic,
  }));

  // 按 AND/OR 边界分组
  const groups: { conds: typeof parsed; logic: 'AND' | 'OR' }[] = [];
  let currentGroup: { conds: typeof parsed; logic: 'AND' | 'OR' } = { conds: [], logic: 'AND' };
  for (const c of parsed) {
    const condLogic = c.logic || 'AND';
    if (condLogic === 'OR' && currentGroup.conds.length > 0) {
      groups.push(currentGroup);
      currentGroup = { conds: [], logic: 'OR' };
    }
    currentGroup.conds.push(c);
  }
  if (currentGroup.conds.length > 0) groups.push(currentGroup);

  // 筛选：行在任意一个组中满足所有条件即通过（OR between groups, AND within group）
  return rows.filter((row) => {
    for (const group of groups) {
      const allMatch = group.conds.every((c) =>
        evaluateCondition(row[c.column], c.operator, c.value)
      );
      if (allMatch) return true;
    }
    return false;
  });
}


/** 将字符串操作符映射为 Operator 枚举（兼容旧接口 legacy callers）*/
function parseOperator(op: string): Operator {
  const lowered = op.toLowerCase();
  const map: Record<string, Operator> = {
    eq: Operator.EQ, '=': Operator.EQ,
    neq: Operator.NE, '!=': Operator.NE, ne: Operator.NE,
    gt: Operator.GT, '>': Operator.GT,
    gte: Operator.GTE, '>=': Operator.GTE,
    lt: Operator.LT, '<': Operator.LT,
    lte: Operator.LTE, '<=': Operator.LTE,
    contains: Operator.CONTAINS,
    startswith: Operator.STARTS_WITH, starts_with: Operator.STARTS_WITH,
    endswith: Operator.ENDS_WITH, ends_with: Operator.ENDS_WITH,
    between: Operator.BETWEEN,
    in: Operator.IN,
    notin: Operator.NOT_IN, not_in: Operator.NOT_IN,
    isnull: Operator.IS_NULL, is_null: Operator.IS_NULL,
    notnull: Operator.NOT_NULL, not_null: Operator.NOT_NULL,
  };
  return map[lowered] ?? Operator.EQ;
}

export function filterByDateRange(rows: RowData[], dateCol: string, start: string, end: string): RowData[] {
  return rows.filter((row) => { const v = String(row[dateCol] ?? ''); return v >= start && v <= end; });
}

// ---- 鍘婚噸 ----
export function dedupRows(rows: RowData[], columnKeys: string[]): {
  result: RowData[]; deleted: number; duplicates: { key: string; count: number }[]
} {
  const seen = new Map<string, number>(); const result: RowData[] = [];
  for (const row of rows) {
    const k = columnKeys.length > 0
      ? columnKeys.map((c) => String(row[c] ?? '')).join('|')
      : JSON.stringify(row);
    const cnt = seen.get(k) || 0; seen.set(k, cnt + 1); if (cnt === 0) result.push(row);
  }
  const duplicates: { key: string; count: number }[] = [];
  seen.forEach((count, key) => { if (count > 1) duplicates.push({ key, count }); });
  return { result, deleted: rows.length - result.length, duplicates };
}

// ---- 鎵惧叡鍚屽垪 ----
function findCommonKey(a: ColumnDef[], b: ColumnDef[]): string | null {
  const aKeys = new Set(a.map((c) => c.key));
  for (const c of b) if (aKeys.has(c.key)) return c.key;
  return null;
}

/** 鎵惧叏閮ㄥ叡鍚屽垪 */
function findCommonKeys(a: ColumnDef[], b: ColumnDef[]): string[] {
  const aKeys = new Set(a.map((c) => c.key));
  return b.filter((c) => aKeys.has(c.key)).map((c) => c.key);
}

/** 鏋勯€犲鍒楀尮閰嶇殑澶嶅悎閿紙褰掍竴鍖?+ 鍒嗛殧绗︼級 */
function compositeKey(row: RowData, keys: string[]): string {
  return keys.map((k) => normalizeStr(String(row[k] ?? '')).replace(/\|/g, '\\|')).join('||');
}

/** 澶氬垪鍖归厤锛堝唴閮ㄧ敤锛?*/
function matchTwoMulti(
  main: { columns: ColumnDef[]; rows: RowData[] },
  lookup: { columns: ColumnDef[]; rows: RowData[] },
  matchKeys: string[]
): {
  columns: ColumnDef[]; rows: RowData[]; matched: number; unmatched: number
} {
  // 鏋勫缓澶嶅悎閿储寮?
 const normMap = new Map<string, RowData>();
  for (const row of lookup.rows) {
    const ck = compositeKey(row, matchKeys);
    if (!ck) continue;
    if (!normMap.has(ck)) { normMap.set(ck, row); }
  }

  const lkCols = lookup.columns.filter((c) => !matchKeys.includes(c.key));
  const columns: ColumnDef[] = [...main.columns, ...lkCols.map((c) => ({ ...c, key: '_lkp_' + c.key }))];
  let matched = 0;


  const mergedRows = main.rows.map((row) => {
    const ck = compositeKey(row, matchKeys);
    let lkRow = ck ? normMap.get(ck) : undefined;
    const newRow: RowData = { ...row };
    for (const lc of lkCols) newRow['_lkp_' + lc.key] = lkRow ? (lkRow[lc.key] ?? null) : null;
    if (lkRow) matched++;
    return newRow;
  });
  // Append unmatched lookup rows with _matchStatus — REMOVED: Left Join should not add unmatched right rows
  return { columns, rows: mergedRows, matched, unmatched: main.rows.length - matched };
}

// ---- 涓よ〃鍖归厤锛堝唴閮ㄧ敤锛?----
function matchTwo(
  main: { columns: ColumnDef[]; rows: RowData[] },
  lookup: { columns: ColumnDef[]; rows: RowData[] },
  matchKey: string
): {
  columns: ColumnDef[]; rows: RowData[]; matched: number; unmatched: number
} {
  // 鏋勫缓褰掍竴鍖栫储寮曪紙鍚屾椂淇濈暀鍘熷 key 鐢ㄤ簬妯＄硦鍥為€€锛?
 const normMap = new Map<string, RowData>();
  const normKeys: string[] = [];
  for (const row of lookup.rows) {
    const raw = String(row[matchKey] ?? '').trim();
    if (!raw) continue;
    const nk = normalizeStr(raw);
    if (!normMap.has(nk)) { normMap.set(nk, row); normKeys.push(nk); }
  }

  const lkCols = lookup.columns.filter((c) => c.key !== matchKey);
  const columns: ColumnDef[] = [...main.columns, ...lkCols.map((c) => ({ ...c, key: '_lkp_' + c.key }))];
  let matched = 0;
  const fuzzyCandidates = [...new Set(lookup.rows.map((r) => String(r[matchKey] ?? "").trim()).filter(Boolean))];


  // 涓昏〃琛岋細绮剧‘鍖归厤 鈫?妯＄硦鍥為€€
  const mergedRows = main.rows.map((row) => {
    const raw = String(row[matchKey] ?? '').trim();
    const nk = normalizeStr(raw);
    let lkRow = nk ? normMap.get(nk) : undefined;
    // 绮剧‘鏈懡涓?鈫?妯＄硦鏌ユ壘
    if (!lkRow && nk) {
      const fuzzyMatch = fuzzyFind(raw, fuzzyCandidates);
      if (fuzzyMatch) lkRow = normMap.get(normalizeStr(fuzzyMatch));
    }
    const newRow: RowData = { ...row };
    for (const lc of lkCols) newRow['_lkp_' + lc.key] = lkRow ? (lkRow[lc.key] ?? null) : null;
    if (lkRow) matched++;
    return newRow;
  });

  return { columns, rows: mergedRows, matched, unmatched: main.rows.length - matched };
}

// ---- 多表匹配（自动选择单列或多列） ----
export function matchMultiTables(
  tables: { columns: ColumnDef[]; rows: RowData[]; name: string }[]
): { columns: ColumnDef[]; rows: RowData[]; summary: ResultSummary } {
  if (tables.length < 2) return { columns: tables[0]?.columns ?? [], rows: tables[0]?.rows ?? [], summary: { totalRecords: tables[0]?.rows.length ?? 0 } };

  let main = { columns: [...tables[0].columns], rows: [...tables[0].rows] };
  let totalMatched = 0;
  const mainRowCount = tables[0].rows.length;

  for (let i = 1; i < tables.length; i++) {
    const lookup = tables[i];
    const commonKeys = findCommonKeys(main.columns, lookup.columns);
    if (commonKeys.length === 0) continue;
    // 澶氬垪鍖归厤浼樺厛锛堝彇鍏ㄩ儴鍏卞悓鍒楋級锛屽惁鍒欏洖閫€鍗曞垪
    const r = commonKeys.length > 1
      ? matchTwoMulti(main, lookup, commonKeys)
      : matchTwo(main, lookup, commonKeys[0]);
    main = { columns: r.columns, rows: r.rows };
    totalMatched += r.matched;
  }

  const totalUnmatched = Math.max(0, mainRowCount - totalMatched);

  return {
    columns: main.columns,
    rows: main.rows,
    summary: { totalRecords: main.rows.length, matchedCount: totalMatched, unmatchedCount: totalUnmatched },
  };
}

// ---- 澶氳〃鍚堝苟锛堢旱鍚戞嫾鎺ワ級 ----
export function mergeTables(
  tables: { columns: ColumnDef[]; rows: RowData[] }[]
): { columns: ColumnDef[]; rows: RowData[]; summary: ResultSummary } {
  if (tables.length === 0) return { columns: [], rows: [], summary: { totalRecords: 0 } };
  const colMap = new Map<string, ColumnDef>();
  for (const t of tables) for (const c of t.columns) if (!colMap.has(c.key)) colMap.set(c.key, c);
  const columns = Array.from(colMap.values());
  const rows: RowData[] = [];
  for (const t of tables) for (const row of t.rows) { const nr: RowData = {}; for (const c of columns) nr[c.key] = row[c.key] ?? null; rows.push(nr); }
  return { columns, rows, summary: { totalRecords: rows.length } };
}

// ---- 鏁版嵁娓呮礂 ----
export function cleanData(rows: RowData[], columns: ColumnDef[], targetColumns?: string[]): {
  result: RowData[]; removedEmptyRows: number; removedInvalidCells: number
} {
  let removedEmptyRows = 0, removedInvalidCells = 0; const result: RowData[] = [];

  const colsToCheck = targetColumns
    ? columns.filter(c => targetColumns.includes(c.key))
    : undefined;

  for (const row of rows) {
    const newRow: RowData = {}; let hasAny = false; let hasTargetValue = !targetColumns;
    for (const col of columns) {
      const v = row[col.key];
      const isTargetCol = targetColumns ? (colsToCheck || []).includes(col) : false;
      if (v == null || String(v).trim() === '') { newRow[col.key] = null; }
      else if (col.type === 'number' && isNaN(Number(v))) { newRow[col.key] = null; removedInvalidCells++; }
      else { newRow[col.key] = v; hasAny = true; if (isTargetCol) hasTargetValue = true; }
    }
    if (targetColumns && !hasTargetValue) { removedEmptyRows++; continue; }
    if (hasAny) result.push(newRow); else removedEmptyRows++;
  }
  return { result, removedEmptyRows, removedInvalidCells };
}

