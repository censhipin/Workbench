// ============================================================
// Natural Language Understanding (NLU) — 统一入口
// ============================================================
// 职责：
//   - 对外暴露 AI 语义理解 + Schema Resolver 完整管道
//   - 首先尝试 DeepSeek AI 理解
//   - AI 不可用时降级到 RuleBasedParser（Fallback）
// ============================================================

export { tokenize } from './tokenizer';
export { IntentLexicon, defaultLexicon } from './intent-lexicon';
export { SynonymRegistry } from './synonym';
export { SchemaResolver, defaultSchemaResolver } from './schema-resolver';
export { deepseekUnderstand } from './deepseek';
export { taskPlanToIntent } from './taskplan-converter';
export { ruleIntentToTaskPlan } from './rule-taskplan-converter';
export type { TaskPlan, TaskPlanAction, TaskPlanCondition, AggMethod, SortDirection } from './taskplan-types';
export type { SchemaCandidate, SchemaResolution, ConceptPattern, FilterCondition, AggregationType } from './types';
export type { SemanticTaskParser } from './semantic-parser';
export { RuleBasedSemanticParser } from './semantic-parser';

import { RuleBasedSemanticParser, type SemanticTaskParser } from './semantic-parser';
import { defaultSchemaResolver } from './schema-resolver';
import { defaultLexicon } from './intent-lexicon';
import { deepseekUnderstand } from './deepseek';
import { taskPlanToIntent } from './taskplan-converter';
import { ruleIntentToTaskPlan } from './rule-taskplan-converter';
import { compile } from '../v2/task-compiler';
import type { ColumnDef, TaskIntent } from '../types';
import type { SchemaResolution } from './types';
import { getSampleRows } from './sampler';
import {
  startTrace, addTraceStep, setTracePath, setTraceAIOutput,
  setTraceRuleOutput, setTraceSchemaResolution, setTraceCompile, setTraceFinalPlan,
  getCurrentTrace
} from '../pipeline-trace';

/** 默认语义解析器（Fallback） */
let defaultParser: SemanticTaskParser | null = null;

function getDefaultParser(): SemanticTaskParser {
  if (!defaultParser) defaultParser = new RuleBasedSemanticParser(defaultLexicon);
  return defaultParser;
}

/**
 * 完整 NLU 管道：
 * 1. 尝试 DeepSeek AI 理解
 * 2. 如果 AI 不可用 → 降级到规则解析（Fallback）
 * 3. Schema Resolver 将语义 target 映射到实际列
 */
export async function parseIntentWithAI(
  prompt: string,
  tableName: string,
  availableColumns: ColumnDef[],
  rows: Record<string, string | number | null>[],
  fileNames: string[]
): Promise<{ intent: TaskIntent | null; resolution: SchemaResolution; aiUsed: boolean }> {
  // 启动 Pipeline Trace
  startTrace(prompt);

  // 尝试 DeepSeek
  addTraceStep('parse', 'ok', '调用 DeepSeek AI');
  const aiResult = await deepseekUnderstand(prompt, tableName, availableColumns, rows);

  // ★ 额度/Key 无效 → 不降级，直接返回错误
  if (aiResult.isQuotaError) {
    setTracePath('AI', false, false, aiResult.error);
    addTraceStep('parse', 'failed', aiResult.error || 'API Key 无效或额度不足');
    return {
      intent: null,
      resolution: { target: '', candidates: [], isResolved: false, message: aiResult.error || 'API Key 无效或额度不足' },
      aiUsed: false,
    };
  }

  if (aiResult.success && aiResult.plan && aiResult.plan.action !== 'unknown') {
    setTracePath('AI', true, true);
    setTraceAIOutput(undefined, aiResult.plan);
    addTraceStep('parse', 'ok', `AI 理解成功: action=${aiResult.plan.action}`);

    // AI 成功 → 转换 TaskPlan → TaskIntent
    const intent = taskPlanToIntent(aiResult.plan, fileNames, prompt);

    // 编译 TaskPlan → ExecutionPlan（V2 链路）
    addTraceStep('compile', 'ok', '编译 TaskPlan → ExecutionPlan');
    const compiled = compile(aiResult.plan, availableColumns, rows);
    if (compiled.success && compiled.plan) {
      intent.v2plan = compiled.plan;
      setTraceCompile(false);
    } else {
      addTraceStep('compile', 'failed', `编译失败: ${compiled.error || '未知错误'}`);
      setTraceCompile(false, compiled.error);
    }

    // 使用 Schema Resolver 解析 columnHint（仅对需列解析的操作）
    const resolution = shouldResolveColumns(aiResult.plan.action)
      ? await resolveTaskPlanColumns(aiResult.plan, availableColumns)
      : { target: '', candidates: [], isResolved: true, message: '该操作不需要列解析' };

    setTraceSchemaResolution(aiResult.plan.action ? !['formula', 'update', 'pipeline', 'select'].includes(aiResult.plan.action) : false, resolution);
    setTraceFinalPlan(intent.v2plan || intent.operation, intent.operation || 'unknown', 0.95);

    // 确认 AI 路径已完成
    const trace = getCurrentTrace();
    if (trace) trace.aiAvailable = true;

    return { intent, resolution, aiUsed: true };
  }

  // AI 不可用 → Fallback 到规则解析
  setTracePath('RULE', false, aiResult.success, aiResult.error || 'AI 返回 unknown');
  addTraceStep('parse', 'ok', 'AI 不可用，降级到规则解析');

  const intent = getDefaultParser().parse(prompt, availableColumns, fileNames, rows);
  setTraceRuleOutput(intent);

  const resolution = shouldResolveOperation(intent.operation) && intent.target
    ? defaultSchemaResolver.resolve(intent.target, availableColumns)
    : { target: intent.target || '', candidates: [], isResolved: true, message: '该操作不需要列解析或未提取到语义目标' };

  setTraceSchemaResolution(!!(intent.target), resolution);

  // Fallback 也生成 v2plan
  if (intent.operation) {
    addTraceStep('compile', 'ok', '规则路径编译 v2plan');
    intent.v2plan = buildV2PlanFromIntent(intent, availableColumns, rows);
    setTraceCompile(false);
  }

  addTraceStep('resolve', 'ok', `column mapping: ${resolution.isResolved ? '已明确' : '有歧义或未找到'}`);
  setTraceFinalPlan(intent.v2plan || intent.operation, intent.operation || 'unknown', intent.confidence || 0.5);

  return { intent, resolution, aiUsed: false };
}

