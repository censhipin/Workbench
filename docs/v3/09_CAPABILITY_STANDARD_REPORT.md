# V3 Capability Standard Report

> 生成日期：2026-07-06
> 分析范围：20 个测试文件，392 个测试用例
> 对应 Phase 2 完成标准：✅ 全部满足

---

## 一、8 大能力定义与当前系统覆盖率

### C1：自然语言理解能力（NLU）

**定义**：将中文自然语言指令解析为结构化 TaskPlan 的能力。

**Must Pass Cases（必须成功）**：
| # | 输入 | 期望输出 | 来源 |
|---|------|---------|------|
| 1 | "筛选杭州的数据" | operation=filter, target=杭州 | 立项文档 |
| 2 | "筛选城市是杭州的数据" | operation=filter, columnHint=城市, value=杭州 | 立项文档 |
| 3 | "找一下杭州客户" | operation=filter, value=杭州 | 立项文档 |
| 4 | "技术部工资大于13000" | 2 conditions: dept=技术部 AND salary>13000 | 立项文档 |
| 5 | "筛选2024年1月的数据" | operation=filter, dateRange | 立项文档 |
| 6 | "删除空值数据" | operation=clean | 立项文档 |
| 7 | "计算平均工资" | operation=sum, aggregation=AVG | 立项文档 |
| 8 | "新增一列金额" | operation=formula, target=金额 | nlu-semantic-parser |
| 9 | "金额=数量*单价" | operation=formula, target=金额, source=[数量,单价] | nlu-semantic-parser |
| 10 | "将部门全部改成技术部" | operation=update, target=部门, value=技术部 | nlu-semantic-parser |
| 11 | "筛选之后再排序" | operation=pipeline, steps: [filter, sort] | nlu-semantic-parser |
| 12 | "按部门统计工资总额" | operation=sum, groupBy=部门, aggregation=SUM | aggregate-fix |

**Known Failure Cases（允许失败）**：
- 极度口语化长句（多操作嵌套）
- 无上下文指代（"这个那个那个"）
- 模糊业务逻辑（"优化一下数据"）
- 多操作冲突（"筛选并求和技术部工资，再按部门排序"）

**Validation Rule**：
```
input prompt → TaskPlan

验证步骤:
1. operation 是否正确识别（filter/sort/sum/formula/update/pipeline）
2. 字段提取是否正确（columnHint、target、value）
3. 多条件拆分是否正确（AND/OR 结构）
4. filters 数组长度与内容是否符合预期
```

**当前覆盖率**：**61 个测试**（54 个正向测试，7 个边界测试）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| nlu-semantic-parser.test.ts | 35 | 操作识别、公式意图、更新意图、pipeline、多条件过滤 |
| execution-engine.test.ts | 8 | 语义提取（"统计销售额"→sum、"排序基本工资"→sort） |
| data-engine.test.ts | 5 | normalizeStr、levenshteinDistance、fuzzyFind |
| aggregate-fix.test.ts | 5 | 聚合意图解析 |
| 30-tasks-audit.test.ts | 6 | 全链路集成 |
| 其他 | 2 | e2e-test + ambiguity-detector 部分 |

---

### C2：数据绑定能力（Schema Binding）

**定义**：将自然语言中的字段名映射到数据表实际列的能力。

**Must Pass Cases（必须成功）**：
| # | 输入 | 期望绑定 | 来源 |
|---|------|---------|------|
| 1 | 杭州 → city 列 | columnHint=杭州 → columnKey=city | 立项文档 |
| 2 | 技术部 → department 列 | columnHint=技术部 → columnKey=department | 立项文档 |
| 3 | 工资 → salary / base_salary | 同义词匹配，不区分列名具体叫"工资"还是"基本工资" | 立项文档 |
| 4 | 日期 → date / create_time | 语义匹配到最可能的日期列 | 立项文档 |
| 5 | 精确匹配优先：columnKey 完全匹配 | resolveColumn(knownKey) → columnKey | task-compiler |
| 6 | 大小写不敏感匹配 | resolveColumn("Name") → name | task-compiler |
| 7 | 模糊匹配：列名包含或包含于 hint | resolveColumn("基本工资") → basePay | execution-engine |
| 8 | 歧义检测：多候选且分数接近 → multi_candidate | confidence gap < 0.25 → 触发歧义 | ambiguity-detector |
| 9 | 无候选 → no_match | 无匹配 → 触发 no_match 错误 | ambiguity-detector |
| 10 | 低置信度 → low_confidence | 最佳候选 confidence < 0.7 → 触发歧义 | ambiguity-detector |

