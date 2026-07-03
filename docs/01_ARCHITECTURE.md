# Architecture

## 整体架构图

```
┌──────────────────────────────────────────────────────────────┐
│  UI Layer (components/)                                       │
│  TopBar | LeftPanel | MainPanel | RightPanel | BottomBar      │
│    ↕ props / state / callbacks                                │
│  page.tsx (状态管理中心)                                        │
│    ↕ 调用                                                     │
├──────────────────────────────────────────────────────────────┤
│  NLU Layer (lib/nlu/)                                         │
│  parseIntentWithAI() ← 优先 AI | 降级 RuleParser             │
│    ↕ TaskPlan/TaskIntent                                      │
│  TaskCompiler (lib/v2/task-compiler.ts)                       │
│    ↕ ExecutionPlan                                            │
├──────────────────────────────────────────────────────────────┤
│  Execution Layer (lib/v2/executors/ + lib/data-engine.ts)     │
│  runExecutionEngine() → V2 Executor Registry → Executor      │
│    ↕ columns + rows                                           │
│  OutputProcessor → Verifier → PlanStepBuilder                  │
│    ↕ result data                                              │
├──────────────────────────────────────────────────────────────┤
│  Storage Layer                                                │
│  IndexedDB (lib/db.ts) — 文件/元数据/历史持久化               │
│  Version (page.tsx state) — 内存中的数据版本管理               │
└──────────────────────────────────────────────────────────────┘
```

## 核心数据流

```
用户输入 → NLU 理解 → TaskPlan → compile → ExecutionPlan
  → runExecutionEngine → [V2 Executor | 旧Engine] → ResultData
  → Verification → PlanStepBuilder → createVersion → UI 更新
```

## 目录结构

```
app/
  page.tsx              — 主页面（所有状态管理中心）
  api/deepseek/route.ts — DeepSeek API 代理路由
  layout.tsx            — 根布局
  globals.css           — 全局样式

components/
  layout/               — 布局组件（TopBar, LeftPanel, MainPanel, RightPanel, BottomBar）
  workspace/            — 工作区组件（DataPreview, ResultPreview, CompareView）
  taskpanel/            — 任务面板（ExecutionPlan, DataAudit, OperationHistory）
  version/              — 版本管理（VersionTimeline）
  workflow/             — 工作流（WorkflowTree — 未在 page.tsx 中直接使用）
  common/               — 通用组件（DataTable, Badge, ConfirmationDialog 等）
  filepool/             — 文件池组件（FileItem, FileList）

lib/
  types.ts              — 核心类型定义
  nlu/                  — 自然语言理解层
  v2/                   — V2 执行引擎系统
  data-engine.ts        — 旧数据引擎（被 V2 逐渐替代）
  execution-engine.ts   — 执行引擎入口（V2 调度 + 旧引擎 fallback）
  audit-engine.ts       — 数据审计引擎
  file-engine.ts        — 文件解析引擎
  data-output-processor.ts — 旧输出处理器
  db.ts                 — IndexedDB 持久化
  mock-data.ts          — 测试模拟数据
  api-key.ts            — API Key 管理
  ambiguity-detector.ts — 歧义检测

electron/
  main.ts               — Electron 主进程
  preload.ts            — 预加载脚本

scripts/
  prepare-standalone.js — 打包前准备脚本

tests (lib/__tests__/):
  17 个文件, 333 个测试用例
```

## 关键设计决策

1. **page.tsx 作为状态中心** — 所有状态提升到 page.tsx，子组件只通过 props 接收数据
2. **V2 执行引擎优先** — 优先走注册中心的 Executor，旧 ExecutionEngine.execute() 作为降级
3. **Version 不可变** — 每次 createVersion 生成新版本快照，历史版本不可变
4. **UI 组件零业务逻辑** — 组件只负责渲染和事件转发，不做数据处理

## 模块依赖关系

```
page.tsx
  ├── lib/execution-engine.ts
  │     ├── lib/v2/execution-engine.ts → lib/v2/executors/registry.ts → 各 Executor
  │     ├── lib/v2/output-processor/
  │     └── lib/v2/verifier/
  ├── lib/nlu/index.ts
  │     ├── lib/nlu/deepseek.ts ← app/api/deepseek/route.ts
  │     ├── lib/nlu/semantic-parser.ts ← intent-lexicon.ts, tokenizer.ts
  │     └── lib/nlu/schema-resolver.ts
  ├── lib/file-engine.ts
  ├── lib/db.ts
  ├── lib/audit-engine.ts
  └── lib/mock-data.ts
```
