# V3 最终架构 — 完整架构文档

## 一、系统概述

V3 是工作簿数据处理的第三代架构，核心设计理念为 **EIC 闭环**：

```
NLU → Profile → Repair → Validate → Execution → Verification → Explain
  ↑                                                        ↓
  └─────────────────── Feedback Loop ─────────────────────┘
```

### 核心特性
- 全链路执行（NLU → Explain）
- 智能修复（Auto-repair + Suggest）
- 多重验证（9 个专用 Verifier）
- 结构化解释（ExecutionExplanation）
- 性能监控（PerStage + Total）

## 二、模块架构图

```
┌─────────────────────────────────────────────────────┐
│                    page.tsx                          │
│  State → Controllers → Render                       │
├─────────────────────────────────────────────────────┤
│                     Controllers                      │
│  ┌───────────┬──────────┬──────────┬───────────┐   │
│  │ Execution │ Version  │ History  │ Export    │   │
│  │ Controller│Controller│Controller│Controller │   │
│  └─────┬─────┴────┬─────┴────┬─────┴─────┬─────┘   │
│        │          │          │           │         │
├────────┴──────────┴──────────┴───────────┴─────────┤
│                    lib/v3/                          │
│  ┌───────┬───────┬───────┬───────┬───────┬───────┐│
│  │Profile│ Repair│Explain│Verif. │Config │ Error ││
│  │  /    │   /   │   /   │   /   │   /   │ Code  ││
│  │ prof. │col-rep│summary│ filter│index  │codes  ││
│  │       │val-rep│warning│aggreg │       │       ││
│  │       │type-re│suggest│match  │Util   │       ││
│  │       │join-re│repair │formula│────── │       ││
│  │       │formula│exec   │proj.  │logger │       ││
│  │       │null-re│verif  │update │perf   │       ││
│  │       │       │error  │dedup  │       │       ││
│  │       │engine │       │clean  │       │       ││
│  │       │       │       │pipel. │       │       ││
│  └───┬───┴───┬───┴───┬───┴───┬───┴───┬───┴───┬───┘│
│      │       │       │       │       │       │     │
├──────┴───────┴───────┴───────┴───────┴───────┴───┤
│                 lib/v2/ (稳定层)                    │
│  Executor Registry → OperationExecutor → V2 Verify│
│  ┌── Filter/Sort/Aggregate/Match/Merge/Clean     ┐│
│  │  Dedup/Projection/Update/Formula/Pipeline     ││
│  └───────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│              components/workbench/                   │
│  ExecutionCenter / RepairPanel / VerificationPanel   │
│  ExplanationPanel / DataProfilePanel / QualityPanel  │
│  PerformanceMonitor / ErrorDialogV3 / WorkbenchPanel │
└─────────────────────────────────────────────────────┘
```

## 三、数据流

```
User Input → NLU → TaskIntent → TaskCompiler → ExecutionPlan
                                                      ↓
                              ┌─── PlanValidator <────┘
                              │        ↓
                              │    Profile (DataProfile)
                              │        ↓
                              │    Repair (Auto-fix)
                              │        ↓
                              │    Validate (Plan Check)
                              │        ↓
                              │  OperationExecutor
                              │        ↓
                              │    Verifier (9 checks)
                              │        ↓
                              │    Explain Builder
                              │        ↓
                              │  ExecutionExplanation
                              │        ↓
                              │  UI (Workbench Panels)
```

## 四、文件布局

```
lib/v3/
├── config/
│   └── index.ts              # 统一配置中心
├── controllers/
│   ├── useExecutionController.ts
│   ├── useVersionController.ts
│   ├── useHistoryController.ts
│   ├── useExportController.ts
│   └── useDialogController.ts
├── profile/
│   ├── types.ts               # 列画像/数据画像类型
│   └── profiler.ts            # 画像生成器
├── repair/
│   ├── repair-types.ts        # RepairRecord/RepairReport
│   ├── repair-engine.ts       # 修复编排器
│   ├── column-repair.ts       # 列名修复
│   ├── value-repair.ts        # 值规范化
│   ├── type-repair.ts         # 类型推断/修复
│   ├── join-repair.ts         # Join 键映射修复
│   ├── formula-repair.ts      # 公式解析修复
│   └── null-repair.ts         # 空值修复
├── explain/
│   ├── types.ts               # ExecutionExplanation
│   ├── builder.ts             # 构建器
│   ├── summary.ts             # 摘要生成
│   ├── warning.ts             # 警告提取
│   ├── suggestion.ts          # 建议生成
│   ├── repair-summary.ts      # 修复摘要
│   ├── profile-summary.ts     # 画像摘要
│   ├── execution-summary.ts   # 执行摘要
│   ├── verification-summary.ts# 验证摘要
│   └── error-summary.ts       # 错误摘要
├── verification/
│   ├── types.ts               # VerificationResult
│   ├── verification-engine.ts # 验证引擎
│   ├── statistics.ts          # 统计引擎
│   ├── diff.ts                # 差异计算
│   ├── report-builder.ts      # 报告生成
│   ├── filter-verifier.ts     # Filter 验证
│   ├── aggregate-verifier.ts  # Aggregate 验证
│   ├── match-verifier.ts      # Match 验证
│   ├── formula-verifier.ts    # Formula 验证
│   ├── projection-verifier.ts # Projection 验证
│   ├── update-verifier.ts     # Update 验证
│   ├── dedup-verifier.ts      # Dedup 验证
│   ├── clean-verifier.ts      # Clean 验证
│   └── pipeline-verifier.ts   # Pipeline 验证
├── utils/
│   ├── logger.ts              # 统一日志
│   └── perf.ts                # 性能追踪
└── error-codes.ts             # 统一错误码
```

## 五、依赖关系

```
page.tsx
  ├── controllers/*          (useXxxController)
  │     ├── lib/v3/error-codes
  │     └── lib/v2/execution-engine
  ├── components/layout/*    (TopBar/LeftPanel/MainPanel/RightPanel/BottomBar)
  ├── components/workspace/* (DataPreview/ResultPreview/CompareView)
  ├── components/workbench/* (ExecutionCenter/RepairPanel/...)
  └── components/common/*    (Dialog/Modal/EmptyState)

lib/v3/verification/verification-engine.ts
  ├── verifiers/*-verifier.ts
  ├── statistics.ts
  └── diff.ts

lib/v3/repair/repair-engine.ts
  ├── column-repair.ts
  ├── value-repair.ts
  ├── type-repair.ts
  ├── join-repair.ts
  ├── formula-repair.ts
  └── null-repair.ts

lib/v3/explain/builder.ts
  ├── summary.ts
  ├── warning.ts
  ├── suggestion.ts
  ├── repair-summary.ts
  ├── profile-summary.ts
  ├── execution-summary.ts
  ├── verification-summary.ts
  └── error-summary.ts
```

## 六、技术栈

- **框架**: Next.js (App Router)
- **语言**: TypeScript
- **测试**: Vitest + Testing Library
- **状态管理**: React Hooks (useState/useCallback)
- **UI**: Tailwind CSS
- **文件处理**: XLSX (SheetJS)
- **AI**: DeepSeek API (NLU Parsing)