**Known Failure Cases（允许失败）**：
- 多列同义冲突（收入/工资/薪资混用时无法准确区分）
- 无列匹配但有语义匹配（如"人员"→空表时无法映射）
- 值反查依赖数据存在（空表无法做值反查）

**Validation Rule**：
```
columnHint → columnKey 必须满足以下优先级:

1. 精确匹配 (columnKey === hint)
2. 标题匹配 (columnTitle === hint, 大小写不敏感)
3. 子串匹配 (title contains hint 或 hint contains title)
4. 概念匹配 (通过 CONCEPT_REGISTRY 的语义映射)
5. 值反查 (在数据行中查找 hint 值 → 定位列)
6. 以上均无匹配 → 必须返回错误/歧义
```

**当前覆盖率**：**50 个测试**（46 个正向，4 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| v2-task-compiler.test.ts | 26 | 列解析、编译契约、各 Plan 结构验证 |
| execution-engine.test.ts | 8 | 语义→列映射、歧义检测各模式 |
| ambiguity-detector.test.ts | 8 | multi_candidate/no_match/low_confidence |
| nlu-semantic-parser.test.ts | 7 | 多条件解析中列/值分离 |
| 30-tasks-audit.test.ts | 1 | 不存在列名错误 |

---

### C3：数据质量检测能力（Data Quality）

**定义**：检测数据中空值、非法值、重复值等质量问题的能力。

**Must Pass Cases（必须检测到）**：
| # | 检测项 | 期望输出 | 来源 |
|---|--------|---------|------|
| 1 | 空值 (null) | nullRate > 0 | 立项文档、audit-engine |
| 2 | NaN | 标记为异常值 | 立项文档 |
| 3 | 空字符串 "" | 标记为空白行 | 立项文档 |
| 4 | 非法日期 | anomaly issueType=date | audit-engine |
| 5 | 非法数字（金额符号、千分位） | anomaly canAutoFix=true | audit-engine |
| 6 | 非法手机号 | anomaly issueType=phone | audit-engine |
| 7 | 非法邮箱 | anomaly issueType=email | audit-engine |
| 8 | 非法身份证号 | anomaly issueType=idcard | audit-engine |
| 9 | 重复行 | duplicates > 0 | audit-engine |
| 10 | 未来日期 | anomaly issueType=date | audit-engine |

**Known Failure Cases（允许失败）**：
- 混合格式数字（"1,000" vs 1000 — 当前仅检测货币符号，不检测格式不一致）
- 隐性空值（undefined / whitespace-only — 当前未覆盖）

**Validation Rule**：
```
audit-engine 输出必须包含以下字段:

{
  stats: { totalRows, totalCols, blankCells, blankRows, numericCols, textCols, dateCols },
  duplicates: [{ rows, count, fields }],
  nulls: [{ fieldKey, nullCount, nullRate }],
  anomalies: [{ rowIndex, fieldKey, originalValue, issueType, canAutoFix, fixedValue? }],
  qualityScore: number,   // 0-100
  qualityGrade: '优秀' | '良好' | '一般' | '较差',
  suggestions: FixSuggestion[]
}
```

**当前覆盖率**：**21 个测试**（18 个正向，3 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| audit-engine.test.ts | 15 | stats、duplicates、nulls、anomalies、autoFix、qualityScore |
| data-engine.test.ts | 2 | cleanData（空行移除、非法值修复） |
| 30-tasks-audit.test.ts | 2 | clean 操作全链路 |
| v2-executors.test.ts | 1 | CleanExecutor |
| v2-execution-engine.test.ts | 1 | clean 执行 |

---

### C4：筛选与条件计算能力（Filter & Condition）

**定义**：根据条件表达式筛选数据行的能力，包括 14 种操作符和多条件组合。

