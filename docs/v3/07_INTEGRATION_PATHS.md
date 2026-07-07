# V3 集成策略与迁移路线图

## 核心原则：V2 不变性

- `lib/v2/` **永不修改**（包括 executors, verifier, output-processor, types, predicate 等）
- V3 模块仅在 `lib/v3/` 中新增
- V2 模块不得 import `lib/v3/` 任何内容
- V3 集成通过 `lib/execution-engine.ts`（V2 入口）的可选 wrapper 实现

## 集成点架构

```
V2 入口 (lib/execution-engine.ts):
  plan → runExecutionPlan → result
                              ↓
                         [当前: buildErrorMessage → string]

V3 集成后 (lib/execution-engine.ts):
  plan → [if eicEnabled] EIC.wrap(plan, data) → runExecutionPlan → result
       └────────────────── EIC 回路 ──────────────────┘
                              ↓
                         EIC.explain → ErrorRecord[]
                              ↓
                         PlanStepBuilder (增强)
```

唯一需要在 Phase 8+ 修改的 V2 文件是 `lib/execution-engine.ts`，修改方式是在其顶层添加一个可选 wrapper，不改变内部逻辑。

## Phase-by-Phase 迁移路线图

### Phase 1（当前）— 架构规划

| 工作 | 产出 |
|------|------|
| 创建 docs/v3/ 架构文档 | 10 份文档 |
| 映射完整执行链 | 执行链图、节点分析表 |
| 定义六层模型和模块职责 | 能力矩阵、职责矩阵 |
| 设计 EIC | EIC 四个子模块详细设计 |
| 设计结构化错误系统 | 错误码注册表 |
| 输出架构评审报告 | V3 Architecture Review |

**V2 影响**：无。不碰任何代码。

---

### Phase 2 — EIC Profile（数据画像层）

| 工作 | 文件 |
|------|------|
| 创建 lib/v3/ 目录结构 | `lib/v3/` |
| 定义 EIC 核心类型 | `lib/v3/types.ts`（DataProfile, ColumnProfile 等） |
| 实现数据画像器 | `lib/v3/profile/data-profiler.ts` |
| 实现列分析器 | `lib/v3/profile/column-analyzer.ts` |
| 包装 audit-engine | `lib/v3/profile/` 中复用 audit-engine 的统计函数 |
| 单元测试 | `lib/v3/__tests__/profile.test.ts` |

**测试**：新测试仅覆盖新增的 profile 功能。333 个现有测试不变。

---

### Phase 3 — 结构化错误系统 + EIC Validate

| 工作 | 文件 |
|------|------|
| 实现 ErrorRecord 类型 | `lib/v3/types.ts`（添加 ErrorRecord, ErrorCategory） |
| 实现错误码注册表 | `lib/v3/errors/error-codes.ts` |
| 实现语义校验器 | `lib/v3/validate/semantic-validator.ts` |
| 实现统计校验器 | `lib/v3/validate/statistical-validator.ts` |
| 单元测试 | `lib/v3/__tests__/validate.test.ts` |

---

### Phase 4 — EIC Repair（自动修复）

| 工作 | 文件 |
|------|------|
| 实现列修复器 | `lib/v3/repair/column-repair.ts`（值反查、模糊匹配） |
| 实现类型修复器 | `lib/v3/repair/type-repair.ts`（类型转换、空值策略） |
| 实现计划修复器 | `lib/v3/repair/plan-repair.ts`（修复编排） |
| 单元测试 | `lib/v3/__tests__/repair.test.ts` |

---

### Phase 5 — EIC Explain（执行解释）

| 工作 | 文件 |
|------|------|
| 实现执行解释器 | `lib/v3/explain/execution-explainer.ts` |
| 实现原因构建器 | `lib/v3/explain/reason-builder.ts` |
| 实现建议生成器 | `lib/v3/explain/suggestion-builder.ts` |
| 单元测试 | `lib/v3/__tests__/explain.test.ts` |

---

### Phase 6 — EIC 编排器

| 工作 | 文件 |
|------|------|
| 实现 EIC 编排器 | `lib/v3/eic.ts`（串联 profile→validate→repair→explain） |
| 实现 EIC 配置 | `lib/v3/config.ts`（eicEnabled, stage 开关） |
| 集成测试 | `lib/v3/__tests__/eic-integration.test.ts` |

---

### Phase 7 — EIC 与 V2 集成

| 工作 | 文件 |
|------|------|
| 修改 lib/execution-engine.ts | 添加可选 EIC wrapper |
| 修改 EngineRunResult | 添加可选的 explanation 字段 |
| 修改 PlanStepBuilder | 消费 ErrorRecord[] 展示结构化信息 |
| 替换 buildErrorMessage | 逐步迁移为 ErrorRecord[] |

**这是第一个修改 V2 文件的 Phase**。修改范围仅限于 `lib/execution-engine.ts` 的一个文件。

---

### Phase 8 — 功能开关与默认启用

| 工作 | 效果 |
|------|------|
| eicEnabled 默认 true | 所有新会话默认启用 EIC |
| 运行时开关 | 可通过配置禁用单个 EIC stage |
| 性能监控 | profile 缓存，避免重复计算 |

---

### Phase 9 — UI 解释展示

| 工作 | 涉及 |
|------|------|
| PlanStepBuilder 增强 | 展示 ErrorRecord 和执行解释 |
| ExecutionPlan 组件增强 | 展示 EIC 校验警告和修复建议 |
| BottomBar 提示增强 | EIC 建议展示 |

---

### Phase 10 — 全功能完成

| 工作 | 标准 |
|------|------|
| 所有 333 个 V2 测试通过 | 回归零失败 |
| EIC 各模块测试覆盖 > 80% | 新测试覆盖 |
| 端到端集成测试 | 真实场景验证 |
| 性能基准 | EIC 延迟 < 100ms |

## 迁移风险矩阵

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| EIC 增加延迟 | 中等 | Profile 可缓存；EIC 可配置禁用 |
| V2 代码被意外修改 | 低 | 严格 code review；V2 目录不可修改规则 |
| 功能蔓延 | **高** | 能力矩阵作为范围边界（禁止超出定义的能力） |
| 测试回归 | 低 | V2 测试不变；EIC 测试增量添加 |
| EIC 与 V2 结果不一致 | 中等 | EIC 修复必须标注置信度；低置信度时保持 V2 原始行为 |
