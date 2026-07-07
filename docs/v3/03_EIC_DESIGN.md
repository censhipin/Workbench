# Execution Intelligence Center（EIC）设计

## 1. EIC 在链中的位置

```
V2:
  ExecutionPlan → validatePlan → Executor → OutputProcessor → Verifier → [PlanStepBuilder → string]

V3:
  ExecutionPlan → EIC.profile() → EIC.validate() → EIC.repair()
    → Executor (V2 不变) → Verifier (V2 不变) → EIC.explain()
    → structured ErrorRecord[] → 增强 PlanStepBuilder → UI
```

## 2. EIC 四个子模块

### 2.1 Profile — 数据画像

**用途**：执行前理解数据，为后续决策提供依据。

```
输入: {columns, rows}, ExecutionPlan
输出: DataProfile
处理:
  1. 基本统计（行数、列数）
  2. 每列分析（类型分布、空值率、唯一值率、值范围、高频值）
  3. 质量评分（复用 audit-engine 的 computeQualityScore）
  4. 模式检测（日期格式、金额格式、特殊模式）
  5. 执行可行性预判（列是否存在、类型是否匹配）
```

**V2 现状**：audit-engine 已有基本统计能力，但独立于执行流程且不输出结构化 profile。

**V3 设计**：包装 audit-engine 的函数，补充列级别的分布统计，输出标准 DataProfile。

### 2.2 Validate — 智能校验

**用途**：在 plan-validator 的列存在性和类型校验基础上，增加带数据上下文的语义校验。

```
输入: ExecutionPlan, DataProfile
输出: EICValidation { valid, issues: ErrorRecord[], suggestions: string[] }
处理:
  1. 列存在性校验（复用 plan-validator）
  2. 类型兼容校验（"对文本列求和" → 警告）
  3. 值存在性校验（"筛选值=XX"但数据中无此值 → 建议）
  4. 数据影响预估（"去重将删除 45/100 行" → 警告）
  5. 聚合可行性（"分组键有 50 个唯一值" → 提示结果可能很大）
```

**V2 现状**：plan-validator 只做列基本校验，无数据上下文感知。

**V3 设计**：validate 是 plan-validator 的超集，在其结果基础上叠加数据感知。

### 2.3 Repair — 自动修复

**用途**：对校验发现的可修复问题执行自动修复。

```
输入: ExecutionPlan, EICValidation, DataProfile
输出: { repairedPlan: ExecutionPlan, repairs: RepairRecord[] }
处理:
  1. 列名模糊匹配 → 类型不匹配 → 值反查 → 最佳候选
  2. 类型自动转换（数字字符串 → number、日期格式化）
  3. 空值处理策略建议
  4. 计划结构调整（如 pipeline 中某步失败）
```

**V2 现状**：无自动修复。任何错误立即终止。

**V3 设计**：repair 对所有可修复问题给出修复方案，同时对每个修复标注置信度。

### 2.4 Explain — 执行解释

**用途**：替代 buildErrorMessage 的原始字符串，生成结构化的执行解释。

```
输入: ExecutionPlan, DataProfile, ExecutorResult, VerificationResult
输出: ExecutionExplanation { summary, details: ErrorRecord[], suggestions: string[] }
处理:
  1. 执行概要（成功/失败、影响行数）
  2. 关键事件（"筛选条件匹配了 3/100 行"）
  3. 异常解释（"列 X 未找到，已自动匹配到列 Y（置信度 0.92）"）
  4. 修复记录（列出自动修复的操作）
  5. 下一步建议（"数据仅 3 行匹配，是否要放宽筛选条件？"）
```

**V2 现状**：buildErrorMessage 返回原始字符串，无结构。

**V3 设计**：explain 是 V3 的最终输出层，所有上游信息汇聚于此。

## 3. EIC 核心类型

