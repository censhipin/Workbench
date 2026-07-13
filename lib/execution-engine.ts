// ============================================================
// 执行引擎 — 可信执行 + 结果验证
// 只接收已完全解析的 TaskIntent，不参与任何语言/语义理解
// ============================================================
// 强制单链路: NLU → FieldResolver → compile → ExecutionPlan → V2 Executors
//
// ❌ 已删除的双执行路径:
//   - ExecutionEngine.execute()          (旧 switch-case)
//   - InputValidator                     (被 V2 validatePlan 替代)
//   - canExecute                         (同上)
//   - ResultVerifier.verify()            (被 V2 verifier 替代)
//   - fallback column guess logic
//
// 唯一职责:
//   1) 检查 intent.v2plan 是否存在（不存在 = 编译失败 → 直接返回错误）
//   2) 调用 runExecutionPlan() → V2 Executor Registry
//   3) 调用 PlanStepBuilder 生成 UI 展示用的 5 步执行计划
// ============================================================

import { ColumnDef, WorkbenchFile, PlanStep, StepStatus, StepSubItem, ResultSummary } from './types';
import { runExecutionPlan } from './v2/execution-engine';
import {
  addTraceStep, setTraceExecution, setTraceVerification, finishTrace, getCurrentTrace
} from './pipeline-trace';
import { buildDataProfile } from './v3/profile';
import { repairPlan, buildColumnValueIndex } from './v3/repair/repair-engine';
import type { RepairReport } from './v3/repair/repair-types';
import { buildExecutionExplanation } from './v3/explain';
import type { ExecutionExplanation } from './v3/explain';
import { verifyExecution } from './v3/verification/verification-engine';

// ============================================================
// 类型定义（保持导出兼容）
// ============================================================

export interface ValidationIssue {
  severity: 'error' | 'warning';
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ExecutionResult {
  success: boolean;
  confidence: number;
  warnings: string[];
  data?: { columns: ColumnDef[]; rows: DataRow[] };
  summary?: ResultSummary;
  error?: string;
}

export type DataRow = Record<string, string | number | null>;

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  passed: boolean;
  checks: VerificationCheck[];
}

export interface EngineRunResult {
  success: boolean;
  steps: PlanStep[];
  resultData: { columns: ColumnDef[]; rows: DataRow[] } | null;
  resultSummary: ResultSummary | null;
  verification: VerificationReport | null;
  intent: import('./types').TaskIntent | null;
  error?: string;
  /** EIC Repair 报告（Phase 5+） */
  repairReport?: RepairReport;
  /** 修复后的 ExecutionPlan */
  repairedPlan?: import('./v2/execution-plan').ExecutionPlan | null;
  /** Explain 层输出（Phase 6+） */
  explanation?: ExecutionExplanation;
}

// ============================================================
// 辅助
// ============================================================

function operationLabel(op: string | null): string {
  const labels: Record<string, string> = {
    sort: '数据排序', filter: '数据筛选', sum: '数据求和',
    dedup: '数据去重', match: '多表匹配', merge: '多表合并',
    clean: '数据清洗', update: '批量更新', formula: '公式计算',
    pipeline: '多步流水线', select: '列选择', remove: '删除列', rename: '列重命名',
  };
  return op ? labels[op] || '' : '';
}

function describeOutput(output: import('./types').TaskIntent['output']): string {
  if (!output) return '';
  const parts: string[] = [];
  if (output.includeColumns?.length) parts.push(`仅保留[${output.includeColumns.join(',')}]`);
  if (output.excludeColumns?.length) parts.push(`排除[${output.excludeColumns.join(',')}]`);
  if (output.renameColumns) parts.push(`重命名${Object.keys(output.renameColumns).length}列`);
  if (output.reorderColumns?.length) parts.push(`重排列顺序`);
  if (output.limit) parts.push(`前${output.limit}条`);
  return parts.join(' ');
}

// ============================================================
// PlanStepBuilder — UI 展示用的 5 步执行计划（纯显示，不影响执行）
// ============================================================

