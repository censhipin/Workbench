# V3 Architecture Overview

## 为什么需要 V3？

经过 V2 阶段开发，系统已具备完整的数据处理流程（AI 理解 → TaskPlan → ExecutionPlan → Executor → Verifier），但在大量真实业务场景验证后，发现一个核心问题：

**系统目前只有"执行能力"，没有"智能执行能力（Execution Intelligence）"。**

### V2 的七个关键缺口

| # | 缺口 | 表现 | 根因 |
|---|------|------|------|
| 1 | **无数据理解** | Executor 盲目执行，不预先分析数据特征 | 无数据画像层 |
| 2 | **无智能错误处理** | 错误是原始字符串，无结构、无建议 | 无结构化错误系统 |
| 3 | **无统一智能层** | 智能判断散布在各处或完全缺失 | 无 EIC 层 |
| 4 | **无自动修复** | 失败即终止，从不尝试替代方案 | 无 Repair 机制 |
| 5 | **无执行解释** | 无法回答"为什么" | 无 Explain 模块 |
| 6 | **Audit 孤岛** | 数据质量审计独立于执行流程 | 未集成到执行链 |
| 7 | **Bug 修复模式脆弱** | 修一个 Bug 加一条规则，系统越来越复杂 | 缺少统一能力层 |

## V3 架构愿景

将系统从"能够执行任务的数据处理工具"升级为"能够理解数据、分析数据、自动修复数据、解释执行过程的智能数据处理平台"。

### V3 分层架构

```
V2:
  用户 → NLU → ExecutionPlan → Executor → Verifier → Result

V3:
  用户 → NLU → ExecutionPlan
                     ↓
              ┌─ Execution Intelligence Center ──┐
              │  Profile → Validate → Repair     │
              │  ↓  Execute (V2) → Verify (V2)   │
              │  ↓  Explain                      │
              └──────────────────────────────────┘
                     ↓
              UI（含执行解释）
```

### 六层模型

| 层 | 名称 | 职责 | 对应模块 |
|----|------|------|---------|
| 0 | **NLU** | 自然语言 → 结构化意图 | `lib/nlu/`（V2，不变） |
| 1 | **AI** | 推理、建议、修复 | `lib/v3/ai/`（新增） |
| 2 | **Profile** | 数据画像、统计、质量 | `lib/v3/profile/`（新增，包装 audit-engine） |
| 3 | **Execution** | 计划执行 | `lib/v2/executors/`（V2，不变） |
| 4 | **Verification** | 结果验证 + 解释 | `lib/v2/verifier/` + `lib/v3/explain/` |
| 5 | **Presentation** | UI 状态 + 解释展示 | `app/page.tsx` + `components/` |

## 迁移原则

1. **V2 不变性** — `lib/v2/` 永不修改。V3 模块是可选增强。
2. **零破坏性** — 每个 Phase 结束时所有 333 个测试必须通过。
3. **功能开关** — EIC 能力通过 `eicEnabled` 标志控制，默认关闭直到 Phase 8。
4. **增量交付** — 每个 Phase 独立交付，不依赖后续 Phase。

## 开发原则（与立项说明一致）

1. 禁止"修一个 Bug 加一个规则"的开发方式
2. 所有能力必须可复用（一次开发，全局复用）
3. 所有异常必须可解释（Reason + Suggestion + AutoFix + Impact）
4. 任何数据执行前必须理解数据（先 Profile，再执行）
5. AI 永远负责理解，规则永远负责约束
