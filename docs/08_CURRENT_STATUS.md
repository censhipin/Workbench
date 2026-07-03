# Current Status

> 最后更新：2026-07-02

## 已完成的轮次

### Phase 0 — 项目初始化
- Next.js 16 项目初始化 + TypeScript 配置
- Tailwind CSS v4 配置
- Electron 35 集成（开发模式 + 打包）
- 基础布局框架

### Phase 1 — DataEngine V2 基础层

**文件：** `lib/v2/types.ts`、`lib/v2/predicate.ts`

- Operator 枚举（14 种：EQ/NE/GT/GTE/LT/LTE/CONTAINS/STARTS_WITH/ENDS_WITH/BETWEEN/IN/NOT_IN/IS_NULL/NOT_NULL）
- `evaluateCondition()` 统一求值函数
- `evaluateAll()` AND 组合求值
- 测试：44 个

### Phase 2 — TaskCompiler + ExecutionPlan

**文件：** `lib/v2/execution-plan.ts`、`lib/v2/task-compiler.ts`

- 11 种执行计划类型（含 Update/Formula/Pipeline/Projection）
- `compile()` 将 TaskPlan 编译为 ExecutionPlan
- Support select/remove/rename 投影操作
- 测试：26 个

### Phase 3 — V2 Execution Engine

**文件：** `lib/v2/execution-engine.ts`

- `runExecutionPlan()` 通过 Registry 分发到具体 Executor
- OutputProcessor 统一输出约束处理
- Verifier 执行结果验证
- 测试：14 个

### Phase 4 — 真实链路接入

- TaskIntent 新增 `v2plan?` 字段
- `parseIntentWithAI()` 返回前执行 compile()，结果附加到 intent.v2plan
- `runExecutionEngine()` 检测 intent.v2plan 优先走 V2

### Phase 5 — OperationExecutor 重构

**文件：** `lib/v2/executors/`（11 个文件）

- ExecutorRegistry 插件化注册
- 11 个 Executor 全部重构为独立文件
- 每个 Executor 实现 `OperationExecutor` 接口

### Phase 6 — V2 OutputProcessor

**文件：** `lib/v2/output-processor/`

- includeColumns/excludeColumns/renameColumns/reorderColumns/limit
- 测试：17 个

### Phase 7 — V2 Verifier

**文件：** `lib/v2/verifier/`（11 个 Verifier）

- 按 ExecutionPlan.type 分发验证
- 每个操作类型有专用 Verifier

### Phase 8 — 前端 UI 重构

- 5 栏布局（TopBar/LeftPanel/MainPanel/RightPanel/BottomBar）
- 用 BottomBar 替代旧 AIInput
- 用 LeftPanel（内嵌 Workspace+WorkflowTree）替代旧 Workspace
- 新增 VersionTimeline、CompareView
- 新版 ResultPreview、DataPreview
- 硬编码 `showDiff=false` 导致对比按钮功能关闭

## 已完成功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 文件上传（xlsx/xls/csv） | ✅ | sheetjs 解析 |
| 文件选择/切换/删除 | ✅ | 左侧面板 |
| 任务文件勾选 | ✅ | 多文件关联处理 |
| AI 理解（DeepSeek） | ✅ | 有 API Key 时 |
| 规则降级理解 | ✅ | 无 API Key 时 |
| 歧义检测 + 确认对话框 | ✅ | Schema Resolver 多候选 |
| 11 种数据操作 | ✅ | 见 Executor 列表 |
| 版本管理（创建/切换/回退/删除） | ✅ | 20 版本上限 |
| 撤销 | ✅ | 移除最后一个版本 |
| 执行计划展示 | ✅ | 5 步卡片 |
| 操作历史 | ✅ | IndexedDB 持久化 |
| 数据审计 | ✅ | Quality Check |
| 数据导出 | ✅ | Excel |
| 对比视图 | ⚠️ | 硬编码 showDiff=false |

## 现存问题

### Bug 级别
1. **`高于`不被识别为`大于`** — extractParams 正则缺少 `/高于/` 模式 → 筛选条件变 `eq` 匹配 0 行
2. **`产品`在 operationWords 中** — 导致"筛选产品为产品A"中"产品"被过滤为操作词
3. **"只看"被映射为 filter 而非 select** — intent-lexicon 将"只看/只保留"列为 filter 同义词

### 架构级别
4. **规则系统膨胀** — AI 不可用时完全依赖 82 个同义词 + 20 组概念 + 13 个正则
5. **规则无置信度** — 规则解析结果与 AI 结果使用同样的 TaskIntent 格式，UI 无法区分
6. **WorkflowTree 死代码** — 在 LeftPanel 中渲染但无数据显示

### UI 级别
7. **showDiff 硬编码 false** — page.tsx:665
8. **BottomBar 缺少 prompt 示例** — 旧 AIInput 有的 promptExamples 提示在 BottomBar 未实现
9. **三个死代码文件** — AIInput.tsx, Workspace.tsx, (taskpanel/)OperationHistory.tsx

## 测试状态

| 文件 | 用例数 | 状态 |
|------|--------|------|
| data-engine.test.ts | 74 | ✅ |
| execution-engine.test.ts | 含在上方 | ✅ |
| audit-engine.test.ts | 含在上方 | ✅ |
| ambiguity-detector.test.ts | 含在上方 | ✅ |
| e2e-test.test.ts | (e2e) | ✅ |
| v2-predicate.test.ts | 44 | ✅ |
| v2-task-compiler.test.ts | 26 | ✅ |
| v2-execution-engine.test.ts | 14 | ✅ |
| v2-executors.test.ts | (插件化) | ✅ |
| v2-output-processor.test.ts | 17 | ✅ |
| v2-projection.test.ts | (integration) | ✅ |
| v2-data-transformation.test.ts | (integration) | ✅ |
| v2-full-pipeline.test.ts | (integration) | ✅ |
| v2-verifier.test.ts | (integration) | ✅ |
| v2-fallback-integration.test.ts | (integration) | ✅ |
| v2-verification-integration.test.ts | (integration) | ✅ |
| nlu-semantic-parser.test.ts | (nlu) | ✅ |
| **总计** | **333** | **全部通过** |

## 下一步计划

1. 修复规则解析器的同义词缺失问题（高于→大于、产品不在 operationWords 等）
2. 决定「只看」操作归 filter 还是 select
3. 恢复 showDiff 功能（移除硬编码 false）
4. 决定 WorkflowTree 去留
5. 考虑用本地 AI 模型替代规则降级方案
