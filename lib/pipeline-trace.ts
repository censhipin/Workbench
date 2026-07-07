// ============================================================
// Pipeline Trace — 真实执行路径追踪系统
// ============================================================
// 职责：记录每次用户请求从 NLU 到 Engine 的完整执行路径
// 不依赖任何文档/推理，直接从运行时收集数据
// ============================================================

export type PipelineStepStage =
  | 'parse'       // 自然语言理解
  | 'resolve'     // Schema Resolver（列映射）
  | 'compile'     // TaskCompiler（TaskPlan → ExecutionPlan）
  | 'repair'      // EIC Repair（自动修复）
  | 'execute'     // Execution Engine
  | 'verify';     // Result Verification

export type PipelinePath = 'AI' | 'RULE';

export interface PipelineStepRecord {
  stage: PipelineStepStage;
  status: 'ok' | 'failed' | 'skipped';
  detail: string;
  data?: unknown;
}

export interface PipelineTrace {
  id: string;
  timestamp: string;
  userInput: string;

  // === Path determination ===
  path: PipelinePath;
  aiUsed: boolean;
  aiAvailable: boolean;
  aiError?: string;

  // === AI raw output ===
  aiRawContent?: string;
  aiTaskPlan?: unknown;

  // === Rule path output ===
  ruleIntent?: unknown;
  ruleTaskPlan?: unknown;

  // === Schema ===
  schemaResolverUsed: boolean;
  schemaResolution?: unknown;

  // === Compilation ===
  compilerModifiedColumns: boolean;
  compilerError?: string;

  // === Final ===
  finalExecutionPlan?: unknown;
  finalOperation: string;
  confidence: number;

  // === Engine dispatch ===
  enginePath: 'V2' | 'V1_LEGACY' | 'SKIPPED';

  // === Execution ===
  executionSuccess: boolean;
  executionError?: string;
  rowsBefore?: number;
  rowsAfter?: number;

  // === Verification ===
  verificationPassed?: boolean;
  verificationChecks?: Array<{ name: string; passed: boolean; detail: string }>;

  // === Per-step detail ===
  steps: PipelineStepRecord[];
}

// ============================================================
// Trace Collector — 单次请求的追踪容器
// ============================================================

let currentTrace: PipelineTrace | null = null;
let traceIdCounter = 0;

export type TraceUpdateCallback = (trace: PipelineTrace | null) => void;
let updateCallback: TraceUpdateCallback | null = null;

/** 注册 trace 更新回调（debug UI 用） */
export function onTraceUpdate(cb: TraceUpdateCallback): void {
  updateCallback = cb;
}

/** 取消回调 */
export function offTraceUpdate(): void {
  updateCallback = null;
}

function notify(): void {
  if (updateCallback && currentTrace) {
    updateCallback({ ...currentTrace });
  }
}

/** 开启一次新追踪 */
export function startTrace(userInput: string): string {
  traceIdCounter++;
  const traceId = `trace-${traceIdCounter}-${Date.now()}`;
  currentTrace = {
    id: traceId,
    timestamp: new Date().toISOString(),
    userInput,
    path: 'RULE',
    aiUsed: false,
    aiAvailable: false,
    schemaResolverUsed: false,
    compilerModifiedColumns: false,
    finalOperation: '',
    confidence: 0,
    enginePath: 'SKIPPED',
    executionSuccess: false,
    steps: [],
  };
  notify();
  return traceId;
}

/** 获取当前 trace */
export function getCurrentTrace(): PipelineTrace | null {
  return currentTrace;
}

/** 追加步骤记录 */
export function addTraceStep(
  stage: PipelineStepStage,
  status: 'ok' | 'failed' | 'skipped',
  detail: string,
  data?: unknown,
): void {
  if (!currentTrace) return;
  currentTrace.steps.push({ stage, status, detail, data });
  notify();
}

/** 标记路径 */
export function setTracePath(
  path: PipelinePath,
  aiUsed: boolean,
  aiAvailable: boolean,
  aiError?: string,
): void {
  if (!currentTrace) return;
  currentTrace.path = path;
  currentTrace.aiUsed = aiUsed;
  currentTrace.aiAvailable = aiAvailable;
  if (aiError !== undefined) currentTrace.aiError = aiError;
  notify();
}

/** 记录 AI 原始输出 */
export function setTraceAIOutput(
  rawContent?: string,
  taskPlan?: unknown,
): void {
  if (!currentTrace) return;
  currentTrace.aiRawContent = rawContent;
  currentTrace.aiTaskPlan = taskPlan;
  notify();
}

/** 记录规则解析输出 */
export function setTraceRuleOutput(
  intent?: unknown,
  taskPlan?: unknown,
): void {
  if (!currentTrace) return;
  currentTrace.ruleIntent = intent;
  currentTrace.ruleTaskPlan = taskPlan;
  notify();
}

/** 记录 Schema 解析 */
export function setTraceSchemaResolution(
  used: boolean,
  resolution?: unknown,
): void {
  if (!currentTrace) return;
  currentTrace.schemaResolverUsed = used;
  if (resolution !== undefined) currentTrace.schemaResolution = resolution;
  notify();
}

/** 记录编译结果 */
export function setTraceCompile(
  modifiedColumns: boolean,
  error?: string,
): void {
  if (!currentTrace) return;
  currentTrace.compilerModifiedColumns = modifiedColumns;
  if (error !== undefined) currentTrace.compilerError = error;
  notify();
}

/** 记录最终 ExecutionPlan */
export function setTraceFinalPlan(
  plan: unknown,
  operation: string,
  confidence: number,
): void {
  if (!currentTrace) return;
  currentTrace.finalExecutionPlan = plan;
  currentTrace.finalOperation = operation;
  currentTrace.confidence = confidence;
  notify();
}

/** 记录引擎执行 */
export function setTraceExecution(
  enginePath: 'V2' | 'V1_LEGACY' | 'SKIPPED',
  success: boolean,
  error?: string,
  rowsBefore?: number,
  rowsAfter?: number,
): void {
  if (!currentTrace) return;
  currentTrace.enginePath = enginePath;
  currentTrace.executionSuccess = success;
  if (error !== undefined) currentTrace.executionError = error;
  if (rowsBefore !== undefined) currentTrace.rowsBefore = rowsBefore;
  if (rowsAfter !== undefined) currentTrace.rowsAfter = rowsAfter;
  notify();
}

/** 记录验证结果 */
export function setTraceVerification(
  passed: boolean,
  checks?: Array<{ name: string; passed: boolean; detail: string }>,
): void {
  if (!currentTrace) return;
  currentTrace.verificationPassed = passed;
  if (checks !== undefined) currentTrace.verificationChecks = checks;
  notify();
}

/** 完成追踪 */
export function finishTrace(): void {
  notify();
}
