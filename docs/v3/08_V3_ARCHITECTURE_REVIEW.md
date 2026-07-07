# V3 Architecture Review Report

> 生成日期：2026-07-06
> 分析文件：126 个 TypeScript 文件，~22,230 行代码
> V2 测试套件：333 个测试用例，全部通过

## 一、执行摘要

经过全面分析，V2 系统已具备完整的数据处理流程（NLU → TaskPlan → ExecutionPlan → Executor → Verifier），但存在一个系统性缺陷：

**系统目前只有"执行能力"，没有"智能执行能力（Execution Intelligence）"。**

这个缺陷的根源不是某个 Executor 写错了或某个 Parser 少了一条规则，而是整个执行系统缺少一层统一的数据智能能力。V3 的核心解决方案是引入 **Execution Intelligence Center（EIC）**，作为介于 ExecutionPlan 和 Executor 之间的智能执行层。

## 二、当前架构（V2）

```
用户输入 → NLU (AI + Rule) → TaskPlan → FieldResolver → TaskCompiler → ExecutionPlan
  → validatePlan → snapshot → ExecutorRegistry → Executor.execute()
  → OutputProcessor → Verifier → [buildErrorMessage → string]
  → PlanStepBuilder → UI
```

### V2 的优势

- 完整的执行链，覆盖 11 种数据操作
- 良好的插件化架构（ExecutorRegistry/VerifierRegistry）
- 数据隔离机制（createSnapshot/cloneResult）
- 管道追踪（pipeline-trace.ts）
- 333 个测试提供稳定的回归保障

### V2 的七项关键缺口

| # | 缺口 | 严重程度 | 影响面 |
|---|------|---------|--------|
| 1 | **无数据理解** | 高 | 所有 Executor |
| 2 | **无智能错误处理** | 高 | 整个执行链 |
| 3 | **无统一智能层** | 高 | 系统架构 |
| 4 | **无自动修复** | 中 | 用户体验 |
| 5 | **无执行解释** | 中 | 用户理解 |
| 6 | **Audit 孤岛** | 中 | 执行流程 |
| 7 | **Bug 修复模式脆弱** | 高 | 可维护性 |

## 三、V3 架构设计

### 3.1 新分层架构（六层模型）

```
┌────────────────────────────────────────────────────┐
│  Layer 5: Presentation (UI + 执行解释)             │
│  app/page.tsx + components/ + PlanStepBuilder      │
├────────────────────────────────────────────────────┤
│  Layer 4: Verification (结果验证 + 解释)           │
│  lib/v2/verifier/ + lib/v3/explain/                │
├────────────────────────────────────────────────────┤
│  Layer 3: Execution (计划执行)                     │
│  lib/v2/executors/ + lib/v2/output-processor/      │
│  lib/v2/plan-validator/ + lib/v2/execution-snapshot/│
├────────────────────────────────────────────────────┤
│  Layer 2: Profile (数据画像)                       │
│  lib/v3/profile/ (新增, 包装 audit-engine)          │
├────────────────────────────────────────────────────┤
│  Layer 1: AI (智能推理、建议、修复、解释)          │
│  lib/v3/ai/ + lib/v3/validate/ + lib/v3/repair/   │
├────────────────────────────────────────────────────┤
│  Layer 0: NLU (自然语言理解)                       │
│  lib/nlu/ (V2 保有, 不变)                         │
└────────────────────────────────────────────────────┘
```

### 3.2 Execution Intelligence Center（EIC）

EIC 是 V3 的核心新增模块，位于 Layer 1-2，包含四个子模块：

```
ExecutionPlan
  │
  ├─→ EIC.Profile ─→ 数据画像：行统计、列分布、质量评分、模式检测
  │                    （包装 audit-engine，新增列级别分析）
  ├─→ EIC.Validate ─→ 智能校验：类型兼容、值存在性、影响预估
  │                    （plan-validator 的超集，叠加数据上下文）
  ├─→ EIC.Repair ───→ 自动修复：列模糊匹配、类型转换、空值策略
  │                    （所有修复标注置信度）
  ├─→ [V2 Executor] ─ V2 执行不变
  ├─→ [V2 Verifier] ─ V2 验证不变
  └─→ EIC.Explain ──→ 执行解释：结构化 ErrorRecord[] + 原因 + 建议
```

### 3.3 结构化错误系统

替代当前 `buildErrorMessage()` 的原始字符串，引入 `ErrorRecord` 结构：

```typescript
interface ErrorRecord {
  code: string;              // 机器可读错误码（如 COL-001）
  severity: 'info'|'warning'|'error'|'critical';
  message: string;           // 人类可读消息
  category: ErrorCategory;   // 分类（COLUMN_NOT_FOUND 等）
  reason: string;            // 为什么发生
  suggestion: string;        // 用户可以做什么
  autoFixAvailable: boolean; // EIC 能否自动修复？
  autoFixConfidence: number; // 置信度 0-1
  source: string;            // 哪个模块产生
}
```

已定义完整的错误码注册表，覆盖 8 个类别 20+ 种错误码（详见 [04_ERROR_HANDLING_ARCHITECTURE.md](04_ERROR_HANDLING_ARCHITECTURE.md)）。

## 四、与 V2 的区别