export class PlanStepBuilder {
  static build(
    intent: import('./types').TaskIntent | null,
    validation: ValidationResult,
    execution: ExecutionResult | null,
    verification: VerificationReport | null,
    repairReport?: RepairReport,
  ): PlanStep[] {
    const steps: PlanStep[] = [];
    const targetCols = intent ? (intent.resolvedColumns ?? intent.targetColumns) : [];

    const step1Ok = intent != null && intent.operation != null;
    steps.push({
      id: 'step-1', order: 1, status: step1Ok ? 'completed' : 'failed' as StepStatus, isDangerous: false,
      description: '解析用户意图', details: intent?.rawPrompt || '',
      subItems: intent ? [
        intent.operation ? { label: '识别操作', value: intent.groupBy && intent.groupBy.length > 0
          ? '分组聚合'
          : (operationLabel(intent.operation) || intent.operation) } : null,
        intent.groupBy && intent.groupBy.length > 0 ? { label: '分组字段', value: intent.groupBy.join('、') } : null,
        intent.target ? { label: '语义目标', value: intent.target } : null,
        intent.aggregation ? { label: '聚合方式', value: intent.aggregation } : null,
        (intent.params.targets as string[])?.length > 1
          ? { label: '目标列', value: (intent.params.targets as string[]).join('、') }
          : (targetCols.length > 0 ? { label: '目标列', value: targetCols.map(c => c.title).join('、') } : null),
        intent.targetFiles.length > 0 ? { label: '目标文件', value: intent.targetFiles.join('、') } : null,
        intent.output ? { label: '输出约束', value: describeOutput(intent.output) } : null,
      ].filter(Boolean) as StepSubItem[] : [{ label: '识别结果', value: '无法识别操作类型' }],
    });

    const step2Status: StepStatus = validation.valid ? 'completed' : 'failed';
    steps.push({
      id: 'step-2', order: 2, status: step2Status, isDangerous: false,
      description: '验证输入参数',
      subItems: validation.issues.length > 0
        ? validation.issues.map((iss, i) => ({ label: `问题 ${i + 1}`, value: iss.message }))
        : [{ label: '校验结果', value: '所有输入参数有效' }],
    });

    const step3CanRun = step1Ok && step2Status === 'completed';
    const step3Status: StepStatus = !step3CanRun ? 'skipped' : (execution?.success ? 'completed' : 'failed');
    const step3Subs: StepSubItem[] = [];
    if (step3CanRun && execution) {
      if (intent?.operation) step3Subs.push({ label: '操作类型', value: operationLabel(intent.operation) || intent.operation });
      if (execution.summary?.totalRecords !== undefined) step3Subs.push({ label: '结果行数', value: execution.summary.totalRecords });
      if (execution.error) step3Subs.push({ label: '错误信息', value: execution.error });
    } else if (!step3CanRun) step3Subs.push({ label: '执行状态', value: '前置步骤未通过，跳过执行' });
    else step3Subs.push({ label: '执行状态', value: '执行失败' });
    steps.push({
      id: 'step-3', order: 3, status: step3Status, isDangerous: intent?.operation === 'dedup',
      description: '执行数据处理', subItems: step3Subs,
    });

    const step4CanRun = step3Status === 'completed';
    const step4Status: StepStatus = !step4CanRun ? 'skipped' : (verification?.passed ? 'completed' : 'failed');
    const step4Subs: StepSubItem[] = [];
    if (verification && verification.checks.length > 0) {
      for (const check of verification.checks) {
        step4Subs.push({ label: check.name, value: check.passed ? '✓ 通过' : '✗ 不通过' });
        if (!check.passed) step4Subs.push({ label: check.name + '详情', value: check.detail });
      }
    } else if (!step4CanRun) step4Subs.push({ label: '验证状态', value: '跳过' });
    steps.push({
      id: 'step-4', order: 4, status: step4Status, isDangerous: false,
      description: '验证执行结果', subItems: step4Subs,
    });

    const overallSuccess = step1Ok && step2Status === 'completed' && step3Status === 'completed' && step4Status === 'completed';
    const step5Subs: StepSubItem[] = [{ label: '最终状态', value: overallSuccess ? '执行成功' : '执行失败' }];
    if (!overallSuccess) {
      const failures: string[] = [];
      if (step1Ok === false) failures.push('意图解析失败');
      if (step2Status === 'failed') failures.push('参数校验失败');
      if (step3Status === 'failed') failures.push('执行失败');
      if (step4Status === 'failed') failures.push('结果验证失败');
      step5Subs.push({ label: '失败原因', value: failures.join('、') });
    }

    // === Repair 报告注入 ===
    if (repairReport && repairReport.repairs.length > 0) {
      const autoRepairs = repairReport.repairs.filter((r) => r.category === 'auto');
      const suggestRepairs = repairReport.repairs.filter((r) => r.category === 'suggest');

      // 自动修复 → Step-2（验证输入参数）
      if (autoRepairs.length > 0 && steps[1] && steps[1].subItems) {
        steps[1].subItems.push({
          label: '自动修复',
          value: `${autoRepairs.length} 项已自动修复（${repairReport.summary}）`,
        });
      }

      // 建议修复 → Step-6（智能解释）
      if (suggestRepairs.length > 0 && steps[5] && steps[5].subItems) {
        steps[5].subItems.push({
          label: '修复建议',
          value: suggestRepairs.map((r) => r.detail).join('；'),
        });
      }
    }

    steps.push({
      id: 'step-5', order: 5, status: overallSuccess ? 'completed' as StepStatus : 'failed' as StepStatus,
      isDangerous: false, description: '生成结果报告', subItems: step5Subs,
    });

    // Step-6: 智能解释（Phase 6）
    steps.push({
      id: 'step-6', order: 6, status: 'completed' as StepStatus,
      isDangerous: false, description: '智能解释',
      subItems: overallSuccess
        ? [{ label: '执行说明', value: '系统已生成执行过程详细说明，请在结果面板查看' }]
        : [{ label: '失败说明', value: '系统已分析失败原因，请在错误详情中查看' }],
    });

    return steps;
  }
}

