# Rule System

## 概述

规则系统是 AI 不可用时的降级方案，基于关键词匹配 + 正则表达式 + 词典查找。当前覆盖操作识别、列名映射、条件提取三大功能。

## 操作识别 (`lib/nlu/semantic-parser.ts` + `lib/nlu/intent-lexicon.ts`)

### IntentLexicon

82 个硬编码同义词映射到 10 种标准操作：

| 操作 | 同义词数量 | 示例 |
|------|-----------|------|
| sum | 15 | 求和、统计、汇总、总计、加起来 |
| sort | 9 | 排序、升序、降序、从大到小 |
| filter | 13 | 筛选、过滤、只保留、找出 |
| dedup | 8 | 去重、删除重复、去除重复 |
| match | 5 | 匹配、关联、VLOOKUP |
| merge | 5 | 合并、拼接、整合 |
| clean | 7 | 清洗、清理、修复、净化 |
| update | 10 | 填充、修改、更新、替换 |
| formula | 10 | 新增列、乘以、除以、保留 |
| — | 30+ 停用词 | 的、了、是、在、帮、请 |

### 操作检测优先级

1. formula 检测（10 个关键词 + "如果/则"模式 + "="号检测）
2. update 检测（12 个关键词 + "将"开头模式）
3. projection 检测（"只看/只保留"模式）
4. lexicon 反向索引匹配

## 目标列提取 (`lib/nlu/semantic-parser.ts`)

`extractTarget()` 策略：

1. 精确匹配用户输入的关键词到列名
2. 移除操作词（50 个）+ 停用词（30 个），取剩余词
3. 移除"按XX"分组前缀和聚合后缀
4. 空时返回空字符串

## Schema Resolver (`lib/nlu/schema-resolver.ts`)

### 三阶段匹配

1. **概念匹配** — 20 组预定义概念（销售额→金额，工资→基本工资等）
2. **模糊概念匹配** — target 包含关键词或关键词包含 target（置信度 ≤ 0.7）
3. **列名模糊匹配** — 最长公共子串（置信度 ≥ 0.3 即返回）

### 概念注册表

```typescript
DEFAULT_CONCEPT_REGISTRY = [
  { concept: '销售额',   columnKeywords: ['金额', '销售金额', '销售额', '总金额', '收入', '营收', '营业额'] },
  { concept: '工资',      columnKeywords: ['工资', '薪资', '薪酬', '收入', '基本工资', '底薪'] },
  { concept: '绩效',      columnKeywords: ['绩效', '奖金', '绩效奖金', '绩效工资', '提成'] },
  { concept: '加班费',    columnKeywords: ['加班', '加班补贴', '加班费', '加班工资'] },
  { concept: '扣除',      columnKeywords: ['扣除', '扣款', '扣除项', '扣减', '罚款'] },
  { concept: '单价',      columnKeywords: ['单价', '价格', '售价', '定价'] },
  { concept: '数量',      columnKeywords: ['数量', '个数', '件数'] },
  { concept: '总额',      columnKeywords: ['总额', '合计', '总计', '总金额', '小计'] },
  { concept: '姓名',      columnKeywords: ['姓名', '名字', '名称', '员工姓名'] },
  { concept: '手机号',    columnKeywords: ['手机', '手机号', '电话', '联系电话', '手机号码', '移动电话'] },
  { concept: '邮箱',      columnKeywords: ['邮箱', '邮件', 'Email', '电子邮件', '电子邮箱'] },
  { concept: '身份证',    columnKeywords: ['身份证', '身份证号', '证件号', '证件号码', 'ID'] },
  { concept: '日期',      columnKeywords: ['日期', '时间', '年月日', '日'] },
  { concept: '入职日期',  columnKeywords: ['入职', '入职日期', '入职时间', '入职日'] },
  { concept: '部门',      columnKeywords: ['部门', '科室', '组', '团队', '事业部'] },
  { concept: '产品',      columnKeywords: ['产品', '产品名称', '商品', '商品名称', '项目'] },
  { concept: '区域',      columnKeywords: ['区域', '地区', '城市', '省份', '地点', '地址'] },
  { concept: '岗位',      columnKeywords: ['岗位', '职位', '职务', '职称', '角色'] },
]
```

## 条件提取 (`lib/nlu/semantic-parser.ts` `extractParams()`)

支持 13 个正则模式：
```
/大于等于\s*([\d.]+)/, /≥\s*(\d+)/, />=\s*(\d+)/,
/大于\s*([\d.]+)/, />\s*(\d+)/,
/小于等于\s*([\d.]+)/, /≤\s*(\d+)/, /<=\s*(\d+)/,
/小于\s*([\d.]+)/, /<\s*(\d+)/,
/等于\s*(.+?)(?:的|$)/
/包含\s*(.+?)(?:的|$)/
/叫\s*(.+?)(?:$|的|，|,)/
/是\s*(.+?)(?:$|的|，|,)/
/为\s*(.+?)(?:$|的|，|,)/
```

## IF 检测 (`semantic-parser.ts`)

`detectIfCondition()` — 匹配"如果/若 [列] [运算符] [值]，则 [真值]，否则 [假值]"模式。

## Pipeline 分割 (`semantic-parser.ts`)

`CONNECTOR_RE = /(?:再|然后|之后|接着|随后|再按|再根据)/`

## 已知的规则局限性

| 场景 | 问题 | 来源 |
|------|------|------|
| 同义词缺失 | "高于8000"不匹配"大于8000" | extractParams 正则 |
| 多条件连写 | "筛选技术部基本工资>=13000"不识别 | 规则只处理单条件 + predicate |
| targetColumn 过宽 | "新增一列实发工资等于..."提取整句 | extractFormulaTargetColumn |
| 分词错误 | operationWords 包含"产品" | extractTarget |
| 只看→filter | "只看姓名"被映射到 filter 而非 projection | intent-lexicon |

【当前实现】规则系统各自独立维护  
【后续计划】所有规则能力应逐步被 AI 理解替代