/**
 * 判断该操作是否需要列解析
 * formula/update/pipeline 不需要 column resolver
 */
function shouldResolveOperation(operation: string | null): boolean {
  if (!operation) return false;
  return !['formula', 'update', 'pipeline', 'select'].includes(operation);
}

/**
 * 判断 TaskPlan action 是否需要列解析
 */
function shouldResolveColumns(action: string): boolean {
  return !['formula', 'update', 'pipeline', 'select'].includes(action);
}

/**
 * 解析 TaskPlan 中的所有 columnHint
 */
async function resolveTaskPlanColumns(
  plan: import('./taskplan-types').TaskPlan,
  columns: ColumnDef[]
): Promise<SchemaResolution> {
  // 尝试主 columnHint
  const hints: string[] = [];
  if (plan.columnHint) hints.push(plan.columnHint);
  if (plan.columnHints) hints.push(...plan.columnHints);
  if (plan.matchKeyHint) hints.push(plan.matchKeyHint);
  if (plan.groupByHints) hints.push(...plan.groupByHints);
  if (plan.conditions) {
    for (const c of plan.conditions) {
      if (c.columnHint) hints.push(c.columnHint);
    }
  }

  if (hints.length === 0) {
    return { target: '', candidates: [], isResolved: false, message: 'TaskPlan 无列提示' };
  }

  // 取第一个 hint 解析
  const primaryHint = hints[0];
  return defaultSchemaResolver.resolveByHint(primaryHint, columns);
}

/**
 * 纯规则解析（同步，用于非 AI 场景）
 */
export function parseIntent(
  prompt: string,
  availableColumns: ColumnDef[],
  fileNames: string[],
  rows?: Record<string, string | number | null>[]
): TaskIntent {
  return getDefaultParser().parse(prompt, availableColumns, fileNames, rows);
}

/**
 * Schema 解析（同步，用于纯规则模式）
 */
export function resolveSchema(
  target: string,
  columns: ColumnDef[]
): SchemaResolution {
  return defaultSchemaResolver.resolve(target, columns);
}

/**
 * 完整管道：语义解析 + Schema 解析（同步，Fallback 模式）
 */
export function parseAndResolve(
  prompt: string,
  availableColumns: ColumnDef[],
  fileNames: string[],
  rows?: Record<string, string | number | null>[]
): { intent: TaskIntent; resolution: SchemaResolution } {
  const intent = parseIntent(prompt, availableColumns, fileNames, rows);
  const resolution = shouldResolveOperation(intent.operation) && intent.target
    ? resolveSchema(intent.target, availableColumns)
    : { target: intent.target || '', candidates: [], isResolved: true, message: '该操作不需要列解析或未提取到语义目标' };

  // Fallback 也生成 v2plan（含 pipeline 多步支持）
  if (intent.operation) {
    intent.v2plan = buildV2PlanFromIntent(intent, availableColumns, rows);
  }

  return { intent, resolution };
}

/**
 * 从 TaskIntent 生成 v2plan，支持 pipeline 多步
 * - 当 operation 为 filter 且有 "再/然后" 等连接词时，生成 pipeline
 * - formula/update 直接 compile
 * - 其它情况走单 step
 */
function buildV2PlanFromIntent(
  intent: TaskIntent,
  columns: ColumnDef[],
  rows?: Record<string, string | number | null>[],
): import('@/lib/v2/execution-plan').ExecutionPlan | undefined {
  // pipeline 操作：递归编译各步骤
  if (intent.operation === 'pipeline' && intent.steps && intent.steps.length > 0) {
    const compiledSteps: import('@/lib/v2/execution-plan').ExecutionPlan[] = [];
    for (const step of intent.steps) {
      const stepPlan = buildV2PlanFromIntent(step, columns, rows);
      if (stepPlan) compiledSteps.push(stepPlan);
    }
    if (compiledSteps.length >= 2) {
      return { type: 'pipeline', steps: compiledSteps };
    }
  }

  // 单步：直接 compile
  const fallbackPlan = ruleIntentToTaskPlan(intent);
  const compiled = compile(fallbackPlan, columns, rows);
  return compiled.success && compiled.plan ? compiled.plan : undefined;
}

export { getSampleRows };

/**
 * 设置自定义解析器
 */
export function setParser(parser: SemanticTaskParser): void {
  defaultParser = parser;
}