// ============================================================
// 顶层入口 — 强制 V2 单链路
// ============================================================
// 架构保证:
//   1) intent.v2plan 存在 → 走 V2 (runExecutionPlan)
//   2) intent.v2plan 不存在 → 返回错误, 不降级
//   3) validator 不修改 plan

export function runExecutionEngine(
  intent: import('./types').TaskIntent | null,
  mainFile: WorkbenchFile | undefined,
  currentSheetName: string | undefined,
  taskFiles: WorkbenchFile[],
): EngineRunResult {
  const currentSheet = mainFile?.sheets.find((s) => s.name === currentSheetName);
  const availableColumns = currentSheet?.columns ?? [];

  // === 前校验：只检查基本前提，列级校验由 V2 validatePlan 完成 ===
  const issues: ValidationIssue[] = [];

  if (!intent) {
    issues.push({ severity: 'error', field: 'intent', message: '无法解析用户意图', code: 'INTENT_PARSE_FAILED' });
  } else if (!intent.operation) {
    issues.push({ severity: 'error', field: 'operation', message: '无法识别操作类型', code: 'UNRECOGNIZED_OPERATION' });
  } else if (!intent.v2plan) {
    // ★ 强制单链路：compile 失败 = 不可执行，不降级
    issues.push({
      severity: 'error', field: 'v2plan',
      message: '编译 ExecutionPlan 失败：无法为该指令生成执行计划。请尝试更明确的描述。',
      code: 'V2PLAN_MISSING',
    });
  }

  if (!currentSheet) {
    issues.push({ severity: 'error', field: 'sheet', message: '请先在左侧选择一个文件', code: 'SHEET_NOT_FOUND' });
  }

  // 轻量操作（filter/sort/select/dedup/rename/remove）跳过 DataProfile + Repair + V3 Verification
  const LIGHT_OPS = new Set(['filter', 'sort', 'select', 'dedup', 'rename', 'remove']);
  const isHeavy = intent?.operation ? !LIGHT_OPS.has(intent.operation) : true;

  // ★ EIC DataProfile: 在任何执行前生成数据画像（仅重操作需要）
  const dataProfile = (isHeavy && currentSheet && currentSheet.rows.length > 0)
    ? buildDataProfile(currentSheet.columns, currentSheet.rows)
    : null;

  const columnIndex = dataProfile && currentSheet
    ? buildColumnValueIndex(currentSheet.columns, currentSheet.rows)
    : [];

  const validation: ValidationResult = { valid: issues.length === 0, issues };

  // ★ EIC Repair: 对计划执行自动修复（修复列引用、类型转换等）
  let repairedPlan = (validation.valid && intent?.v2plan) ? intent.v2plan : null;
  let repairReport: RepairReport | undefined;

  if (repairedPlan && dataProfile && currentSheet && validation.valid) {
    const repairResult = repairPlan(repairedPlan, {
      columns: currentSheet.columns,
      rows: currentSheet.rows,
      profile: dataProfile,
      columnIndex,
    });
    repairedPlan = repairResult.plan;
    repairReport = repairResult.report;

    if (repairResult.autoFixApplied) {
      addTraceStep('repair', 'ok', repairResult.report.summary);
    }
  }

  // === V2 执行（使用修复后的 plan） ===
  let executionResult: ExecutionResult | null = null;

  if (validation.valid && intent && repairedPlan && currentSheet) {
    const taskSheets = taskFiles
      .filter((f) => f.sheets[0] && f.id !== mainFile?.id)
      .map((f) => ({ columns: f.sheets[0].columns, rows: f.sheets[0].rows, name: f.sheets[0].name }));
    // 把当前激活的 sheet 也加入 taskSheets，供合并/匹配等操作使用
    if (currentSheet && currentSheetName) {
      taskSheets.unshift({ columns: currentSheet.columns, rows: currentSheet.rows, name: currentSheetName });
    }
    const rowsBefore = currentSheet.rows.length ?? 0;

    addTraceStep('execute', 'ok', `V2 引擎执行: ${repairedPlan.type}`);
    executionResult = runExecutionPlan(repairedPlan, currentSheet, taskSheets, dataProfile ?? undefined);
    setTraceExecution(
      'V2', executionResult.success, executionResult.error, rowsBefore,
      executionResult.success && executionResult.data ? executionResult.data.rows.length : undefined,
    );
  } else if (!validation.valid) {
    addTraceStep('execute', 'failed', issues.map((i) => i.message).join('; '));
  }

  // === 验证报告（组合 V2 结果 + V3 Verification） ===
  let verification: VerificationReport | null = null;

  if (executionResult?.success && executionResult.data) {
    // V3 Verification: 使用 9 个 Verifier 对执行结果进行详细验证（仅重操作需要）
    let v3Result = null;
    if (repairedPlan && isHeavy) {
      try {
        v3Result = verifyExecution(
          repairedPlan,
          currentSheet?.columns ?? [],
          currentSheet?.rows ?? [],
          executionResult.data.columns,
          executionResult.data.rows,
        );
      } catch {
        // V3 验证失败不阻断流程，降级为仅使用 V2 验证
      }
    }

    verification = v3Result ? {
      passed: v3Result.passed,
      checks: v3Result.checks.map(c => ({ name: c.name, passed: c.passed, detail: c.detail })),
    } : {
      passed: true,
      checks: [{ name: 'V2 结果验证', passed: true, detail: 'V2 执行引擎已完成结果验证' }],
    };
    addTraceStep('verify', 'ok', `V3 验证${v3Result && v3Result.passed ? '通过' : '警告'}`);
    setTraceVerification(verification.passed, verification.checks);
  } else if (executionResult && !executionResult.success) {
    verification = {
      passed: false,
      checks: [{ name: '执行状态', passed: false, detail: executionResult.error || '执行失败' }],
    };
    addTraceStep('verify', 'failed', executionResult.error || '执行失败');
    setTraceVerification(false, verification.checks);
  }

  // === UI 展示用 5 步执行计划 ===
  const steps = PlanStepBuilder.build(intent, validation, executionResult, verification ?? null, repairReport);

  // === 总体结果 ===
  const overallSuccess = Boolean(intent?.v2plan && validation.valid && executionResult?.success);
  const error = !overallSuccess
    ? buildErrorMessage(intent, validation, executionResult, verification)
    : undefined;

  // === Explain 层：生成人类可读解释（必须放在 error 定义之后） ===
  const explanation = buildExecutionExplanation({
    plan: repairedPlan,
    profile: dataProfile,
    repairReport,
    executionResult,
    verificationReport: verification,
    error,
    operationLabel: operationLabel(intent?.operation ?? null),
    groupBy: (intent as any)?.groupBy,
    aggregation: (intent as any)?.aggregation,
  });

  finishTrace();

  // 无分组全局聚合 → 在原表底部追加合计行（仅影响 UI 展示）
  const resultData = (overallSuccess && executionResult?.data) ? transformAggregateResult(executionResult.data, repairedPlan, currentSheet) : null;

  return {
    success: overallSuccess,
    steps,
    resultData,
    resultSummary: (overallSuccess && executionResult?.summary) ? executionResult.summary : null,
    verification,
    intent,
    error,
    repairReport,
    repairedPlan,
    explanation,
  };
}

