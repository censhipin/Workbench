# 模块职责矩阵

## V2 模块（保有，不修改）

| 模块 | 路径 | 负责 | 不负责 | V3 关系 |
|------|------|------|--------|---------|
| NLU 入口 | lib/nlu/index.ts | 组织 AI + 规则解析流程，生成 TaskIntent | 数据理解、执行 | 前置输入 |
| DeepSeek 集成 | lib/nlu/deepseek.ts | 调用 AI API，解析 JSON 响应 | 语义正确性验证 | 前置输入 |
| 规则解析器 | lib/nlu/semantic-parser.ts | 规则降级解析 | 复杂语义理解 | 前置输入 |
| 任务编译器 | lib/v2/task-compiler.ts | TaskPlan → ExecutionPlan 编译 | 数据感知、模糊匹配 | EIC Repair 输入目标 |
| 计划校验器 | lib/v2/plan-validator.ts | 列存在性、操作合法性、类型规范性 | 语义校验、数据上下文校验 | EIC Validate 补强 |
| 字段解析器 | lib/v2/field-resolver.ts | 列名映射（精确/概念） | 值反查、推理 | EIC Repair 补强 |
| Executor 注册中心 | lib/v2/executors/registry.ts | Executor 注册与查找 | 执行逻辑 | 集成目标 |
| **11 个 Executor** | lib/v2/executors/*.ts | **纯数据运算** | 数据理解、异常智能处理 | **EIC 的前置 Profile + 后置 Explain** |
| 输出处理器 | lib/v2/output-processor/ | 列筛选/重命名/重排序/limit | 列不存在时智能建议 | EIC Repair 补强 |
| Verifier 注册中心 | lib/v2/verifier/registry.ts | Verifier 注册与查找 | 验证逻辑 | 集成目标 |
| **9 个 Verifier** | lib/v2/verifier/*.ts | **纯验证逻辑** | 验证失败解释 | **EIC Explain 的输入** |
| 谓词求值 | lib/v2/predicate.ts | 条件表达式求值（14 operator） | 语义理解 | 底层能力 |
| 数据引擎 | lib/data-engine.ts | 底层数据运算（sort/filter/dedup等） | 任何业务逻辑 | 底层能力 |
| 审计引擎 | lib/audit-engine.ts | 数据质量审计 | 执行集成 | **EIC Profile 包装目标** |
| 歧义检测器 | lib/ambiguity-detector.ts | 列歧义检测 | 自动决断 | 前置输入 |
| 执行入口 | lib/execution-engine.ts | 执行编排、5步UI计划 | 智能处理 | **V3 集成点（Phase 8+）** |
| 管道跟踪 | lib/pipeline-trace.ts | 执行链路跟踪 | 任何业务 | 跨层公用 |

## V3 新增模块

| 模块 | 路径 | 负责 | 不负责 | 依赖 |
|------|------|------|--------|------|
| EIC 编排器 | lib/v3/eic.ts | 编排 profile→validate→repair→explain | 具体每步的实现 | V2 types, V3 sub-modules |
| EIC 类型定义 | lib/v3/types.ts | DataProfile, ErrorRecord, EICContext 等 | 任何逻辑 | V2 types |
| 数据画像器 | lib/v3/profile/data-profiler.ts | 执行前数据结构分析 | 数据修改 | audit-engine, V3 types |
| 列分析器 | lib/v3/profile/column-analyzer.ts | 每列统计信息（类型分布、空值率、唯一值率） | 跨列分析 | data-profiler |
| 语义校验器 | lib/v3/validate/semantic-validator.ts | 带数据上下文的计划校验 | 数据修改 | profile, V3 types |
| 统计校验器 | lib/v3/validate/statistical-validator.ts | 基于统计的可行性校验 | 自动修复 | profile, V3 types |
| 列修复器 | lib/v3/repair/column-repair.ts | 缺失列的模糊匹配+值反查 | 执行修改 | profile, V3 types |
| 类型修复器 | lib/v3/repair/type-repair.ts | 类型不匹配的自动转换 | 数据修改 | V3 types |
| 计划修复器 | lib/v3/repair/plan-repair.ts | 通用计划修复编排 | 列/类型具体修复 | column-repair, type-repair |
| 执行解释器 | lib/v3/explain/execution-explainer.ts | 生成执行过程的结构化解释 | UI 渲染 | V3 types, Verifier |
| 原因构建器 | lib/v3/explain/reason-builder.ts | 构建"为什么失败"的结构化原因 | 建议生成 | V3 types |
| 建议生成器 | lib/v3/explain/suggestion-builder.ts | 根据错误生成修复建议 | 自动执行 | V3 types |

## 分层依赖规则

```
lib/v3/ (可引入 V2 types，不可引入 V2 executors)
  │
  ├── lib/v2/ (V2 完全不知晓 V3 存在)
  │
  └── lib/nlu/ (V3 不可依赖 NLU)

lib/v2/ 不能 import lib/v3/ 任何内容
lib/nlu/ 不能依赖 lib/v3/
lib/v3/ 不能依赖 app/ 或 components/
```
