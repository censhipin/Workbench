# V3 Module Guide

## 模块总览

V3 包含以下核心模块：

| 模块 | 路径 | 文件数 | 测试数 | 用途 |
|------|------|--------|--------|------|
| Controllers | `lib/v3/controllers/` | 5 | - | page.tsx 状态管理 |
| Profile | `lib/v3/profile/` | 2 | 2 文件 | 数据画像 |
| Repair | `lib/v3/repair/` | 7 | 2 文件 | 自动修复 |
| Explain | `lib/v3/explain/` | 10 | - | 智能解释 |
| Verification | `lib/v3/verification/` | 15 | 120 测试 | 结果验证 |
| Config | `lib/v3/config/` | 1 | - | 统一配置 |
| Utils | `lib/v3/utils/` | 2 | - | 日志/性能 |
| Error Codes | `lib/v3/` | 1 | - | 错误码系统 |
| UI Components | `components/workbench/` | 10 | 80 测试 | 工作台面板 |

## 模块详解

### 1. Controllers 模块
**文件**: `lib/v3/controllers/`
**职责**: 从 page.tsx 抽取的状态逻辑
- `useExecutionController` — AI 提交、执行流程、动画
- `useVersionController` — 版本增删改查
- `useHistoryController` — 历史记录管理
- `useExportController` — 导出功能
- `useDialogController` — 弹窗状态

### 2. Profile 模块
**文件**: `lib/v3/profile/`
**职责**: 执行前对数据列进行画像分析
- 列类型推断
- 唯一值/空值统计
- 用于 Repair 决策和 Plan 校验

### 3. Repair 模块
**文件**: `lib/v3/repair/`
**职责**: 自动修复执行计划中的错误
- 6 种修复类型：列名模糊匹配、值规范化、类型转换、Join映射、公式解析、空值处理
- 每项修复带有置信度（0-1）
- 自动修复 + 建议修复双模式

### 4. Explain 模块
**文件**: `lib/v3/explain/`
**职责**: 生成结构化执行解释
- 从 8 个维度构建解释：摘要、详情、警告、建议、修复、画像、执行、验证
- 输出 `ExecutionExplanation` 给 UI 展示

### 5. Verification 模块
**文件**: `lib/v3/verification/`
**职责**: 多维度结果验证
- 9 个专用 Verifier，覆盖全部操作类型
- Statistics Engine：表统计、分组统计、匹配统计
- Diff Engine：前后差异对比
- Report Builder：构建验证报告

### 6. UI 组件模块
**文件**: `components/workbench/`
**职责**: 工作台面板组件
- ExecutionCenter — 7步执行进度
- RepairPanel — 修复详情
- VerificationPanel — 验证结果
- ExplanationPanel — 智能解释
- DataProfilePanel — 数据画像
- QualityPanel — 数据质量
- PerformanceMonitor — 性能监控
- ErrorDialogV3 — 结构化错误弹窗
- WorkbenchPanel — 统一容器
- ExecutionTimeline — 时间轴

## 工作流程（开发指南）

### 添加新操作类型
1. 在 `lib/v2/executors/` 中创建新的 Executor
2. 注册到 `lib/v2/execution-engine.ts`
3. 在 `lib/v3/verification/` 中添加对应的 Verifier
4. 注册到 `verification-engine.ts`
5. 更新 PlanValidator（`lib/v2/plan-validator.ts`）
6. 在 Explain 中添加对应的摘要生成
7. 添加测试

### 添加新 UI 面板
1. 在 `components/workbench/` 中创建组件
2. 使用 `WorkbenchPanel` 作为容器
3. 添加到 `page.tsx` 的 RightPanel 中
4. 在 `workbench-components.test.tsx` 中添加测试

## 测试文件索引

| 测试文件 | 测试数 | 覆盖 |
|----------|--------|------|
| `lib/__tests__/30-tasks-audit.test.ts` | 30 | 全链路任务场景 |
| `lib/__tests__/v2-executors.test.ts` | 14 | V2 执行器 |
| `lib/__tests__/regression-trace.test.ts` | 1 | 回归追踪 |
| `lib/v3/__tests__/profile.test.ts` | - | Profile |
| `lib/v3/__tests__/profile-validate.test.ts` | - | Profile-Validate |
| `lib/v3/__tests__/repair.test.ts` | ~50 | Repair |
| `lib/v3/__tests__/repair-integration.test.ts` | ~45 | Repair Integration |
| `lib/v3/__tests__/verification/verification.test.ts` | 120 | Verification |
| `components/__tests__/workbench-components.test.tsx` | 80 | UI 组件 |