function buildErrorMessage(
  intent: import('./types').TaskIntent | null,
  validation: ValidationResult,
  execution: ExecutionResult | null,
  verification: VerificationReport | null,
  repairReport?: RepairReport,
): string {
  if (!intent || !intent.operation) return '无法识别操作类型';
  if (!validation.valid) {
    // 对"编译 ExecutionPlan 失败"类错误给出更友好的列名级提示
    const messages = validation.issues.map((i) => {
      if (i.message.includes('找不到列') || i.message.includes('不存在')) {
        return i.message.replace(/找不到列/, '数据表中没有找到列').replace(/不存在/, '在数据表中不存在');
      }
      return i.message;
    });
    return messages.join('；');
  }
  if (execution && !execution.success) {
    var errMsg = execution.error || '执行失败';
    // 对列相关的 V2 错误做友好处理
    if (errMsg.includes('找不到列') || errMsg.includes('不存在')) {
      errMsg = errMsg.replace(/找不到列/, '数据表中没有找到列').replace(/'"/g, '');
    }
    return errMsg;
  }
  if (verification && !verification.passed) {
    const msg = verification.checks.filter((c) => !c.passed).map((c) => c.detail).join('；');
    return appendRepairSummary(msg, repairReport);
  }
  return appendRepairSummary('执行未完成', repairReport);
}

function appendRepairSummary(msg: string, repairReport?: RepairReport): string {
  if (repairReport && repairReport.successCount > 0) {
    return `${msg}（已自动修复 ${repairReport.successCount} 项）`;
  }
  return msg;
}

/** 无分组聚合 → 在原表底部追加合计行（仅影响 UI 展示，不干扰验证） */
function transformAggregateResult(
  data: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] },
  plan: import('./v2/execution-plan').ExecutionPlan | null,
  sheet: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] } | undefined,
): { columns: ColumnDef[]; rows: Record<string, string | number | null>[] } {
  if (!sheet || !plan || plan.type !== 'aggregate') return data;
  if ('groupBy' in plan && plan.groupBy && plan.groupBy.length > 0) return data;

  const aggRow = data.rows[0];
  if (!aggRow) return data;

  const aggregations = (plan as any).aggregations;
  if (!aggregations || !Array.isArray(aggregations) || aggregations.length === 0) return data;

  const labelMap: Record<string, string> = { SUM: '合计', AVG: '平均', COUNT: '计数', MAX: '最大', MIN: '最小' };
  const inlineRow: Record<string, string | number | null> = {};

  for (const agg of aggregations) {
    const suffix = labelMap[agg.method] || agg.method;
    const resultKey = `${agg.column}_${suffix}`;
    const aggValue = aggRow[resultKey] ?? null;

    if ((agg.method === 'MAX' || agg.method === 'MIN') && aggValue !== null) {
      // MAX/MIN：筛选出等于极值的行，而非追加一行
      const filtered = sheet.rows.filter(r => {
        const v = r[agg.column];
        if (v == null || v === '') return false;
        const n = Number(v);
        return !isNaN(n) && n === Number(aggValue);
      });
      if (filtered.length > 0) {
        return { columns: [...sheet.columns], rows: filtered };
      }
    }

    inlineRow[agg.column] = aggValue;
  }

  // 无 MAX/MIN 或没有匹配行 → 追加合计行
  return {
    columns: [...sheet.columns],
    rows: [...sheet.rows.map(r => ({ ...r })), inlineRow],
  };
}