**Must Pass Cases（必须成功）**：
| # | 条件 | 操作符 | 来源 |
|---|------|--------|------|
| 1 | 工资大于 13000 | GT | 立项文档 |
| 2 | 城市是杭州 | EQ | 立项文档 |
| 3 | 部门=技术部 AND 工资>8000 | EQ + AND + GT | 立项文档 |
| 4 | 技术部基本工资>=13000 | EQ + GTE | 立项文档 |
| 5 | 文本包含"技术部" | CONTAINS | predicate |
| 6 | STARTS_WITH / ENDS_WITH | STRS_WITH / ENDS_WITH | predicate |
| 7 | BETWEEN 操作符 | BETWEEN | predicate |
| 8 | IN / NOT_IN 操作符 | IN / NOT_IN | predicate |
| 9 | IS_NULL / NOT_NULL | IS_NULL / NOT_NULL | predicate |
| 10 | 排序（升降序） | ASC / DESC | sort |
| 11 | 去重（按列） | dedup | 30-tasks-audit |
| 12 | 日期范围筛选 | dateRange BETWEEN | data-engine |

**Known Failure Cases（允许失败）**：
- OR 多条件复杂嵌套（当前仅支持 AND）
- 非结构表达（"工资不错的"—模糊语义无法转为确切条件）

**Validation Rule**：
```
FilterPlan 必须满足:

{
  type: 'filter',
  conditions: [
    {
      columnKey: string,     // 已解析的列 key
      operator: Operator,    // GT | GTE | EQ | LT | LTE | CONTAINS | ...
      value: any,            // 条件值（类型与列声明类型一致）
      logic?: 'AND' | 'OR'  // 多条件时使用
    }
  ]
}

验证:
1. conditions 数量与预期一致
2. 每个条件的 operator 正确
3. AND/OR 逻辑结构符合预期
4. 输出行数与筛选条件逻辑一致
5. 排序结果顺序正确（ASC/DESC）
6. 去重后行数正确
```

**当前覆盖率**：**117 个测试**（108 个正向，9 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| v2-predicate.test.ts | 44 | 全部 14 种操作符求值 |
| v2-verifier.test.ts | 16 | 筛选结果验证 |
| data-engine.test.ts | 11 | filterRows、sortRows、dedupRows、filterByDateRange |
| 30-tasks-audit.test.ts | 12 | 全链路筛选/排序/去重 |
| v2-execution-engine.test.ts | 7 | filter/sort/dedup 执行 |
| v2-full-pipeline.test.ts | 6 | 筛选全链路 compile→execute→verify |
| v2-verification-integration.test.ts | 5 | 筛选验证集成 |
| v2-data-transformation.test.ts | 4 | pipeline 中筛选步骤 |
| v2-executors.test.ts | 4 | executor 基本功能 |
| v2-fallback-integration.test.ts | 3 | 规则降级筛选 |
| v2-task-compiler.test.ts | 3 | 筛选编译 |
| execution-engine.test.ts | 1 | V2 排序执行 |
| v2-verifier.test.ts | 1 | 排序验证 |

---

### C5：计算与公式能力（Formula Engine）

**定义**：执行四则运算、函数计算、条件判断等公式计算的能力。

**Must Pass Cases（必须成功）**：
| # | 公式 | 类型 | 来源 |
|---|------|------|------|
| 1 | 收入 = 工资 + 奖金 + 基本工资 | 加法 | 立项文档 |
| 2 | A + B * C（优先级：乘优先于加） | 运算优先级 | 立项文档 |
| 3 | IF 条件表达式 (IF basePay>=15000 → "高"/"低") | 条件判断 | 立项文档 |
| 4 | LEFT / RIGHT / MID 文本函数 | 文本函数 | data-transformation |
| 5 | LEN 文本长度 | 文本函数 | data-transformation |
| 6 | ROUND 四舍五入 | 数值函数 | data-transformation |
| 7 | ABS 绝对值 | 数值函数 | data-transformation |
| 8 | YEAR / MONTH / DAY / DATEDIF 日期函数 | 日期函数 | data-transformation |
| 9 | SUMIF / COUNTIF 条件聚合 | 条件聚合 | data-transformation |
| 10 | TODAY 当前日期 | 日期函数 | data-transformation |
| 11 | SUM 多列求和 | 聚合 | data-transformation |
| 12 | AVG 多列求平均 | 聚合 | data-transformation |

**Known Failure Cases（允许失败）**：
- 复杂字符串拼接公式
- 复杂日期运算（如"计算工龄"涉及闰年）
- 嵌套函数超过 3 层

