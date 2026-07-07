// ============================================================
// Repair Engine — 修复编排器主入口
// ============================================================
// 职责：串联所有子修复器，统一入口
//
// 流程：
//   1. 空值修复（统一 null 定义）
//   2. 列修复（值→列反推 / 列模糊匹配）
//   3. 值修复（规范化字符串比较）
//   4. 类型修复（数字/日期/Boolean 格式统一）
//   5. Join 修复（Join 键模糊匹配）
//   6. 公式修复（公式 AST 解析与校验）
//
// 每个阶段：
//   - 高置信度（>= threshold）→ 自动修复（category: 'auto'）
//   - 低置信度（< threshold）→ 仅记录（category: 'suggest'）
//   - 不修改原始 plan，返回修复后的副本
// ============================================================

import type { ExecutionPlan } from '../../v2/execution-plan';
import { resolveColumnReferences, buildColumnValueIndex } from './column-repair';
import { convertConditionValues } from './type-repair';
import { repairJoinPlan } from './join-repair';
import { repairFormulaPlan } from './formula-repair';
import { repairNullHandling } from './null-repair';
import { buildRepairReport, formatRepairReport } from './repair-report';
import type {
  RepairRecord,
  RepairContext,
  RepairOptions,
  RepairResult,
} from './repair-types';

const DEFAULT_OPTIONS: Required<RepairOptions> = {
  columnRepair: true,
  valueRepair: true,
  typeRepair: true,
  joinRepair: true,
  formulaRepair: true,
  nullRepair: true,
  confidenceThreshold: 0.5,
};

/**
 * 修复编排器主入口
 *
 * 用法：
 *   const result = repairPlan(plan, { columns, rows, profile, columnIndex });
 *   if (result.autoFixApplied) {
 *     // 使用 result.plan（修复后的 plan）
 *   }
 *   logger.info(formatRepairReport(result.report));
 */
export function repairPlan(
  plan: ExecutionPlan,
  context: RepairContext,
  options?: RepairOptions,
): RepairResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allRepairs: RepairRecord[] = [];

  // 构建列值索引（如未提供）
  const columnIndex =
    context.columnIndex?.length > 0
      ? context.columnIndex
      : buildColumnValueIndex(context.columns, context.rows);

  // 当前 plan 指针（每个阶段可能返回新 plan）
  let currentPlan = plan;

  // === Step 1: 空值修复 ===
  if (opts.nullRepair) {
    const { plan: p, repairs } = repairNullHandling(currentPlan, context.profile);
    allRepairs.push(...repairs);
    currentPlan = p;
  }

  // === Step 2: 列修复（值→列反推 / 列模糊匹配）===
  if (opts.columnRepair) {
    const { plan: p, repairs } = resolveColumnReferences(
      currentPlan,
      context.columns,
      columnIndex,
    );
    allRepairs.push(...repairs);
    currentPlan = p;
  }

  // === Step 3: 类型修复 ===
  if (opts.typeRepair) {
    const { plan: p, repairs } = convertConditionValues(
      currentPlan,
      context.profile,
      context.columns,
    );
    allRepairs.push(...repairs);
    currentPlan = p;
  }

  // === Step 4: Join 修复 ===
  if (opts.joinRepair && currentPlan.type === 'match') {
    const { plan: p, repairs } = repairJoinPlan(
      currentPlan as import('../../v2/execution-plan').MatchPlan,
      context.profile,
      context.columns,
      context.allFiles ?? [],
    );
    allRepairs.push(...repairs);
    currentPlan = p;
  }

  // === Step 5: 公式修复 ===
  if (opts.formulaRepair && currentPlan.type === 'formula') {
    const { plan: p, repairs } = repairFormulaPlan(
      currentPlan as import('../../v2/execution-plan').FormulaPlan,
      context.columns,
    );
    allRepairs.push(...repairs);
    currentPlan = p;
  }

  // Pipeline: 递归处理子步骤
  if (currentPlan.type === 'pipeline') {
    const pipelinePlan = currentPlan as import('../../v2/execution-plan').PipelinePlan;
    const newSteps = pipelinePlan.steps.map((step) => {
      const stepResult = repairPlan(step, context, opts);
      allRepairs.push(...stepResult.report.repairs);
      return stepResult.plan;
    });
    currentPlan = { ...pipelinePlan, steps: newSteps };
  }

  // 过滤置信度低于阈值的修复
  const threshold = opts.confidenceThreshold;
  const finalRepairs = allRepairs.filter((r) => r.confidence >= threshold || r.category === 'suggest');
  const autoRepairs = finalRepairs.filter((r) => r.confidence >= threshold && r.category === 'auto');
  const autoFixApplied = autoRepairs.length > 0;

  const report = buildRepairReport(finalRepairs);

  return {
    plan: currentPlan,
    report,
    autoFixApplied,
  };
}

export { buildRepairReport, formatRepairReport, buildColumnValueIndex };
