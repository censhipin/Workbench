# Execution Engine

## 作用

接收已解析的 TaskIntent（含可选的 v2plan），执行实际的数据处理操作（排序、筛选、求和、去重等），返回处理后的数据结果加上执行计划步骤和验证报告。

## 入口

`lib/execution-engine.ts:608` — `runExecutionEngine()`

```typescript
runExecutionEngine(
  intent: TaskIntent,
  mainFile: WorkbenchFile,
  currentSheetName: string,
  taskFiles: WorkbenchFile[]
): EngineRunResult
```

EngineRunResult 包含：`success`, `steps: PlanStep[]`, `resultData`, `resultSummary`, `verification`, `error`

## 内部架构

### 5 步流水线

1. **InputValidator.validate()** — 校验 intent 是否有效、文件/列是否存在
2. **V2 路径优先** — 如果有 `intent.v2plan`，走 V2 执行引擎
3. **旧路径 fallback** — 无 v2plan 时走 `ExecutionEngine.execute()`
4. **ResultVerifier.verify()** — 验证执行结果正确性
5. **PlanStepBuilder.build()** — 生成 5 个步骤的执行计划展示数据

### V2 执行引擎 (`lib/v2/execution-engine.ts`)

```
runExecutionPlan(plan, mainSheet, taskSheets)
  → ExecutorRegistry.get(plan.type) → Executor.execute(plan, context)
  → OutputProcessor (统一输出格式处理)
  → Verifier (逐条验证结果)
  → return ExecutionResult
```

### Executor 注册中心 (`lib/v2/executors/registry.ts`)

全局单例 `ExecutorRegistry` 维护 Map<string, OperationExecutor>。

### 已注册的 11 种 Executor

| Executor | 文件 | 操作说明 |
|----------|------|---------|
| FilterExecutor | v2/executors/FilterExecutor.ts | 多条件 AND 筛选 |
| SortExecutor | v2/executors/SortExecutor.ts | 多列排序（支持升降序） |
| AggregateExecutor | v2/executors/AggregateExecutor.ts | 求和/平均/计数/最大/最小（可分组） |
| DedupExecutor | v2/executors/DedupExecutor.ts | 按指定列去重 |
| MatchExecutor | v2/executors/MatchExecutor.ts | 多表匹配（VLOOKUP 风格） |
| MergeExecutor | v2/executors/MergeExecutor.ts | 多表纵向合并 |
| CleanExecutor | v2/executors/CleanExecutor.ts | 数据清洗（空行/异常值） |
| ProjectionExecutor | v2/executors/ProjectionExecutor.ts | 列选择/删除/重命名/排序 |
| UpdateExecutor | v2/executors/UpdateExecutor.ts | 批量修改列值（可带条件） |
| FormulaExecutor | v2/executors/FormulaExecutor.ts | 公式计算（四则运算/IF/文本/日期函数） |
| PipelineExecutor | v2/executors/PipelineExecutor.ts | 多步顺序执行（上步输→下步入） |

### 如何新增 Executor

1. 创建文件 `lib/v2/executors/YourExecutor.ts`，实现 `OperationExecutor` 接口
2. 在 `lib/v2/execution-engine.ts` 的 `registry.registerAll()` 中添加
3. TaskCompiler 中 `compile()` 函数新增该 action 的处理
4. （可选）在 `lib/v2/verifier/` 中添加对应的 Verifier

## 旧引擎 (`lib/execution-engine.ts`)

`ExecutionEngine.execute()` 是旧实现，通过 `intent.operation` 做 switch-case 分发，直接调用 `lib/data-engine.ts` 的函数。当前仅作为 v2plan 为 undefined 时的 fallback。

【历史设计】ExecutionEngine.execute() 是唯一的执行路径  
【当前实现】runExecutionEngine 优先检查 intent.v2plan，有则走 V2，无则走旧引擎  
【后续计划】旧引擎可在 v2plan 覆盖所有操作类型后移除

## 数据引擎 (`lib/data-engine.ts`)

提供底层数据操作函数：`sortRows`, `sortRowsMulti`, `filterRows`, `filterRowsMulti`, `filterByDateRange`, `sumColumn`, `dedupRows`, `matchMultiTables`, `mergeTables`, `cleanData`, `aggregateRows`。

V2 Executor 内部调用这些函数完成实际数据运算。
