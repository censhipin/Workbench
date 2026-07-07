// ============================================================
// Match Verifier — 匹配验证
// ============================================================
// 验证：
//   1. 匹配率统计
//   2. 未匹配主表行统计
//   3. 重复匹配检测
// ============================================================

import type { ColumnDef, RowData } from '../../types';
import type { ExecutionPlan } from '../../v2/execution-plan';
import type { Verifier, VerificationResult } from './types';
import { computeMatchStats } from './statistics';
import { isNull } from '../../v2/executors/null-definition';

export class MatchVerifier implements Verifier {
  readonly type = 'match';

  verify(
    plan: ExecutionPlan,
    inputColumns: ColumnDef[],
    inputRows: RowData[],
    outputColumns: ColumnDef[],
    outputRows: RowData[],
  ): VerificationResult {
    if (plan.type !== 'match') {
      return { passed: false, confidence: 0, checks: [{ name: '类型检查', passed: false, detail: `MatchVerifier 收到错误 type: ${plan.type}` }] };
    }

    const checks: import('./types').VerificationCheck[] = [];
    const matchKeys = plan.matchColumns;

    // 检测输出中是否包含右表列（_lkp_ 前缀）
    const hasRightValues = outputColumns.some(c => c.key.startsWith('_lkp_'));

    if (!hasRightValues || matchKeys.length === 0) {
      checks.push({ name: '匹配验证', passed: true, detail: '无匹配键或未发生匹配操作，跳过验证' });
      return {
        passed: true,
        confidence: 1,
        checks,
        stats: {
          rowCount: outputRows.length,
          columnCount: outputColumns.length,
          inputRowCount: inputRows.length,
          outputRowCount: outputRows.length,
          matchCount: 0,
          unmatchedCount: inputRows.length,
          matchRate: 0,
          leftTableRows: inputRows.length,
        },
      };
    }

    // 统计匹配
    const leftRows = inputRows;
    const leftCount = leftRows.length;

    // 检查前 leftCount 行中的匹配情况
    let matched = 0;
    let unmatched = 0;

    for (let i = 0; i < Math.min(leftCount, outputRows.length); i++) {
      const row = outputRows[i];
      const hasMatch = Object.keys(row).some(k => k.startsWith('_lkp_') && !isNull(row[k]));
      if (hasMatch) matched++;
      else unmatched++;
    }

    // 额外匹配的行（右表未匹配追加的行）
    const extraRows = Math.max(0, outputRows.length - leftCount);
    const matchRate = leftCount > 0 ? matched / leftCount : 0;

    // 重复匹配检测
    let duplicateMatches = 0;
    const seenKeys = new Set<string>();
    for (const row of outputRows) {
      const key = matchKeys.map(c => String(row[c] ?? '')).join('|');
      if (key && seenKeys.has(key)) {
        duplicateMatches++;
      }
      if (key) seenKeys.add(key);
    }

    checks.push({
      name: '匹配率',
      passed: matchRate >= 0.5,
      detail: `匹配率 ${(matchRate * 100).toFixed(1)}%（${matched}/${leftCount}）`,
    });

    if (unmatched > 0) {
      checks.push({
        name: '未匹配统计',
        passed: true,
        detail: `${unmatched} 行未匹配到对应数据，已保留为空值`,
      });
    }

    if (matchRate < 0.3 && leftCount > 0) {
      checks.push({
        name: '匹配警告',
        passed: false,
        detail: `匹配率仅 ${(matchRate * 100).toFixed(0)}%，请检查匹配键是否正确`,
        confidence: 0.4,
      });
    }

    if (duplicateMatches > 0) {
      checks.push({
        name: '重复匹配',
        passed: true,
        detail: `检测到 ${duplicateMatches} 行重复匹配`,
      });
    }

    if (extraRows > 0) {
      checks.push({
        name: '追加行',
        passed: true,
        detail: `追加了 ${extraRows} 行未匹配的右表数据`,
      });
    }

    const passed = checks.filter(c => c.passed === false && (c.confidence ?? 1) >= 0.5).length === 0;
    const confidence = computeMatchConfidence(checks);

    return {
      passed,
      confidence,
      checks,
      stats: {
        rowCount: outputRows.length,
        columnCount: outputColumns.length,
        inputRowCount: leftCount,
        outputRowCount: outputRows.length,
        matchCount: matched,
        unmatchedCount: unmatched,
        matchRate,
        leftTableRows: leftCount,
      },
    };
  }
}

function computeMatchConfidence(checks: import('./types').VerificationCheck[]): number {
  if (checks.length === 0) return 1;
  return checks.filter(c => c.passed).length / checks.length;
}
