# V3 Architecture Documents

> 本文档是 V3 架构的索引入口。

## 阅读顺序

| 顺序 | 文件 | 内容 | 预计时间 |
|------|------|------|---------|
| ① | [00_OVERVIEW.md](00_OVERVIEW.md) | V3 概述：为什么、架构图、迁移路线 | 5 min |
| ② | [01_EXECUTION_CHAIN_MAP.md](01_EXECUTION_CHAIN_MAP.md) | 完整执行链映射 | 10 min |
| ③ | [02_CAPABILITY_MATRIX.md](02_CAPABILITY_MATRIX.md) | 能力→层映射 | 10 min |
| ④ | [03_EIC_DESIGN.md](03_EIC_DESIGN.md) | Execution Intelligence Center 详细设计 | 15 min |
| ⑤ | [04_ERROR_HANDLING_ARCHITECTURE.md](04_ERROR_HANDLING_ARCHITECTURE.md) | 结构化错误系统设计 | 10 min |
| ⑥ | [05_MODULE_RESPONSIBILITY_MATRIX.md](05_MODULE_RESPONSIBILITY_MATRIX.md) | 模块职责矩阵 | 10 min |
| ⑦ | [06_EXECUTOR_GAP_ANALYSIS.md](06_EXECUTOR_GAP_ANALYSIS.md) | 11 个 Executor 逐个分析 | 10 min |
| ⑧ | [07_INTEGRATION_PATHS.md](07_INTEGRATION_PATHS.md) | 10 阶段迁移路线图 | 5 min |
| ⑨ | [08_V3_ARCHITECTURE_REVIEW.md](08_V3_ARCHITECTURE_REVIEW.md) | **最终交付报告** | 10 min |

**总阅读时间：约 75 分钟**

## 核心概念

| 术语 | 说明 |
|------|------|
| **EIC** | Execution Intelligence Center，V3 新增的智能执行层 |
| **Profile** | 数据画像：执行前分析数据特征 |
| **Validate** | 智能校验：基于数据特征的语义校验 |
| **Repair** | 自动修复：列模糊匹配、类型转换等 |
| **Explain** | 执行解释：替代原始错误字符串 |
| **ErrorRecord** | 结构化错误记录（含错误码、原因、建议、可修复性） |
| **DataProfile** | 数据结构化画像（行数、列统计、质量评分） |

## 文件清单

| 文件 | 类型 | V2 影响 |
|------|------|---------|
| `docs/v3/INDEX.md` | 索引 | 无 |
| `docs/v3/00_OVERVIEW.md` ~ `08_V3_ARCHITECTURE_REVIEW.md` | 架构设计文档 | 无 |
| `lib/v3/` 相关文件 | 代码实现 | **Phase 2+ 才创建，Phase 1 不涉及** |
