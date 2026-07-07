# V3 Phase 5 — Repair Engine 接入执行主链 交付报告

> 生成日期：2026-07-06
> 核心变更：`lib/execution-engine.ts`（+60 行）、`app/page.tsx`（+8 行）、`lib/v3/` 增量修改

---

## 一句话

**Phase 4 建好了 Repair 工厂，Phase 5 把工厂接到流水线上。**

现在每次执行前 Repair 是强制必经路径，不再是可选的旁路。

---

## 修改了什么

### 核心变更：`lib/execution-engine.ts`（5 处修改）

**① 执行流变更（第 267-284 行）**：

```typescript
// Before (Phase 4):
Profile → Validate → Execution（Repair 是独立函数，不在链上）

// After (Phase 5):
Profile → Repair（强制）→ Validate（修复后 plan）→ Execution（修复后 plan）→ RepairReport
```

关键代码：

```typescript
// 1. 建 columnIndex（值→列反推用）
const columnIndex = buildColumnValueIndex(currentSheet.columns, currentSheet.rows);

// 2. Repair 强制执行，修复后的 plan 替代原始 plan
const repairResult = repairPlan(repairedPlan, {
  columns: currentSheet.columns,
  rows: currentSheet.rows,
  profile: dataProfile,
  columnIndex,
});
repairedPlan = repairResult.plan;

// 3. 执行使用修复后的 plan（而不是 intent.v2plan）
executionResult = runExecutionPlan(repairedPlan, ...);
```

**② `EngineRunResult` 扩展（第 65-77 行）**：

```typescript
export interface EngineRunResult {
  // ... 原有字段 ...
  repairReport?: RepairReport;     // 修复报告（新增）
  repairedPlan?: ExecutionPlan;    // 修复后的 plan（新增）
}
```

**③ `PlanStepBuilder.build()` 增强（第 188-208 行）**：

- 第 4 个参数 `repairReport`：Step-2（验证输入参数）展示自动修复摘要
- Step-5（生成结果报告）展示修复建议

```
Step-2 示例：
  ✓ 验证输入参数
    自动修复：3 个列名模糊匹配（城市→部门→薪资）

Step-5 示例：
  ✓ 生成结果报告
    修复建议：工资列包含"100元"格式，已自动转换为 100
```

**④ `buildErrorMessage()` 增强（第 348-380 行）**：

```typescript
function buildErrorMessage(..., repairReport?: RepairReport): string {
  // 原有逻辑...
  if (repairReport && repairReport.successCount > 0) {
    msg += `（已自动修复 ${repairReport.successCount} 项）`;
  }
  return msg;
}
```

**⑤ `pipeline-trace.ts`（第 12 行）**：

```typescript
export type PipelineStepStage =
  | 'parse' | 'resolve' | 'compile' | 'repair' | 'execute' | 'verify';
  //                                    ^ 新增
```

### UI 变更：`app/page.tsx`（3 处）

① **错误弹窗增强**（失败时告知用户做了什么修复）：
```
⚠️ 执行失败
找不到列"城市名"（已自动修复 3 项）
━━━━━━━━━━━━━━━━━━━━━━━━━
系统已自动修复 1 项问题
1 个列名模糊匹配已自动修复
```

② **控制台日志**：
```typescript
if (engineResult.repairReport?.repairs.length > 0) {
  console.info('[EIC Repair]', engineResult.repairReport.summary);
}
```

### `lib/v3/repair/repair-types.ts` 新增（第 75-79 行）

```typescript
export interface EICContext {
  profile: DataProfile | null;
  repairResult: RepairResult | null;
  repairedPlan: ExecutionPlan | null;
}
```

---

## 当前执行链（Phase 5 完成态）

```
用户输入
  │
  ▼
NLU（V2，不变）
  │   ├─ AI（DeepSeek）→ TaskPlan
  │   └─ 规则降级 → TaskPlan
  │
  ▼
compile → ExecutionPlan（V2，不变）
  │
  ▼
runExecutionEngine（入口，已修改）
  │
  ├── buildDataProfile（Phase 2）→ DataProfile
  │
  ├── buildColumnValueIndex（Phase 4）→ 列值索引
  │
  ├── repairPlan（Phase 4+5）→ 修复后的 plan + RepairReport
  │     • 列名模糊匹配（城市名 → city）
  │     • 值→列反推（"杭州" → city=杭州）
  │     • 类型转换（"100元" → 100）
  │     • Join 键模糊匹配（杭州 ↔ 杭州市）
  │     • 公式 AST 解析校验
  │     • 空值统一处理
  │
  ├── validatePlan（V2，使用修复后的 plan）
  │
  ├── runExecutionPlan（V2，使用修复后的 plan）
  │     • Executor.execute（V2，不变）
  │     • OutputProcessor（V2，不变）
  │     • Verifier（V2，不变）
  │
  ├── PlanStepBuilder（含 RepairReport 注入）
  │     • Step-1: 解析用户意图（不变）
  │     • Step-2: 验证输入参数 + 自动修复展示 ✅
  │     • Step-3: 执行数据处理（不变）
  │     • Step-4: 验证执行结果（不变）
  │     • Step-5: 生成结果报告 + 修复建议 ✅
  │
  └── return EngineRunResult { repairReport, repairedPlan, ... }
```

---

## 测试结果

- **511 个测试通过**（+6 新增集成测试）
- 1 个已知预先失败测试（T7 merge）非本次变更
- 新增测试覆盖：
  - `repair-integration.test.ts`（6 个用例）
    - 模糊列名 Repair → Validate → Execution 全链路 ✅
    - 类型转换 "100元" → 100 全链路 ✅
    - 零修复场景（无退化） ✅
    - 值→列反推 "杭州的数据" → city = 杭州 ✅
    - EngineRunResult 字段完整性 ✅
    - Pipeline 子步骤递归修复 ✅
- 所有 Phase 4 的 89 个 repair 单元测试不变 ✅
- 所有 347 个 V2 测试不变 ✅

---

## 不修改的文件

| 模块 | 原因 |
|------|------|
| `lib/v2/` 全部 20+ 文件 | V2 不变性原则 |
| `lib/v3/profile/` 全部文件 | Phase 2 产出 |
| `lib/v3/repair/column-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/type-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/formula-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/join-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/null-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/value-repair.ts` | Phase 4 已交付 |
| `lib/v3/repair/repair-report.ts` | Phase 4 已交付 |
| `components/taskpanel/ExecutionPlan.tsx` | UI 修复卡片（Phase 9） |

---

## 仍待后续 Phase

| 项目 | 说明 | 计划 Phase |
|------|------|------------|
| **AST 求值** | FormulaExecutor 仍使用 expressionType 枚举分发，未接入 parseFormula 的 AST | Phase 6+ |
| **isNull() 集成到 predicate.ts** | predicate.ts 和 data-engine.ts 仍使用旧空值判断逻辑 | Phase 7+ |
| **规范化值比较集成** | Filter/Join 执行路径未接入 normalizeValue | Phase 7+ |
| **UI Repair 卡片** | ExecutionPlan 组件还未渲染专门的修复卡片（当前靠 Step-2 的文本子项展示） | Phase 9 |
| **失败重试** | 当前 repair 只尝试一次，失败后没有二次 repair 重试 | Phase 8+ |
