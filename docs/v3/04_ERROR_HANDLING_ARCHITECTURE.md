# 结构化错误系统设计

## 1. 当前状态

V2 的错误处理存在以下问题：

| 问题 | 示例 | 后果 |
|------|------|------|
| 原始字符串 | `"计划校验失败: 找不到列"杭州"` | UI 无法区分错误类型 |
| 无结构 | `buildErrorMessage()` 返回 `string` | 无法编程处理 |
| 无建议 | 仅告知失败，不告知如何解决 | 用户困惑 |
| 无修复信号 | 不标识是否能自动修复 | EIC 无法决策 |
| 无分类 | 所有错误混在一起 | 无法区分严重级别 |
| 模式替换补丁 | `replace(/找不到列/, '数据表中没有找到列')` | 脆弱、不可维护 |

## 2. 结构化错误设计

### 2.1 ErrorRecord

```typescript
interface ErrorRecord {
  code: string;                    // 机器可读的错误码
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;                 // 人类可读的消息
  category: ErrorCategory;         // 错误分类
  reason: string;                  // 为什么发生
  suggestion: string;              // 用户可以做什么
  autoFixAvailable: boolean;       // EIC 能否自动修复？
  autoFixConfidence: number;       // 0-1 置信度
  source: string;                  // 哪个模块产生
}
```

### 2.2 ErrorCategory

```typescript
enum ErrorCategory {
  COLUMN_NOT_FOUND,    // 列引用无法解析
  TYPE_MISMATCH,       // 值类型与列类型不匹配
  VALUE_NOT_FOUND,     // 条件值在数据中不存在
  OPERATOR_INVALID,    // 非法操作符
  PLAN_STRUCTURE,      // 计划结构错误
  EXECUTION_FAILURE,   // 运行时执行失败
  VERIFICATION_FAILURE,// 结果验证失败
  DATA_QUALITY,        // 数据质量问题
  AMBIGUITY,           // 歧义
  LIMIT_EXCEEDED,      // 资源限制
}
```

## 3. 错误码注册表

### 3.1 列相关错误

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| COL-001 | COLUMN_NOT_FOUND | 找不到列"{hint}" | 您是否想使用"{candidate}"？ | ✅（模糊匹配） |
| COL-002 | COLUMN_NOT_FOUND | 列"{key}"在数据表中不存在 | 请检查列名拼写 | ❌ |
| COL-003 | VALUE_NOT_FOUND | 在列"{col}"中找不到值"{value}" | 该值可能不存在，请确认 | ❌ |

### 3.2 类型错误

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| TYP-001 | TYPE_MISMATCH | "{col}"是文本列，不能执行{op}操作 | 请选择数值列，候选：{candidates} | ❌ |
| TYP-002 | TYPE_MISMATCH | 列"{col}"包含{n}个非数值行，已跳过 | 建议检查数据 | ✅（自动跳过） |
| TYP-003 | TYPE_MISMATCH | 日期列"{col}"包含{n}行无法解析 | 建议使用YYYY-MM-DD格式 | ✅（自动转换） |

### 3.3 操作错误

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| OPR-001 | OPERATOR_INVALID | 操作符"{op}"不适用于{type}类型列 | 请使用适用于{type}的操作符 | ❌ |
| OPR-002 | OPERATOR_INVALID | 聚合方法"{method}"不适用于该列 | 可用的聚合方法：{candidates} | ❌ |

### 3.4 执行错误

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| EXE-001 | EXECUTION_FAILURE | V2 执行出错：{detail} | 请检查参数是否正确 | ❌ |
| EXE-002 | EXECUTION_FAILURE | 不支持的 V2 操作："{type}" | 请使用支持的操作类型 | ❌ |

### 3.5 验证错误

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| VRF-001 | VERIFICATION_FAILURE | {n}/{m} 行不满足筛选条件 | 请检查筛选条件是否合理 | ❌ |
| VRF-002 | VERIFICATION_FAILURE | 去重将产生{n}/{m}行变更 | 去重不可逆，请确认 | ❌ |

### 3.6 数据质量

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| QLT-001 | DATA_QUALITY | 列"{col}"空值率{rate}% | 建议清洗后再操作 | ❌ |
| QLT-002 | DATA_QUALITY | 数据质量评分{score}/100 | 建议先运行数据审计 | ❌ |

### 3.7 歧义

| 错误码 | 类别 | 消息 | 建议 | 自动修复 |
|--------|------|------|------|---------|
| AMB-001 | AMBIGUITY | "{hint}"可匹配多列：{candidates} | 请明确指定列名 | ❌ |
| AMB-002 | AMBIGUITY | 操作"{op}"有歧义 | 请用更明确的描述 | ❌ |

## 4. 集成点

| 位置 | 当前 | 未来 |
|------|------|------|
| buildErrorMessage | 返回 string | 返回 ErrorRecord[] |
| plan-validator issues | ValidationIssue { severity, field, message, code } | 可升级为 ErrorRecord |
| verifier checks | VerificationCheck { name, passed, detail } | 可包含 ErrorRecord |
| PlanStepBuilder subItems | { label, value } string | 可包含结构化 ErrorRecord |
| runExecutionEngine error | string | 可扩展 ErrorRecord[] |
| EIC validate 输出 | - | ErrorRecord[]（新建） |

## 5. 迁移路径

| Phase | 变更 |
|-------|------|
| 1（当前） | 定义 ErrorRecord 类型和错误码注册表（本文档） |
| 2 | 在 lib/v3/types.ts 中实现 ErrorRecord 接口 |
| 3 | EIC validate 输出 ErrorRecord[]（新代码，不碰 V2） |
| 4 | EIC explain 消费 ErrorRecord[]（新代码，不碰 V2） |
| 5 | V2 buildErrorMessage 逐步迁移为 ErrorRecord（可选增强） |
| 6 | 移除原始字符串 fallback（仅当 V2 调用者全部迁移后） |
