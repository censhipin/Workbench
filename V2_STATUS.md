# Data Workbench V2 重构 — 当前状态

> 最后更新：2026-06-29
>
> 继续时先读此文件。

---

## 已完成

### Phase 1 — DataEngine V2 基础层重构 ✅

**目标**：底层数据执行能力标准化

**新增文件：**
- `lib/v2/types.ts` — Operator 枚举（14 种）+ ConditionExpr 接口
- `lib/v2/predicate.ts` — evaluateCondition() 统一求值函数

**修改文件：**
- `lib/data-engine.ts` — filterRowsMulti 内部替换为 evaluateCondition；新增 parseOperator 映射函数；filterRows 签名放宽
- `lib/execution-engine.ts` — filter case 的 conditions 类型放宽，dateRange 走 BETWEEN

**新增测试：**
- `lib/__tests__/v2-predicate.test.ts`（44 个测试）

### Phase 2 — TaskCompiler + ExecutionPlan ✅

**目标**：让 TaskPlan 有稳定的中间层

**新增文件：**
- `lib/v2/execution-plan.ts` — 7 种操作统一执行协议类型
- `lib/v2/task-compiler.ts` — TaskPlan → ExecutionPlan 编译器

**新增测试：**
- `lib/__tests__/v2-task-compiler.test.ts`（26 个测试）

### Phase 3 — V2 执行引擎 runExecutionPlan ✅

**目标**：根据 ExecutionPlan.type 分发到 DataEngine 方法

**新增文件：**
- `lib/v2/execution-engine.ts` — runExecutionPlan() 函数（7 种操作 type switch）

**新增测试：**
- `lib/__tests__/v2-execution-engine.test.ts`（11 个单元测试）

### Phase 4 — 真实链路接入 ✅

**目标**：runExecutionEngine() 优先走 V2 路径

**修改文件：**
- `lib/types.ts` — TaskIntent 新增 `v2plan?` 字段
- `lib/nlu/index.ts` — parseIntentWithAI 返回前执行 compile()，结果附加到 intent.v2plan
- `lib/execution-engine.ts` — runExecutionEngine 检测 intent.v2plan，存在则走 runExecutionPlan()

**没有改动：** page.tsx、ExecutionEngine.execute（保留作为 fallback）

**新增测试：**
- `lib/__tests__/v2-execution-engine.test.ts` 追加 3 个集成测试（v2plan dispatch、旧链路回退、错误明确）

---

## 当前执行链（默认路径）

```
DeepSeek
  ↓ 返回 TaskPlan（json）
parseIntentWithAI
  ↓
TaskCompiler.compile()          ← 新增：编译为 ExecutionPlan
  ↓ 同时 taskPlanToIntent()     ← 旧转换器继续保留
  ↓
TaskIntent.v2plan = ExecutionPlan
  ↓
runExecutionEngine()
  ↓
┌─ intent.v2plan 存在? ──→ runExecutionPlan() ──→ DataEngine
└─ 否 ──→ ExecutionEngine.execute()（旧 fallback）
  ↓
结果
```

## Fallback 策略

1. **优先 V2**：如果 `intent.v2plan` 存在，走 `runExecutionPlan()`
2. **旧链路兜底**：没有 v2plan 时走 `ExecutionEngine.execute()`（完全不变）
3. **无静默回退**：V2 编译失败或执行失败时返回明确错误，不自动降级到旧逻辑
4. **page.tsx 零改动**：外部调用 `runExecutionEngine(intent, ...)` 签名不变

## 测试状态

全部 147 个测试通过：

| 文件 | 数量 | 状态 |
|------|------|------|
| `lib/__tests__/data-engine.test.ts` | 原 74 个 | ✅ |
| `lib/__tests__/execution-engine.test.ts` | (含在 74 中) | ✅ |
| `lib/__tests__/audit-engine.test.ts` | (含在 74 中) | ✅ |
| `lib/__tests__/ambiguity-detector.test.ts` | (含在 74 中) | ✅ |
| `lib/__tests__/v2-predicate.test.ts` | 44 个 | ✅ |
| `lib/__tests__/v2-task-compiler.test.ts` | 26 个 | ✅ |
| `lib/__tests__/v2-execution-engine.test.ts` | 14 个 | ✅ |

---

## 下一步（Phase 5 — OperationExecutor）

当前 `runExecutionPlan` 内部还是 type switch。下一阶段拆成独立的 OperationExecutor。

todo:
1. 「不做」单元测试重构（现有测试继续有效）
2. 「不做」page.tsx 修改
3. 「不做」旧链路删除

---

## 关键文件索引

| 路径 | 说明 |
|------|------|
| `lib/v2/types.ts` | Operator 枚举、ConditionExpr |
| `lib/v2/predicate.ts` | evaluateCondition() |
| `lib/v2/execution-plan.ts` | ExecutionPlan 7 种类型 |
| `lib/v2/task-compiler.ts` | compile() 函数 |
| `lib/v2/execution-engine.ts` | runExecutionPlan() V2 执行入口 |
| `lib/data-engine.ts` | filterRowsMulti（已改为 V2） |
| `lib/execution-engine.ts` | runExecutionEngine（顶层入口，含 V2 dispatch） |
| `lib/nlu/index.ts` | parseIntentWithAI（含 compile 调用） |
| `lib/nlu/taskplan-converter.ts` | TaskPlan → TaskIntent（旧转换器） |
| `lib/nlu/taskplan-types.ts` | TaskPlan 类型定义 |
| `lib/types.ts` | TaskIntent（含 v2plan? 字段） |
| `app/page.tsx` | handleSubmit（未改动） |
| `lib/__tests__/v2-predicate.test.ts` | Phase 1 测试 |
| `lib/__tests__/v2-task-compiler.test.ts` | Phase 2 测试 |
| `lib/__tests__/v2-execution-engine.test.ts` | Phase 3+4 测试 |
