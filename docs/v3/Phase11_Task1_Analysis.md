# Phase 11 Task 1 — 问题分析报告

审计日期：2026-07-07
阶段：Phase 11 — Stability & Release Preparation
角色：维护工程师 + QA 负责人 + 发布工程师

---

## Bug 1：MatchExecutor Left Join 错误

### 问题位置
`lib/data-engine.ts` 中两个函数：
- `matchTwo()` — 第 368-381 行（追加未匹配右表行）
- `matchTwoMulti()` — 第 315-325 行（追加未匹配右表行）
- `matchMultiTables()` — 第 404 行（累积匹配计数错误）

### 根本原因
`matchTwo` 和 `matchTwoMulti` 在完成左表→右表的匹配后，会额外执行一段逻辑：**遍历所有未匹配的右表行，将其追加到结果中**。这导致 Left Join 变成了类似 Full Outer Join 的行为。

```
当前行为（错误）:
  左表: A, B, C
  右表: A, D
  结果: A(匹配) + B(null) + C(null) + D(null)  ← D 是多余行

正确行为:
  结果: A(匹配) + B(null) + C(null)
```

`matchMultiTables` 中 `totalMatched += r.matched` 累积计数也会出错，因为每次 join 迭代后 `main` 表行数已变化（由于追加了未匹配行），第二次迭代的匹配计数包含了对追加行的匹配。

### 修改方案
1. 在 `matchTwo` 中删除第 368-381 行的"追加未匹配右表行"逻辑
2. 在 `matchTwoMulti` 中删除第 315-325 行的"追加未匹配右表行"逻辑
3. 修复 `matchMultiTables` 中 `totalMatched` 使基于原始左表行数

### 风险影响
- 低风险：删除的是追加逻辑，只影响已匹配的行和左表保留行
- 需要同步更新 `matchMultiTables` 的计数逻辑
- 会影响依赖于"会追加未匹配右表行"的代码（如有）

---

## Bug 2：AggregateExecutor 空分组语义错误

### 问题位置
`lib/v2/executors/AggregateExecutor.ts` — `aggregate()` 函数第 166-167 行

### 根本原因
`aggregate()` 函数在 `nums.length === 0`（无可聚合的数据）时，统一返回 `0`。但在语义上：

| 方法 | nums.length === 0 的语义 | 应返回 |
|------|--------------------------|--------|
| SUM | 没有数字可加 | 0（加法的单位元） |
| COUNT | 没有行可计 | 0 |
| AVG | 无法计算平均值 | null |
| MAX | 无法确定最大值 | null |
| MIN | 无法确定最小值 | null |

### 修改方案
1. 将 `aggregate()` 返回类型从 `number` 改为 `number | null`
2. AVG/MAX/MIN 在空数组时返回 `null`
3. SUM/COUNT 保持不变（返回 `0`）

### 风险影响
- 低风险：只影响边界情况（分组内无有效数值数据）
- Explain 层和 UI 已经能处理 null 值
- 需要更新测试验证 null 输出

---

## Bug 3：FormulaExecutor 错误处理

### 问题位置
`lib/v2/executors/FormulaExecutor.ts` — 第 42-44 行

### 根本原因
当 `executeFormula()` 返回 `result.error` 时，当前代码静默地将所有行的目标列设为 `null`：

```ts
if (result.error) {
  resultRows = inputRows.map(row => ({ ...row, [targetColumn]: null }));
}
```

这导致：
1. 用户看到大量 null 值但不知道原因
2. `executeFormula` 内部已经提供了详细的错误信息（如"括号数量不匹配"），但被吞掉了
3. 没有任何路径把这些错误推向 Explain 层或 ErrorDialog

### 修改方案
将静默置 null 替换为抛出包含详细错误信息的异常。异常信息应包含：
- 错误代码（FormulaErrorCode）
- 人类可读的错误描述
- 建议的修复步骤

### 风险影响
- 低风险：目前的行为（静默失败）本身就有问题，用户的体验更差
- 修改后用户能看到明确的错误信息
- 需要确保 Explain 层正确处理此错误

---

## Bug 4：Mock 数据污染生产

### 问题位置
`app/page.tsx` — 初始化 useEffect（约第 152-169 行）
`lib/mock-data.ts` — 所有 mock 数据定义

### 根本原因
在 `page.tsx` 的初始化 useEffect 中：

```ts
const allMap = new Map<string, WorkbenchFile>();
for (const f of mockFiles) allMap.set(f.id, f);       // 始终加入 mock 文件
for (const f of savedFiles) if (f && f.id) allMap.set(f.id, f);
const allFiles = Array.from(allMap.values());
setFiles(allFiles.length > 0 ? allFiles : mockFiles);  // mock 回退
```

`mockFiles` 总是被合并到文件列表中，即使是从 IndexedDB 加载了真实文件。这意味着生产环境中用户总能看到示例文件。

### 修改方案
1. 创建环境判断：仅开发/演示模式加载 mock 数据
2. 或者彻底移除生产构建中的 mock 数据引入
3. Mock 数据仅用于开发测试，不进入生产渲染

### 风险影响
- 低风险：移除 mock 不影响核心功能
- 新用户首次打开时将看不到演示数据（需自行上传文件），可以保留一个空状态引导

---

## Bug 5：Verification Engine 未真正接入

### 问题位置
`lib/execution-engine.ts` — 第 318-335 行
`lib/v2/execution-engine.ts` — 第 110 行

### 根本原因
生产执行链中存在两套验证体系：

1. **V2 verifier**（`lib/v2/verifier.ts`）— 在 `lib/v2/execution-engine.ts:110` 的 `runExecutionPlan` 中被调用
2. **V3 verification-engine**（`lib/v3/verification/verification-engine.ts`）— 从未在生产管线中被调用

`lib/execution-engine.ts` 第 318-335 行并未调用 V3 verifier，而是自己构造了一个占位 verification 对象：

```ts
if (executionResult?.success) {
  verification = {
    passed: true,
    checks: [{ name: 'V2 结果验证', passed: true, detail: 'V2 执行引擎已完成结果验证' }],
  };
}
```

这导致 V3 Verification 的 120 个测试虽然覆盖了 9 个 Verifier，但实际从未在生产中使用。

### 修改方案
在 `lib/execution-engine.ts` 中，当 V2 执行完成后，额外调用 V3 `verifyExecution()` 并将结果并入 verification 中。最小修改：
1. 引入 V3 verification-engine
2. 在 V2 执行结果的基础上，增加 V3 Verifier 调用
3. V2 verifier 保持不变（V2 不变原则）

### 风险影响
- 低-中风险：引入 V3 Verification 可能带来新的失败条件
- V3 Verification 已在 120 个测试中验证过
- Explain 层已能处理 VerificationResult
- 需要测试确保 V2 路径不被破坏

---

## 各 Bug 修改优先级与依赖关系

| Bug | 修改依赖 | 影响范围 | 建议顺序 |
|-----|----------|----------|----------|
| Bug 4: Mock 数据 | 无 | page.tsx 初始化 | 1（最简单，独立） |
| Bug 2: Aggregate | 无 | AggregateExecutor | 2（独立） |
| Bug 3: Formula | 无 | FormulaExecutor | 3（独立） |
| Bug 1: Match | 无 | data-engine.ts | 4（独立） |
| Bug 5: V3 Verification | 需 Bug 1-4 修复后 | execution-engine.ts | 5（集成，最后） |

---

*分析完毕。确认方案后进入代码修改。*
