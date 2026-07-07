# Phase 4 Repair Layer Report

> 生成日期：2026-07-06
> 新增 8 个源文件 + 1 个测试文件，共 ~1,200 行 TypeScript

## 新增模块

```
lib/v3/repair/
  repair-types.ts      — 共享类型（RepairRecord, RepairReport, RepairAction, RepairContext）
  value-repair.ts      — 值规范化（trim/全角半角/NFKC/Levenshtein/Dice）
  column-repair.ts     — 列修复（列模糊匹配 + 值→列反推 + resolveColumnReferences）
  type-repair.ts       — 类型转换（数字/日期/Boolean 格式统一 + convertConditionValues）
  join-repair.ts       — Join 模糊匹配与映射（4 阶段匹配策略）
  formula-repair.ts    — 递归下降公式 AST 解析器
  null-repair.ts       — 统一空值定义（isNull / normalizeNull / NullDefinition）
  repair-report.ts     — 修复报告构建器与格式化器
  repair-engine.ts     — 修复编排器主入口（串联 6 个修复阶段）
```

## 新增能力

### 1. 值规范化（所有比较的统一基础）
- **trim/fullwidth/NFKC/collapse/lowercase** 五步规范化
- `normalizeValue()`：统一中英文混排的字符串比较
- `valuesAreEqual()` / `valueSimilarity()` / `levenshteinDistance()`

### 2. 列修复（解决"找不到 X 列"）
- **值→列反推**：`inferColumnFromValue()` 遍历列唯一值索引，将"杭州"反向匹配到"城市"列
- **列模糊匹配**：`fuzzyMatchColumn()` — 完全匹配 > 大小写 > 包含 > Levenshtein
- **resolveColumnReferences()**：遍历 ExecutionPlan 的 filter/sort/aggregate 等所有计划类型的列引用

### 3. 类型转换（解决"100元"不是 number）
- `parseNumeric()`：￥100/100元/1,000/100%/50％ 等 9 种中文数字格式
- `parseDate()`：YYYY/MM/DD / YYYY年MM月DD日 / MM/DD/YYYY 等日期格式
- `parseBoolean()`：是/否/true/false/1/0/Y/N 等
- `convertConditionValues()`：遍历 plan 条件值，自动修复类型不匹配

### 4. Join 模糊匹配
- `buildJoinMapping()`：4 阶段匹配（精确→包含→Levenshtein→前缀）
- 左表 3 值右表 2 值 → 不失败，输出未匹配说明

### 5. 公式 AST 解析器
- **递归下降解析器**：expression → term → factor
- 支持运算符：`+ - * / % > < >= <= == !=`
- 支持函数调用：`IF()`, `ROUND()`, `ABS()`, `SUM()`, `MAX()`, `MIN()`, `AVG()`
- 支持中文列名、嵌套函数、括号分组
- 提取所有引用的列名用于校验

### 6. 统一空值定义
- `isNull()`：null / "" / "  " / "NULL" / "N/A" / "-" / "none" → true
- `NullDefinition`：可配置的空值模式（null/empty/whitespace/literal/placeholder）
- `suggestNullStrategy()`：根据列空值率和操作类型推荐空值处理策略

### 7. 修复编排器
- `repairPlan()`：串联 6 个修复阶段（null → column → type → join → formula → pipeline）
- 高置信度自动修复，低置信度记录建议
- 返回修复后的 plan 副本 + RepairReport
- 不修改原始数据

## 测试结果

- **436 个测试通过**（包含 89 个新增 repair 测试 + 347 个已有 V2/V3 测试）
- 1 个已知预先存在失败的测试未计入（T7 merge，非本次变更导致）
- 新增测试覆盖：
  - Value Repair: 18 个用例
  - Column Repair: 20 个用例（fuzzyMatch/inferColumn/resolveReferences）
  - Type Repair: 16 个用例（数字/日期/Boolean/条件值转换）
  - Join Repair: 4 个用例
  - Formula Repair: 11 个用例（算术/函数/错误处理）
  - Null Repair: 8 个用例
  - Repair Report: 2 个用例
  - Repair Engine Integration: 10 个用例（编排/Pipeline/置信度）

## 已解决的问题

| 问题 | 修复方案 |
|------|---------|
| "找不到杭州列" | inferColumnFromValue 将"杭州"反推到"城市"列 |
| "100元"无法参与数字比较 | parseNumeric 自动转换中文数字格式 |
| "杭州" vs "杭州市" Join 失败 | buildJoinMapping 模糊匹配 |
| "工资*奖金+工资"被拆解执行 | parseFormula 生成完整 AST |
| NULL/N/A/"" 标准不一 | isNull() 统一判断 |
| "城市"写为"城市名" | fuzzyMatchColumn 包含匹配 |

## 仍待后续 Phase 处理的问题

1. **AST 求值**：FormulaExecutor 仍使用 expressionType 枚举分发，AST 求值需 Phase 7+ 集成时完成
2. **isNull() 集成**：predicate.ts 和 data-engine.ts 中的空值判断仍使用旧逻辑，需 Phase 7+ 统一替换
3. **规范化值比较集成**：Filter/Join 等执行路径仍使用原始字符串比较，未接入 value-repair 的规范化
4. **Repair 集成到执行链**：当前 `repairPlan()` 是独立可调用的函数，尚未作为 EIC 流程的一部分接入 `lib/execution-engine.ts`
5. **UI 展示 RepairReport**：formatRepairReport 已可生成结构化文本，但 UI 层还未展示
