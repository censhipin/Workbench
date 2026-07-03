# AI Pipeline

## 整体流程

```
用户自然语言输入
  ↓
parseIntentWithAI() (lib/nlu/index.ts:47)
  ├── 优先：deepseekUnderstand() → DeepSeek API → TaskPlan JSON
  │     ↓ taskPlanToIntent() → TaskIntent
  │     ↓ compile() → v2plan (ExecutionPlan)
  │     ↓ resolveTaskPlanColumns() → SchemaResolution
  │
  └── 降级：parseAndResolve()
        ↓ RuleBasedSemanticParser.parse() → TaskIntent
        ↓ ruleIntentToTaskPlan() → TaskPlan
        ↓ compile() → v2plan
        ↓ resolveSchema() → SchemaResolution
  ↓
runExecutionEngine() — 执行
```

## AI 理解层 (`lib/nlu/deepseek.ts`)

### `deepseekUnderstand()`

输入：用户文本 + 表名 + 列定义(含类型) + 行样本数据(每列前10个非空值)  
输出：`{ success, plan: TaskPlan | null, error? }`

实现：
1. `buildSystemPrompt()` — 构建含完整列描述 + 示例值的 system prompt
2. `buildUserMessage()` — 将用户指令包装为"请解析以下指令"
3. `callDeepSeek()` — 通过 `app/api/deepseek/route.ts` 代理调用 DeepSeek
4. `parseResponse()` — 解析返回的 JSON，兼容多种格式差异

### System Prompt 内容

包含：当前表名、所有列名+类型+前10个样本值、14 种可执行动作的 JSON 模板（含过滤/排序/聚合/公式/IF/文本函数/pipeline 等）、输出约束示例。要求只输出 JSON 不输出解释。

### API 代理 (`app/api/deepseek/route.ts`)

- POST 请求转发到 `https://api.deepseek.com/chat/completions`
- API Key 来源：请求头 `x-deepseek-api-key` > 环境变量 `DEEPSEEK_API_KEY`
- 模型：`deepseek-chat`，temperature=0.1，max_tokens=1024

## TaskPlan → TaskIntent (`lib/nlu/taskplan-converter.ts`)

`taskPlanToIntent()` — 将 DeepSeek 返回的 TaskPlan JSON 转换为系统内部的 TaskIntent

映射关系：TaskPlan.action → Operation 枚举，conditions → FilterCondition，columnHint → target 等。

## 规则降级层

当 DeepSeek API 不可用或返回失败时，走规则解析：

### RuleBasedSemanticParser (`lib/nlu/semantic-parser.ts`)

基于关键词 + 字典 + 正则的规则系统，当前支持：

- 操作检测：82 个同义词映射到 8 种操作
- formula 检测：10 个关键词 + 正则
- update 检测：12 个关键词 + 正则
- projection 检测："只看/只保留"模式
- Pipeline 分割：7 个连接词正则
- 条件提取：13 个比较运算符正则
- 聚合方式：5 种聚合关键词
- 中文数字转换：万/千/百等

### Schema Resolver (`lib/nlu/schema-resolver.ts`)

将语义目标（如"销售额"）映射到实际列。

策略：概念注册表匹配 → 最长公共子串 → 模糊匹配评分。

当前注册 20 组语义概念（销售额、工资、绩效、加班费、手机号、邮箱、身份证、日期等），每组有 3-8 个 columnKeywords。

### IntentLexicon (`lib/nlu/intent-lexicon.ts`)

管理操作 → 同义词的映射。内置 82 个同义词条目覆盖 10 种操作。

## 关键问题

【当前实现】
- AI 路径：真正调用 DeepSeek，返回结构化 JSON
- 规则路径：依赖 82 个同义词 + 20 组概念映射 + 13 个正则
- 两套系统输出格式一致，但理解质量差异很大
- 无 DeepSeek API Key 时全部走规则降级

【后续计划】
- 考虑支持本地模型替代规则降级
- 规则路径应标记置信度，区分"AI 理解"与"规则猜测"
