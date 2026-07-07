# 完整执行链映射

## 1. 完整调用链（V2 当前）

```
用户输入
  │
  ▼
lib/nlu/deepseek.ts: deepseekUnderstand()
  │  AI 解析，返回 TaskPlan
  │
  ▼
lib/nlu/index.ts: parseIntentWithAI()
  │  taskPlanToIntent() + compile() → v2plan
  │  或降级到 RuleBasedSemanticParser
  │
  ▼
lib/execution-engine.ts: runExecutionEngine()
  │  检查 intent.v2plan 是否存在
  │  检查 currentSheet
  │
  ├─▶ lib/v2/execution-engine.ts: runExecutionPlan()
  │     │
  │     ├─▶ lib/v2/task-compiler.ts: compile()
  │     │     TaskPlan → ExecutionPlan
  │     │     编译各 action 为对应 Plan 类型
  │     │
  │     ├─▶ lib/v2/plan-validator.ts: validatePlan()
  │     │     校验列存在性、操作合法性
  │     │
  │     ├─▶ lib/v2/execution-snapshot.ts: createSnapshot()
  │     │     深度克隆输入数据
  │     │
  │     ├─▶ lib/v2/executors/registry.ts: registry.get()
  │     │     从 Map 查找 Executor
  │     │
  │     ├─▶ lib/v2/executors/*Executor.ts: execute()
  │     │     11 种 Executor，调用 data-engine 底层函数
  │     │
  │     ├─▶ lib/v2/output-processor/run-output.ts: runOutputProcessor()
  │     │     include/exclude/rename/reorder/limit 输出约束
  │     │
  │     ├─▶ lib/v2/verifier/run-verification.ts: runVerification()
  │     │     按计划类型验证执行结果
  │     │
  │     └─▶ lib/v2/execution-snapshot.ts: cloneResult()
  │           深度克隆输出
  │
  ├─▶ PlanStepBuilder.build()
  │     生成 5 步 UI 展示计划
  │
  └─▶ buildErrorMessage()
        生成友好错误消息
```

## 2. 节点逐项分析

| 节点 | 文件 | 输入 | 输出 | V2 缺口 | V3 归属 |
|------|------|------|------|---------|---------|
| deepseekUnderstand | lib/nlu/deepseek.ts | prompt, columns | TaskPlan | 无置信度评分；无语义验证 | Layer 0 NLU |
| parseIntentWithAI | lib/nlu/index.ts | prompt | {intent, aiUsed} | compile 失败仅静默设 v2plan=undefined | Layer 0 NLU |
| compile | lib/v2/task-compiler.ts | TaskPlan | ExecutionPlan | 列不存在=硬失败，无模糊匹配 | Layer 1 AI（auto-fix） |
| resolveColumn | lib/v2/task-compiler.ts | hint, ctx | columnKey/null | 纯粹文本匹配，无值反查 | Layer 1 AI（auto-fix） |
| runExecutionEngine | lib/execution-engine.ts | intent | EngineRunResult | 无数据画像，v2plan缺失无降级 | Layer 3 Execution |
| validatePlan | lib/v2/plan-validator.ts | plan, columns | {valid, plan, issues} | 仅列存在性和类型校验，无语义校验 | Layer 3 Execution + Layer 1 AI |
| createSnapshot | lib/v2/execution-snapshot.ts | columns, rows | snapshot | 深度克隆性能影响未评估 | Layer 3 Execution |
| registry.get | lib/v2/executors/registry.ts | type | executor/undefined | 未知类型返回undefined，调用者处理粗糙 | Layer 3 Execution |
| **executor.execute** | lib/v2/executors/**.ts | plan, ctx | ExecutorResult | **盲目执行，无数据感知策略** | Layer 3 Execution（但需 EIC Profile 前置） |
| **FilterExecutor** | lib/v2/executors/FilterExecutor.ts | plan | result | 无预检查值是否存在；0匹配行无解释 | Layer 3 + EIC |
| **AggregateExecutor** | lib/v2/executors/AggregateExecutor.ts | plan | result | 非数值列产生NaN，无警告 | Layer 3 + EIC |
| **FormulaExecutor** | lib/v2/executors/FormulaExecutor.ts | plan | result | NaN自动转0，无提示；除零得Infinity | Layer 3 + EIC |
| runOutputProcessor | lib/v2/output-processor/ | rows, cols | processed | 列不存在静默跳过，无建议 | Layer 3 Execution |
| runVerification | lib/v2/verifier/ | plan, in, out | VerificationResult | 验证失败仅返回detail字符串 | Layer 4 Verification + EIC Explain |
| PlanStepBuilder.build | lib/execution-engine.ts | intent, etc | PlanStep[] | 仅展示"成功/失败"，无解释 | Layer 5 Presentation |
| buildErrorMessage | lib/execution-engine.ts | validation, execution | string | **原始字符串，无结构，无建议** | Layer 1 AI（替代为目标） |
| runAudit | lib/audit-engine.ts | rows, cols | AuditReport | **完全独立于执行流程** | Layer 2 Profile（集成目标） |

## 3. 数据流缺口汇总

| 缺口 | 当前表现 | V3 目标 |
|------|---------|---------|
| 列缺失 | 硬错误"找不到列X" | 模糊匹配+建议+自动修复 |
| 类型不匹配 | NaN/Infinity 静默产生 | 预检查+警告+自动跳过 |
| 0 匹配结果 | 无任何解释 | "筛选条件仅匹配0/N行，因为..." |
| 聚合解释 | 只有一个数字 | 含统计上下文（跳过了多少空值） |
| 执行错误 | "执行失败" | 原因+建议+自动修复+影响 |
| 数据质量 | 仅在审计标签页可见 | 执行前 Profile 直接参与决策 |
| 验证失败 | "结果验证失败: ..." | 逐条解释+修复建议 |

## 4. 关键数据流变更（V2 → V3）

```
V2:
  TaskIntent → validatePlan → snapshot → execute → outputProcess → verify → buildError
                                                                                      ↓
                                                                                原始字符串

V3:
  TaskIntent → EIC.profile → EIC.validate → EIC.repair → snapshot
    → execute (V2 unchanged) → outputProcess → verify (V2 unchanged)
    → EIC.explain → structured ErrorRecord[] → PlanStepBuilder (增强)
```
