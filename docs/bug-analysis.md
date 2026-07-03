# 问题分析报告

## 环境
所有测试 333 个全部通过。问题出在运行时而非测试。

## 核心 Bug 清单

### Bug 1: `semantic-parser.ts` — '产品' 被错误列入 operationWords
Line 761: `'产品'` 在 operationWords 集合中，导致"筛选产品为产品A"时，"产品"被当作操作词过滤掉，无法匹配到列名"产品"。
**影响：** 所有含"产品"的筛选操作（任务 2）

### Bug 2: `semantic-parser.ts` — extractParams 缺少 '为' 模式
筛选值提取的正则没有处理 "为"："筛选产品**为**产品A"中的"为"没有被识别为等于操作符。
**影响：** 值提取不正确，filterValue 残留在"产品为产品A"（任务 2）

### Bug 3: `semantic-parser.ts` — "只看" 在词库中被映射为 filter
`intent-lexicon.ts` 中"只看/只显示/只保留"被归为 filter 同义词，但实际语义是 projection（列选择）。
**影响：** "只看姓名和岗位"（任务 7）被误判为筛选操作而非投影

### Bug 4: `data-engine.ts` — parseOperator 无法映射 V2 Operator 枚举
parseOperator 对 Operator 枚举值（'EQ', 'GT', 'IS_NULL', 'NE' 等）做 `.toLowerCase()` 后查找硬编码映射表，但映射表缺少 'is_null', 'not_null', 'ne' 等键。
**影响：** IS_NULL/NOT_NULL 条件的 filterRowsMulti 默认变成 EQ 比较（任务 5,7,8,9 的筛选）

### Bug 5: `page.tsx` — executeIntent 不传所有任务文件
executeIntent 调用 `runExecutionEngine(intent, execFile, sheetName, [execFile])` 只传主文件，match 操作需要多个文件。
**影响：** 跨表匹配/合并操作失败（任务 20, 21）

### Bug 6: `semantic-parser.ts` — detectIfCondition 正则提取 trueVal 包含多余文本
IF regex 提取 trueValue 时，如果目标列名在条件中出现，trueValue 会包含"列名="前缀。
如 "等级=高" → trueValue = "等级=高" 而非 "高"。
**影响：** IF 公式值错误（任务 14）

### Bug 7: `page.tsx` — handleSubmit 未传递任务文件列表
handleSubmit 调用 executeIntent 时没有把 taskFileIds 对应的文件传递过去。
**影响：** 匹配操作（任务 20, 21）无法获取多个表

### Bug 8: 任务文件传递机制缺失
executeIntent 回调没有 `files` 和 `taskFileIds` 依赖，无法获取完整文件列表。