```typescript
// EIC 上下文（贯穿所有阶段）
interface EICContext {
  plan: ExecutionPlan;
  profile: DataProfile | null;
  validation: EICValidation | null;
  repairs: RepairRecord[];
  explanation: ExecutionExplanation | null;
}

// 数据画像
interface DataProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  qualityScore: number;
  warnings: string[];
}

// 列画像
interface ColumnProfile {
  key: string;
  title: string;
  declaredType: 'text' | 'number' | 'date';
  inferredType: 'text' | 'number' | 'date' | 'mixed';
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  sampleValues: (string | number | null)[];
  numericRange?: { min: number; max: number; avg: number };
  textPatterns?: string[];
}

// 智能校验结果
interface EICValidation {
  valid: boolean;
  issues: ErrorRecord[];
  suggestions: string[];
  impactEstimate?: {
    estimatedRowsBefore: number;
    estimatedRowsAfter: number;
    estimatedChangeRate: number;
  };
}

// 修复记录
interface RepairRecord {
  type: string;
  target: string;
  original: unknown;
  fixed: unknown;
  confidence: number;
  reason: string;
}

// 结构化错误
interface ErrorRecord {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  category: ErrorCategory;
  reason: string;
  suggestion: string;
  autoFixAvailable: boolean;
  autoFixConfidence: number;
  source: string;
}

enum ErrorCategory {
  COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  VALUE_NOT_FOUND = 'VALUE_NOT_FOUND',
  OPERATOR_INVALID = 'OPERATOR_INVALID',
  PLAN_STRUCTURE = 'PLAN_STRUCTURE',
  EXECUTION_FAILURE = 'EXECUTION_FAILURE',
  VERIFICATION_FAILURE = 'VERIFICATION_FAILURE',
  DATA_QUALITY = 'DATA_QUALITY',
  AMBIGUITY = 'AMBIGUITY',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
}

// 执行解释
interface ExecutionExplanation {
  summary: string;
  status: 'success' | 'partial' | 'failed';
  details: ErrorRecord[];
  repairs: RepairRecord[];
  beforeAfter: {
    rowsBefore: number;
    rowsAfter: number;
    columnsBefore: number;
    columnsAfter: number;
  };
  suggestions: string[];
}
```

## 4. EIC 编排（伪代码）

```typescript
async function runWithEIC(
  plan: ExecutionPlan,
  data: { columns: ColumnDef[]; rows: RowData[] },
  options?: { enableProfile?: boolean; enableRepair?: boolean; enableExplain?: boolean }
): Promise<{ result: ExecutionResult; explanation?: ExecutionExplanation }> {

  const ctx: EICContext = { plan, profile: null, validation: null, repairs: [], explanation: null };

  // Step 1: Profile
  if (options?.enableProfile !== false) {
    ctx.profile = await profileData(data.columns, data.rows);
  }

  // Step 2: Validate (with data context)
  ctx.validation = validateWithContext(plan, ctx.profile);

  // Step 3: Repair
  if (options?.enableRepair !== false && ctx.validation.issues.length > 0) {
    const repairResult = repairPlan(plan, ctx.validation, ctx.profile);
    ctx.repairs = repairResult.repairs;
    plan = repairResult.repairedPlan;  // 使用修复后的计划
  }

  // Step 4: Execute (V2 unchanged)
  const execResult = runExecutionPlan(plan, data);

  // Step 5: Explain
  if (options?.enableExplain !== false) {
    ctx.explanation = await explainExecution(
      plan, ctx.profile, execResult, ctx.validation, ctx.repairs
    );
  }

  return { result: execResult, explanation: ctx.explanation };
}
```

## 5. 设计约束

- EIC **永不修改原始 ExecutionPlan**（总是返回新 plan 副本）
- EIC 必须是**运行时可选**的（有 eicEnabled 标志控制）
- EIC 必须可**独立测试**（不依赖 UI、不依赖网络）
- EIC profile() 应该是**可缓存的**（相同数据 + 相同 plan = 相同 profile）
- EIC 必须集成现有 `pipeline-trace.ts`

## 6. 与 V2 的关系

```
V2 执行链完全不变：
  plan → validatePlan → snapshot → executor.execute → outputProcess → verify → result

V3 包裹 V2：
  plan → [EIC] → [V2 不变] → [EIC.explain]
```

EIC 是 **wrapper**，不是 replacement。V2 在 EIC 内部完整运行。
