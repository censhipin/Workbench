# 能力→层映射

## 六层模型

| 层号 | 名称 | 职责 | 核心文件 |
|------|------|------|---------|
| 0 | **NLU** | 自然语言 → 结构化意图 | `lib/nlu/` |
| 1 | **AI** | 推理、建议、修复、解释 | `lib/v3/ai/`（新增） |
| 2 | **Profile** | 数据画像、统计、质量 | `lib/v3/profile/`（新增 + audit-engine） |
| 3 | **Execution** | 计划执行、输出约束 | `lib/v2/executors/` + `lib/v2/output-processor/` |
| 4 | **Verification** | 结果验证 | `lib/v2/verifier/` |
| 5 | **Presentation** | UI 状态 + 解释 | `app/page.tsx` + `components/` |

## 能力归属矩阵

### Layer 0 — NLU（V2 保有，不变）

| 能力 | V2 位置 | 状态 |
|------|---------|------|
| 自然语言→TaskPlan（AI） | lib/nlu/deepseek.ts | ✅ 保有 |
| 自然语言→TaskPlan（规则降级） | lib/nlu/semantic-parser.ts | ✅ 保有 |
| 歧义检测 | lib/ambiguity-detector.ts | ✅ 保有 |
| 词库与同义词 | lib/nlu/intent-lexicon.ts | ✅ 保有 |
| TaskPlan → TaskIntent 转换 | lib/nlu/taskplan-converter.ts | ✅ 保有 |
| 规则 → TaskPlan 转换 | lib/nlu/rule-taskplan-converter.ts | ✅ 保有 |

### Layer 1 — AI（V3 新增）

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 列名模糊匹配（值反查） | P1 | 当列名不存在时，反向查找列值匹配 |
| 列名语义推荐 | P1 | "杭州"→ 推荐"城市"列的"杭州"值 |
| 结构化错误构建 | P1 | ErrorRecord {code, reason, suggestion, autoFix} |
| 错误码注册与查询 | P1 | 统一错误码表 |
| 自动修复执行 | P2 | 列缺失→自动匹配→重试 |
| 类型自动转换 | P2 | 文本→数字、日期格式标准化 |
| 智能聚合策略 | P2 | 空值跳过策略、异常值处理 |
| 执行解释生成 | P2 | "为什么筛选掉了80%的行" |
| 置信度评分 | P2 | 对自动修复的可信度打分（0-1） |

### Layer 2 — Profile（V3 新增，包装 V2 audit-engine）

| 能力 | 优先级 | 说明 |
|------|--------|------|
| 数据基本统计 | P1 | 行数、列数、空值率、唯一值率 |
| 列类型分布 | P1 | 每列数值/文本/空值比例 |
| 列值分布 | P1 | 去重值数、高频值、范围 |
| 质量评分 | P1 | 复用 audit-engine 的 computeQualityScore |
| 聚合适合度判断 | P2 | 某列是否适合求和/平均/分组 |
| Join Key 适合度判断 | P2 | 某列是否适合作匹配键 |
| 过滤条件可行性 | P2 | 值是否存在于数据中 |
| 数据模式检测 | P2 | 日期格式、电话格式、金额格式 |

### Layer 3 — Execution（V2 保有，不变）

| 能力 | V2 位置 | 状态 |
|------|---------|------|
| 计划校验 | lib/v2/plan-validator.ts | ✅ 保有 |
| 11 种 Executor 执行 | lib/v2/executors/**.ts | ✅ 保有 |
| 输出约束处理 | lib/v2/output-processor/ | ✅ 保有 |
| TaskPlan → ExecutionPlan 编译 | lib/v2/task-compiler.ts | ✅ 保有 |
| 字段解析（列映射） | lib/v2/field-resolver.ts | ✅ 保有 |
| 数据快照与隔离 | lib/v2/execution-snapshot.ts | ✅ 保有 |

### Layer 4 — Verification（V2 保有 + V3 增强）

| 能力 | V2/V3位置 | 优先级 | 说明 |
|------|-----------|--------|------|
| 执行结果验证 | lib/v2/verifier/ | ✅ 保有 | V2 不变 |
| 验证失败解释 | lib/v3/explain/ | P2 | 在验证结果基础上生成结构化解释 |

### Layer 5 — Presentation（V2 保有 + V3 增强）

| 能力 | V2/V3位置 | 优先级 | 说明 |
|------|-----------|--------|------|
| 5 步执行计划展示 | lib/execution-engine.ts PlanStepBuilder | ✅ 保有 | 增强显示解释信息 |
| 错误信息展示 | lib/execution-engine.ts buildErrorMessage | P2 | 替换为结构化 ErrorRecord 展示 |

## 能力边界（明确什么不属于 EIC）

| 能力 | 归属 | 解释 |
|------|------|------|
| 自然语言理解 | Layer 0 NLU | EIC 不处理用户原始输入 |
| 实际数据修改 | Layer 3 Execution | EIC 不直接操作数据 |
| UI 渲染 | Layer 5 Presentation | EIC 不生成 UI |
| 数据持久化 | 存储层 | EIC 不负责存储 |
| ExecutionPlan 编译 | Layer 3 Execution | task-compiler 不变 |