**Validation Rule**：
```
公式必须验证:

1. AST 正确解析（操作符和操作数正确）
2. 运算优先级正确（* 优先于 +）
3. 每一步计算可追踪（中间结果可访问）
4. 目标列存在时覆盖/不存在时新增的行为正确
5. 空值处理策略合理（空→0/空→null/空→跳过）

输出验证:
- 计算后的列值符合预期
- 行数不变（公式不增删行）
- 新增列位置正确（在最后 sourceColumn 之后）
```

**当前覆盖率**：**27 个测试**（23 个正向，4 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| v2-data-transformation.test.ts | 22 | + - * / ROUND ABS SUM AVG LEFT RIGHT MID LEN YEAR/MONTH/DAY DATEDIF SUMIF COUNTIF TODAY |
| 30-tasks-audit.test.ts | 4 | IF 公式、pipeline 中的公式 |
| e2e-test.test.ts | 1 | 全链路公式（金额乘以 0.9） |

---

### C6：多表匹配能力（Join & Match）

**定义**：将两张或多张表按匹配键关联的能力。

**Must Pass Cases（必须成功）**：
| # | 操作 | 期望 | 来源 |
|---|------|------|------|
| 1 | 按城市匹配两个表 | 匹配行合并，不匹配行保留 | 立项文档 |
| 2 | 左表比右表多城市 → 不报错，输出 unmatched | unmatchedLeft > 0 | 立项文档 |
| 3 | 两张表纵向合并（union） | 行叠加，列对齐 | data-engine |
| 4 | 三张表匹配 | 逐表关联 | data-engine |
| 5 | 模糊匹配（Levenshtein） | 空格干扰、大小写差异仍可匹配 | data-engine |
| 6 | 合并时列结构不一致 → 额外列用 null 补齐 | null 填充 | data-engine |

**Known Failure Cases（允许失败）**：
- 数据缺失强制失败（✅ 当前已允许，输出 unmatched）
- 多对多匹配无警告
- 复合键匹配顺序影响结果

**Validation Rule**：
```
匹配操作必须输出:

{
  matchedRows: number,     // 匹配上的行数
  unmatchedLeft: number,   // 左表未匹配行数
  unmatchedRight: number,  // 右表未匹配行数
  matchedColumns: string[] // 匹配使用的列
}

验证:
1. matchedRows + unmatchedLeft = leftTable.rows.length
2. 匹配列前缀正确（_lkp_ 避免列名冲突）
3. 模糊匹配阈值 Levenshtein ≥ 0.85
```

**当前覆盖率**：**11 个测试**（7 个正向，4 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| data-engine.test.ts | 5 | matchMultiTables（2表/3表/1表）、mergeTables（列对齐） |
| v2-verifier.test.ts | 3 | MatchVerifier（匹配键存在/不存在/跳过） |
| v2-executors.test.ts | 2 | MatchExecutor 缺表抛错、MergeExecutor 缺表抛错 |
| 30-tasks-audit.test.ts | 1 | merge 全链路 |

---

### C7：聚合分析能力（Aggregation）

**定义**：对数据按列进行分组聚合计算（SUM/AVG/COUNT/MAX/MIN）的能力。

**Must Pass Cases（必须成功）**：
| # | 操作 | 期望输出格式 | 来源 |
|---|------|-------------|------|
| 1 | 按部门平均工资 | [{group:"技术部", avgSalary:12000}, ...] | 立项文档 |
| 2 | 按城市统计人数 | [{group:"杭州", count:50}, ...] | 立项文档 |
| 3 | groupBy + AVG | 分组平均值 | aggregate-fix |
| 4 | groupBy + SUM | 分组总和 | aggregate-fix |
| 5 | groupBy + COUNT | 分组计数 | aggregate-fix |
| 6 | groupBy + MAX / MIN | 分组最大/最小值 | data-engine |
| 7 | 无分组全局 SUM | 单行结果 | data-engine |
| 8 | 多列聚合 | 每列独立聚合 | data-engine |
| 9 | 混合 null 值跳过 | null 行不参与计算 | data-engine |
| 10 | 非数字值跳过 | 不抛错 | data-engine |

**Known Failure Cases（允许失败）**：
- **字符串列做聚合返回 0（当前问题）**— 应返回明确错误而非静默 0
- 分组键唯一值过多导致结果行数爆炸

