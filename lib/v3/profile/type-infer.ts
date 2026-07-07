// ============================================================
// Type Inference — 列类型推断
// 完全确定性算法，不涉及 AI
// ============================================================

/**
 * 推断一列的类型
 * 规则:
 *  - number → >= 80% 的值可 parseFloat（非空值中）
 *  - date   → >= 80% 的值可解析为 Date（非空值中）
 *  - string → 默认
 *  - unknown → 混合严重或无法判定
 *
 * 返回 { type, confidence }
 */
export function inferColumnType(values: unknown[]): {
  type: 'number' | 'string' | 'date' | 'unknown';
  confidence: number;
} {
  const nonNull = values.filter((v) => v != null && v !== '');
  if (nonNull.length === 0) {
    return { type: 'string', confidence: 0.3 };
  }

  let numberCount = 0;
  let dateCount = 0;

  for (const v of nonNull) {
    if (isNumeric(v)) {
      numberCount++;
    } else if (isDateLike(v)) {
      dateCount++;
    }
  }

  const total = nonNull.length;
  const numberRatio = numberCount / total;
  const dateRatio = dateCount / total;

  // number 优先: >= 80% 可解析为数字
  if (numberRatio >= 0.8) {
    return { type: 'number', confidence: numberRatio };
  }

  // date: >= 80% 可解析为日期
  if (dateRatio >= 0.8) {
    return { type: 'date', confidence: dateRatio };
  }

  // 数字和日期都不够，但有部分数字 → 混合
  if (numberRatio > 0 || dateRatio > 0) {
    return { type: 'unknown', confidence: Math.max(numberRatio, dateRatio) };
  }

  return { type: 'string', confidence: 0.9 };
}

function isNumeric(v: unknown): boolean {
  if (typeof v === 'number') return !isNaN(v);
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();
  if (trimmed === '') return false;
  return !isNaN(Number(trimmed)) && trimmed !== '';
}

/**
 * 判断是否像日期字符串
 * 支持 "2024-01-01" / "2024/01/01" / "2024年01月01日" / Excel 序列号
 */
function isDateLike(v: unknown): boolean {
  if (typeof v === 'number') {
    // Excel 日期序列号范围
    return v > 59 && v < 2_000_000;
  }
  if (typeof v !== 'string') return false;
  const trimmed = v.trim();

  // 常见日期格式
  const datePatterns = [
    /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,       // 2024-01-01 或 2024/01/01
    /^\d{4}年\d{1,2}月\d{1,2}日$/,           // 2024年01月01日
    /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/,         // 01/01/2024
    /^\d{4}[-/]\d{1,2}$/,                    // 2024-01
  ];

  for (const p of datePatterns) {
    if (p.test(trimmed)) return true;
  }

  // 最后尝试 Date.parse
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) return true;

  return false;
}

/** 解析为数值（用于 min/max 计算） */
export function parseNumeric(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = Number(String(v).trim());
  return isNaN(n) ? null : n;
}