| 维度 | V2 | V3 |
|------|----|----|
| **执行前** | `validatePlan`（仅列/类型校验） | `Profile → Validate`（数据画像+语义校验） |
| **执行中** | Executor 盲目执行 | Executor 执行前有数据上下文 |
| **执行后** | `buildErrorMessage` 返回原始字符串 | `EIC.Explain` 返回结构化 ErrorRecord[] |
| **错误** | 可读差，无结构，无建议 | `{code, reason, suggestion, autoFix}` |
| **修复** | 失败即终止 | 可自动修复（低置信度时仍返回用户确认） |
| **Audit** | 独立功能，不参与执行链 | Profile 模块包装，参与执行决策 |
| **Bug 修复** | 逐案加特殊规则 | 统一能力层集中修复 |

## 五、对现有代码的影响

### 不受影响（占代码量 ~95%）

```
lib/v2/ (全部 20+ 文件)  — 完全不修改
lib/nlu/ (全部 7+ 文件)  — 完全不修改
lib/data-engine.ts       — 完全不修改（但 EIC Profile 会引入）
lib/audit-engine.ts      — 完全不修改（但 EIC Profile 会包装）
lib/ambiguity-detector.ts — 完全不修改
lib/pipeline-trace.ts    — 完全不修改
lib/types.ts             — 完全不修改
app/                     — 完全不修改
components/              — 完全不修改
tests/                   — 333 个测试全部不变
```

### 可能受影响（占代码量 ~5%，Phase 8+）

```
lib/execution-engine.ts  — 添加可选 EIC wrapper（不改变内部逻辑）
```

## 六、阶段实施建议

| Phase | 工作量估计 | 新增文件数 | 风险 |
|-------|-----------|-----------|------|
| **1** 架构规划 ✅（已完成） | 1 天 | 10 文档 | 无 |
| **2** EIC Profile | 2-3 天 | 4-5 文件 | 低 |
| **3** 结构化错误 + Validate | 2-3 天 | 5-6 文件 | 低 |
| **4** EIC Repair | 3-4 天 | 4-5 文件 | 中 |
| **5** EIC Explain | 2-3 天 | 4-5 文件 | 中 |
| **6** EIC 编排器 | 1-2 天 | 2 文件 | 低 |
| **7** V2 集成 | 1-2 天 | 修改 1 文件 | 中 |
| **8** 默认启用 + 性能 | 1-2 天 | 配置 | 低 |
| **9** UI 增强 | 2-3 天 | 3-4 组件 | 中 |
| **10** 全功能完成 | 1-2 天 | 端到端测试 | 低 |

**总计工作量**：约 16-24 天（含测试）

## 七、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| EIC 增加执行延迟 | 中 | 用户体验 | Profile 缓存；EIC 可配置禁用 |
| V2 代码被意外修改 | 低 | 回归缺陷 | strict code review；自动化规则 |
| **功能蔓延** | **高** | Phase 延迟 | 能力矩阵严格限定范围边界 |
| EIC 修复引入新 Bug | 中 | 数据错误 | 低置信度的修复必须用户确认 |
| Phase 间耦合 | 中 | 交付阻塞 | 每个 Phase 独立可交付，不依赖后续 |

## 八、模块建议总结

| 模块 | 建议 | 优先级 |
|------|------|--------|
| lib/v2/ 全部 | 保持不修改 | P0 |
| lib/nlu/ 全部 | 保持不修改 | P0 |
| lib/audit-engine.ts | 保持不修改，EIC Profile 包装 | P0 |
| lib/data-engine.ts | 保持不修改 | P0 |
| lib/v3/ 目录 | 立即创建 | P1 |
| lib/v3/types.ts | 定义 EIC 核心类型 | P1 |
| lib/v3/profile/ | 数据画像实现 | P1 |
| lib/v3/validate/ | 智能校验实现 | P2 |
| lib/v3/repair/ | 自动修复实现 | P3 |
| lib/v3/explain/ | 执行解释实现 | P4 |
| lib/v3/eic.ts | EIC 编排器 | P5 |
| lib/execution-engine.ts | 可选 EIC wrapper（Phase 8+） | P6 |

## 附录：已创建的架构文档

| 文件 | 内容 |
|------|------|
| [INDEX.md](INDEX.md) | V3 文档索引 |
| [00_OVERVIEW.md](00_OVERVIEW.md) | V3 架构概述 |
| [01_EXECUTION_CHAIN_MAP.md](01_EXECUTION_CHAIN_MAP.md) | 完整执行链映射 |
| [02_CAPABILITY_MATRIX.md](02_CAPABILITY_MATRIX.md) | 能力→层映射 |
| [03_EIC_DESIGN.md](03_EIC_DESIGN.md) | EIC 详细设计 |
| [04_ERROR_HANDLING_ARCHITECTURE.md](04_ERROR_HANDLING_ARCHITECTURE.md) | 结构化错误系统 |
| [05_MODULE_RESPONSIBILITY_MATRIX.md](05_MODULE_RESPONSIBILITY_MATRIX.md) | 模块职责矩阵 |
| [06_EXECUTOR_GAP_ANALYSIS.md](06_EXECUTOR_GAP_ANALYSIS.md) | 11 个 Executor 逐个分析 |
| [07_INTEGRATION_PATHS.md](07_INTEGRATION_PATHS.md) | 10 阶段迁移路线图 |
| **08_V3_ARCHITECTURE_REVIEW.md** | **本文档** |