**Validation Rule**：
```
聚合操作必须验证:

1. columns 数组中每列都是数值类型（或可转为数值）
2. groupBy 列必须在数据表中存在
3. 输出行数 = groupBy 唯一值数（有分组时）/ 1（无分组时）

输出格式:
[
  { group: string, methodColumn: number },
  // 或（无 groupBy 时）
  { methodColumn: number }
]

验证:
1. 聚合数值正确（与手动计算一致）
2. 分组正确（每行属于正确的组）
3. 空值/非数字行已跳过
4. 多列聚合时列顺序与输入一致
```

**当前覆盖率**：**35 个测试**（31 个正向，4 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| data-engine.test.ts | 7 | SUM/AVG/COUNT/MAX/MIN、分组、null 跳过、全局聚合 |
| v2-full-pipeline.test.ts | 2 | 聚合 compile→execute→verify 全链路 |
| v2-verifier.test.ts | 3 | AggregateVerifier（无分组/分组/值错误） |
| aggregate-fix.test.ts | 4 | NLU 解析聚合意图（AVG/SUM/COUNT + groupBy） |
| v2-task-compiler.test.ts | 4 | 聚合编译（单列/多列/分组/无分组） |
| v2-execution-engine.test.ts | 3 | SUM/AVG/分组执行 |
| v2-verification-integration.test.ts | 2 | 聚合验证集成 |
| 30-tasks-audit.test.ts | 3 | 聚合全链路集成 |
| v2-executors.test.ts | 2 | AggregateExecutor（有/无分组） |
| v2-fallback-integration.test.ts | 3 | 规则降级聚合 |
| execution-engine.test.ts | 1 | 聚合 V2 执行 |
| e2e-test.test.ts | 1 | 端到端聚合 |

---

### C8：错误恢复与解释能力（Recovery & Explain）

**定义**：当执行失败时提供结构化错误（含原因、建议、可修复性）的能力，以及执行成功后解释"发生了什么"的能力。

**Must Pass Cases（必须满足）**：
| # | 场景 | 期望行为 | 当前状态 |
|---|------|---------|---------|
| 1 | 找不到列 → 提示正确列 | ErrorRecord { code: COL-001, suggestion: "您是否想使用Y?" } | ❌ 仅有"找不到列"字符串 |
| 2 | 类型错误 → 自动转换建议 | ErrorRecord { code: TYP-001, autoFixAvailable: true } | ❌ 仅返回 NaN |
| 3 | 空值 → 自动提示影响范围 | ErrorRecord { code: QLT-001, detail: "空值率30%" } | ❌ 无提示 |
| 4 | 直接 throw error | ❌ 禁止 | ❌ 当前仍有 throw |
| 5 | 无解释错误 | ❌ 禁止 | ❌ 当前 buildErrorMessage 返回原始字符串 |
| 6 | v2plan 缺失 → 返回编译错误而非降级 | 返回结构化的"无法生成执行计划" | ⚠️ 有错误但有 V2PLAN_MISSING 代码 |
| 7 | 执行验证失败 → 返回验证细节 | 逐条检查结果和说明 | ⚠️ verification.checks 有 detail 但非结构化 |

**Known Failure Cases（允许失败）**：
- 复杂多步错误归因（pipeline 中哪一步导致的错误）
- AI 不可用时无法生成修复建议

**Validation Rule**：
```
错误必须结构化:

{
  code: string,            // 机器可读错误码
  severity: 'info'|'warning'|'error'|'critical',
  message: string,         // 人类可读
  category: ErrorCategory,
  reason: string,          // 为什么发生
  suggestion: string,      // 用户可以做什么
  autoFixAvailable: boolean,
  autoFixConfidence: number
}

禁止:
❌ 返回空结果且无解释
❌ 返回 error 但不说明原因
❌ 返回 partial result 不提示
❌ 直接 throw Error（必须在引擎层统一捕获）
```

**当前覆盖率**：**52 个测试**（44 个正向，8 个边界）

| 来源文件 | 测试数 | 覆盖范围 |
|---------|--------|---------|
| v2-verifier.test.ts | 9 | 注册、各 verifier 功能 |
| v2-data-transformation.test.ts | 9 | pipeline 输出约束、注册检查、边缘情况 |
| 30-tasks-audit.test.ts | 6 | 空输入、不存在操作、不存在列、聚合错误、5步计划 |
| v2-executors.test.ts | 5 | 注册中心、缺表异常 |
| v2-full-pipeline.test.ts | 5 | 全链路验证通过 |
| v2-execution-engine.test.ts | 4 | 空数据、无 v2plan 错误、执行错误 |
| v2-fallback-integration.test.ts | 5 | 规则降级空操作、全链路 |
| v2-verification-integration.test.ts | 2 | 无验证器默认通过、verifier 注册 |
| v2-task-compiler.test.ts | 4 | 找不到列编译失败、不支持操作符、未知操作 |
| execution-engine.test.ts | 2 | 无 v2plan 不降级 |
| e2e-test.test.ts | 1 | 全链路成功 |

