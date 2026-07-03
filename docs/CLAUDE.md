# 表格数据工作台 — 项目入口文档

## 项目定位

自然语言驱动的本地数据处理桌面工具。用户上传 Excel，用中文指令操作数据，AI 理解意图后执行处理引擎。

## 核心设计原则

1. **AI First** — 自然语言理解优先走 AI，规则解析为降级方案
2. **本地计算** — 所有数据处理在客户端完成，不上传用户文件
3. **版本化** — 每次操作生成不可变数据快照
4. **插件化执行器** — 新增操作类型只需注册 Executor

## 整体架构（三纵层）

```
UI 层 (components/) ← props/events → page.tsx (状态中心)
NLU 层 (lib/nlu/) — 自然语言 → TaskPlan → TaskIntent → ExecutionPlan
执行层 (lib/v2/) — ExecutionPlan → Executor → 数据结果
```

## 重要约束

- 不要修改 `lib/v2/` 下的 V2 框架核心（ExecutorRegistry, runExecutionPlan）
- 不要废弃旧 `ExecutionEngine.execute()` — 当前作为 v2plan 为空时的 fallback
- page.tsx 不要添加业务逻辑，只做状态管理和事件转发
- 修改 NLU 层（lib/nlu/）时注意两条路径（AI + 规则）都需要测试

## 各模块文档索引

| 文档 | 内容 |
|------|------|
| [00_PROJECT.md](00_PROJECT.md) | 项目定位、技术栈、设计原则 |
| [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | 整体架构、目录结构、依赖关系 |
| [02_EXECUTION_ENGINE.md](02_EXECUTION_ENGINE.md) | Execution Engine 详解（V2 + 旧引擎） |
| [03_AI_PIPELINE.md](03_AI_PIPELINE.md) | AI 理解流程、DeepSeek 集成、规则降级 |
| [04_UI.md](04_UI.md) | UI 架构、组件树、状态管理 |
| [05_VERSION_SYSTEM.md](05_VERSION_SYSTEM.md) | 版本系统设计、操作功能 |
| [06_RULE_SYSTEM.md](06_RULE_SYSTEM.md) | 规则系统详解、已知局限性 |
| [07_API.md](07_API.md) | API 路由（DeepSeek 代理） |
| [08_CURRENT_STATUS.md](08_CURRENT_STATUS.md) | 当前完成状态、现存问题、测试状态 |
| [09_TODO.md](09_TODO.md) | 待办事项列表 |

## 新窗口推荐阅读顺序

```
① 00_PROJECT.md     — 1 分钟了解项目定位
② 01_ARCHITECTURE.md — 了解整体结构和目录
③ 08_CURRENT_STATUS.md — 当前状态和已知问题
④ 02_EXECUTION_ENGINE.md — 核心执行引擎
⑤ 03_AI_PIPELINE.md — AI 理解流程
⑥ 04_UI.md — UI 架构
⑦ 05_VERSION_SYSTEM.md — 版本管理
⑧ 06_RULE_SYSTEM.md — 规则系统（了解已知问题）
⑨ 09_TODO.md — 下一步做什么
⑩ 07_API.md — API 路由（按需阅读）
```

**总阅读时间：约 15-20 分钟**，之后即可理解整个项目的代码结构和业务逻辑，无需重新扫描扫描源码。
