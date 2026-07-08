// ============================================================
// Null Repair — 统一空值定义
// ============================================================
// 职责：统一系统中所有空值判断逻辑
//
// 当前空值检测分散在：
//   - predicate.ts: cellValue == null || trim() === ''
//   - data-engine.ts: v != null && !isNaN(Number(v))
//   - column-analyzer.ts: raw == null || String(raw).trim() === ''
//
// 本模块定义统一标准，后续 Phase 集成到上述位置
// ============================================================

import type {
  ExecutionPlan,
  CleanPlan,
  FilterPlan,
  UpdatePlan,
} from '../../v2/execution-plan';
import type { DataProfile } from '../profile/types';
import type { RepairRecord } from './repair-types';

// ============================================================
// 空值定义
// ============================================================

export interface NullDefinition {
  patterns: NullPattern[];
}

export type NullPattern =
  | { type: 'null' }
  | { type: 'empty' }
  | { type: 'whitespace' }
  | { type: 'literal'; values: string[] }
  | { type: 'placeholder' };

/** 默认空值定义 */
export const DEFAULT_NULL_DEFINITION: NullDefinition = {
  patterns: [
    { type: 'null' },
    { type: 'empty' },
    { type: 'whitespace' },
    {
      type: 'literal',
      values: [
        'null', 'n/a', 'na', '-', 'none', 'nan', 'nil',
        'null', 'undefined', 'na', '—', '－', 'n/a',
      ],
    },
  ],
};

// ============================================================
// 核心函数
// ============================================================

/**
 * 统一判断是否为空值
 *
 * null → true
 * undefined → true
 * "" → true
 * "  " → true
 * "NULL" → true (with literal pattern)
 * "N/A" → true
 * "-" → true
 * "none" → true
 * "杭州" → false
 * 0 → false
 */
export function isNull(
  value: unknown,
  definition: NullDefinition = DEFAULT_NULL_DEFINITION,
): boolean {
  for (const pattern of definition.patterns) {
    switch (pattern.type) {
      case 'null':
        if (value == null) return true;
        break;

      case 'empty':
        if (value === '') return true;
        break;

      case 'whitespace':
        if (typeof value === 'string' && value.trim() === '') return true;
        break;

      case 'literal':
        if (typeof value === 'string') {
          const trimmed = value.trim().toLowerCase();
          if (pattern.values.includes(trimmed)) return true;
        }
        break;

      case 'placeholder':
        // 占位符模式由调用方自定义，这里不做默认实现
        break;
    }
  }

  return false;
}

/**
 * 规范化空值表示
 * 所有空值类型 → null
 * 非空值保持不变
 */
export function normalizeNull(
  value: unknown,
  definition: NullDefinition = DEFAULT_NULL_DEFINITION,
): unknown {
  return isNull(value, definition) ? null : value;
}

// ============================================================
// 基于 profile 的空值策略修复
// ============================================================

export type NullStrategy = 'skip' | 'treatAsZero' | 'treatAsNull' | 'warn';

/**
 * 根据列画像和操作类型推荐空值处理策略
 */
export function suggestNullStrategy(
  nullRate: number,
  operationType: string,
): { strategy: NullStrategy; confidence: number; detail: string } {
  // 高空值率时更谨慎
  if (nullRate > 0.5) {
    return {
      strategy: 'warn',
      confidence: 0.6,
      detail: `空值率 ${(nullRate * 100).toFixed(0)}% 过高，建议用户确认后再处理`,
    };
  }

  switch (operationType) {
    case 'filter':
      return {
        strategy: 'skip',
        confidence: 0.9,
        detail: '筛选操作自动跳过空值行',
      };
    case 'aggregate':
      return {
        strategy: 'treatAsZero',
        confidence: nullRate < 0.1 ? 0.9 : 0.7,
        detail: nullRate < 0.1
          ? '空值率低，自动视为 0 参与聚合'
          : '空值率较高，建议确认后将空值视为 0',
      };
    case 'formula':
      return {
        strategy: 'treatAsZero',
        confidence: nullRate < 0.05 ? 0.85 : 0.6,
        detail: nullRate < 0.05
          ? '少量空值，自动视为 0 参与公式计算'
          : '公式计算中空值将被视为 0，结果可能受影响',
      };
    case 'sort':
      return {
        strategy: 'treatAsNull',
        confidence: 0.9,
        detail: '空值行自动排在排序末尾',
      };
    default:
      return {
        strategy: 'warn',
        confidence: 0.5,
        detail: `操作类型 "${operationType}" 无预设空值策略`,
      };
  }
}

/**
 * 从 ExecutionPlan 中检测并注入空值处理建议
 * 当前阶段只做分析记录，不修改 plan
 */
export function repairNullHandling(
  plan: ExecutionPlan,
  profile: DataProfile,
): { plan: ExecutionPlan; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];

  // 对每种计划类型检查相关列的空值情况
  switch (plan.type) {
    case 'filter': {
      const fp = plan as FilterPlan;
      for (const cond of fp.conditions) {
        const colProfile = profile.columns.find(
          (c) => c.columnKey === cond.columnKey || c.title === cond.columnKey,
        );
        if (colProfile && colProfile.nullRate > 0) {
          const suggestion = suggestNullStrategy(colProfile.nullRate, 'filter');
          if (colProfile.nullRate > 0.3) {
            repairs.push({
              action: 'NULL_HANDLE',
              target: colProfile.columnKey,
              original: colProfile.nullRate,
              repaired: suggestion.strategy,
              confidence: suggestion.confidence,
              category: suggestion.confidence >= 0.7 ? 'auto' : 'suggest',
              detail: `"${colProfile.title}" 列空值率 ${(colProfile.nullRate * 100).toFixed(0)}%，${suggestion.detail}`,
            });
          }
        }
      }
      break;
    }

    case 'clean': {
      const colProfiles = profile.columns.filter((c) => c.nullRate > 0);
      for (const cp of colProfiles) {
        // clean 操作不清洗空值，只做空行删除和非法数字清理，所以不应标记为 auto
        repairs.push({
          action: 'NULL_HANDLE',
          target: cp.columnKey,
          original: cp.nullRate,
          repaired: null,
          confidence: 0.9,
          category: 'suggest',
          detail: `"${cp.title}" 列发现 ${cp.nullCount} 个空值`,
        });
      }
      break;
    }

    default:
      break;
  }

  return { plan, repairs };
}