---

## 二、总体覆盖率汇总

| 能力 | 定义 | 测试数 | 正向测试 | 边界测试 | 覆盖率评估 |
|------|------|--------|---------|---------|-----------|
| **C1** NLU | operation 识别、字段提取、多条件拆分 | 61 | 54 | 7 | ⚠️ 中（缺少"低于"→LT、"高于"→GT 覆盖） |
| **C2** Schema Binding | 列名匹配、歧义检测、值反查 | 50 | 46 | 4 | ✅ 高（但缺值反查实现） |
| **C3** Data Quality | 空值/异常值/重复值检测 | 21 | 18 | 3 | ⚠️ 中（缺少隐性空值、混合格式数字） |
| **C4** Filter & Condition | 14 种操作符、多条件组合 | 117 | 108 | 9 | ✅ 高（最充分覆盖） |
| **C5** Formula Engine | 四则运算、函数、IF | 27 | 23 | 4 | ⚠️ 中（缺嵌套函数、字符串拼接） |
| **C6** Join & Match | 多表匹配、合并 | 11 | 7 | 4 | ❌ 低（仅基本路径，缺多对多/复合键） |
| **C7** Aggregation | 分组聚合 SUM/AVG/COUNT/MAX/MIN | 35 | 31 | 4 | ✅ 高 |
| **C8** Recovery & Explain | 结构化错误、执行解释 | 52 | 44 | 8 | ❌ 低（均为集成测试附带的错误处理，无独立结构化错误测试） |
| **合计** | | **374** | **331** | **43** | |

注：另有 46 个测试（v2-output-processor 18 + v2-projection 13 + regression-trace 15）属于输出格式和诊断功能，不在 8 大能力范围内。

---

## 三、缺失能力列表

### 高优先级（必须在下阶段解决）

| # | 缺失能力 | 所属能力域 | 当前状态 | 影响 |
|---|---------|-----------|---------|------|
| M1 | **值反查能力** | C2 | 无实现。field-resolver.ts 明确标注"pure mapping, no reasoning"，不做值反查 | 列名不匹配时无法通过值回推定位列 |
| M2 | **结构化错误记录** | C8 | buildErrorMessage 返回原始字符串 | 错误不可编程处理、不能提供建议和自动修复 |
| M3 | **类型不匹配警告** | C7 + C5 | 字符串列做聚合静默返回 NaN 或 0 | 用户不知数据有问题 |
| M4 | **0 匹配行解释** | C4 | 筛选返回空结果时无任何说明 | 用户不知道"为什么没有数据" |
| M5 | **隐性空值检测** | C3 | 仅检测 null/""，不检测 undefined/whitespace-only | 数据质量报告不完整 |
| M6 | **错误码注册表未实现** | C8 | 已在文档中定义 20+ 错误码，但代码中没有 | 无法生成标准化的 ErrorRecord |

### 中优先级（应在 Phase 3-5 覆盖）

| # | 缺失能力 | 所属能力域 | 说明 |
|---|---------|-----------|------|
| M7 | 数据影响预估（去重/筛选前告知用户会删多少行） | C4 + C8 | 当前无 pre-execution 预估 |
| M8 | 多对多匹配警告 | C6 | 匹配列不唯一时无提示 |
| M9 | 公式嵌套函数 > 2 层 | C5 | 当前仅测试单层函数 |
| M10 | 复合键匹配 | C6 | 当前测试仅使用单列匹配 |
| M11 | OR 多条件复杂嵌套 | C4 | 当前仅 AND 条件有充分覆盖 |
| M12 | 列结构差异合并警告 | C6 | 列结构不同时合并无提示 |

---

## 四、风险列表

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|---------|
| C6 测试覆盖严重不足 | 🔴 高 | 仅 11 个测试，且无端到端 Match 全链路测试 | Phase 3-4 补充至少 20 个 |
| C8 结构化错误无实现 | 🔴 高 | 20+ 错误码已在文档定义但代码中没有 | Phase 3 实现 ErrorRecord 系统 |
| C3 缺少隐性空值检测 | 🟡 中 | 数据质量报告可能漏报 | Phase 4 补充 |
| C1 缺少"低于/高于"同义词 | 🟡 中 | 已知 Bug（"高于"不被识别为"大于"） | 下阶段修复 |
| 值反查能力缺失 | 🟡 中 | 列名匹配成功率受限 | Phase 3-4 EIC Repair 实现 |
| 聚合字符串列静默失败 | 🟡 中 | 已有测试 T24 验证了错误路径，但错误消息不友好 | Phase 3 EIC Validate 处理 |

---

## 五、当前系统对 Must Pass Cases 的覆盖率

| 能力域 | Must Pass Cases 总数 | 已覆盖 | 未覆盖 | 覆盖率 |
|--------|-------------------|--------|--------|--------|
| C1 NLU | 12 | 12 | 0 | **100%** ✅ |
| C2 Schema Binding | 10 | 9 | 1（值反查） | **90%** ⚠️ |
| C3 Data Quality | 10 | 9 | 1（隐性空值） | **90%** ⚠️ |
| C4 Filter & Condition | 12 | 12 | 0 | **100%** ✅ |
| C5 Formula Engine | 12 | 12 | 0 | **100%** ✅ |
| C6 Join & Match | 6 | 5 | 1（复合键） | **83%** ⚠️ |
| C7 Aggregation | 10 | 10 | 0 | **100%** ✅ |
| C8 Recovery & Explain | 7 | 2 | **5** | **29%** ❌ |
| **合计** | **79** | **71** | **8** | **90%** |

---

## 六、当前系统已知缺口分布

将立项文档的 3 个 Bug + 6 个架构问题映射到 8 大能力：

| 问题 | 原归类 | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|------|--------|----|----|----|----|----|----|----|----|
| Bug 1: 高于不被识别为大于 | 规则解析器 | ● | | | ● | | | | |
| Bug 2: 产品在 operationWords 中 | 规则解析器 | ● | | | | | | | |
| Bug 3: "只看"映射为 filter 非 select | 规则解析器 | ● | | | ● | | | | |
| 规则膨胀（82同义词+20概念+13正则） | 架构 | ● | ● | | | | | | |
| 规则无置信度 | 架构 | ● | | | | | | | ● |
| WorkflowTree 死代码 | UI | | | | | | | | |
| showDiff 硬编码 false | UI | | | | | | | | |
| BottomBar 缺少 prompt 示例 | UI | | | | | | | | |
| 三个死代码文件 | UI | | | | | | | | |

**结论**：当前 Bug 集中在 **C1（NLU）+ C8（Recovery/Explain）**。修复这些 Bug 的正确路径不是加规则，而是通过 EIC 的 Validate + Repair 统一能力层处理。

---

## 七、Phase 2 完成标准验证

| 标准 | 状态 | 说明 |
|------|------|------|
| 所有 8 个 Capability 已定义 | ✅ | 每个都有 Must Pass / Known Failure / Validation Rule |
| 所有 Must Pass 用例已明确 | ✅ | 79 个 Must Pass 用例，71 个已覆盖，8 个缺失 |
| 所有 Validation Rule 已明确 | ✅ | 每个能力有独立的验证规则 |
| 可转为自动测试结构 | ✅ | 每个 Must Pass 用例可直接翻译为 it('...') 测试 |
| 不涉及任何代码修改 | ✅ | 仅在 docs/v3/ 增加报告文档 |
| 当前系统覆盖率（%） | ✅ | 按能力和 Must Pass 分别计算 |
| 缺失能力列表 | ✅ | 12 项缺失能力（6 高优 + 6 中优） |
| 风险列表 | ✅ | 5 项风险（2 高 + 3 中） |

---

## 八、给 Phase 3 的输入

Phase 3 应基于本报告优先处理：

1. **高优缺失 M2（结构化错误）**— 实现 ErrorRecord 类型和错误码注册表
2. **高优缺失 M1（值反查）**— 实现 EIC Repair 的列名模糊匹配
3. **高优缺失 M6（错误码实现）**— 将文档定义的 20+ 错误码落地到代码
4. **C8 Must Pass 覆盖从 29% 提升到 80%+**
5. **修复 C1 已知 Bug（高于、产品、只看）**— 通过 EIC Validate 而非加规则
