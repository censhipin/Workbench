# V3 API Reference

## Controllers

### `useExecutionController`
```ts
useExecutionController(
  onError, onExplanation, onVersionCreated, onHistoryAdded,
  activeDataset, selectedFile, activeSheet, taskFileIds, files, promptText,
  setApiKeyMode, setShowApiKeyDialog,
) => {
  isRunning, executionSteps, error, currentExplanation,
  ambiguityReport, planPreview, resolvedIntent,
  handleSubmit, executeIntent, handleConfirmAmbiguity,
  handleCancelAmbiguity, handleModifyPrompt,
}
```
- `handleSubmit()`: 提交 AI 解析 → 执行全流程
- `executeIntent(intent, mainFile, sheetName, taskFileIds?)`: 直接执行意图

### `useVersionController`
```ts
useVersionController(selectedFileId: string | null) => {
  versions, currentVersion, currentVersionId, activeTab, hasVersions,
  resultKey, beforeDataRef,
  createVersion, addVersion,
  handleSelectVersion, handleSetCurrentVersion, handleDeleteVersion,
  handleUndo, handleReset, restoreVersion,
}
```
- `createVersion(operation, plan, columns, rows, parentId?)`: 创建版本对象
- `addVersion(newVersion, beforeData?)`: 添加版本并切换显示

### `useHistoryController`
```ts
useHistoryController(onHistoryRestore) => {
  historyItems, showHistory,
  setShowHistory, addHistoryItem, setHistoryItemsBulk, handleHistoryClick,
}
```

### `useExportController`
```ts
useExportController() => { handleExport }
```

### `useDialogController`
```ts
useDialogController() => {
  showAudit, setShowAudit, showApiKeyDialog, setShowApiKeyDialog,
  apiKeyMode, setApiKeyMode, errorDialog, setErrorDialog,
  debugMode, setDebugMode, dismissError,
}
```

## Profile (lib/v3/profile)

### `profiler.ts`
- `generateProfile(columns, rows): DataProfile`
  - 列类型推断、唯一值统计、空值率等

### `types.ts`
- `DataProfile`: 完整数据画像类型
- `ColumnProfile`: 单列画像（min/max/avg/nullRate/uniqueRate）

## Repair (lib/v3/repair)

### `repair-engine.ts`
- `repairPlan(plan, profile, ctx): RepairResult`
  - 自动修复计划中的错误配置
  - 返回修复记录和置信度

### `column-repair.ts`
- `repairColumnReference(plan, columns): RepairRecord[]`
  - 列名模糊匹配修复

### `value-repair.ts`
- `repairValueNormalization(plan, rows, columns): RepairRecord[]`
  - 值规范化修复

### `type-repair.ts`
- `repairTypeMismatch(plan, columns): RepairRecord[]`
  - 类型转换修复

### `join-repair.ts`
- `repairJoinKey(plan, columns): RepairRecord[]`
  - Join 键映射修复

### `formula-repair.ts`
- `repairFormula(plan): RepairRecord[]`
  - 公式表达式修复

### `null-repair.ts`
- `repairNullHandling(plan): RepairRecord[]`
  - 空值处理修复

## Explain (lib/v3/explain)

### `builder.ts`
- `buildExplanation(result, plan, profile, repairReport): ExecutionExplanation`

### `types.ts`
- `ExecutionExplanation`: { title, summary, detail, warnings, suggestions, autoFixSummary }

### Specialized Summaries
| Module | Function | Output |
|--------|----------|--------|
| summary.ts | buildSummary | 执行摘要 |
| warning.ts | buildWarnings | 警告列表 |
| suggestion.ts | buildSuggestions | 建议列表 |
| repair-summary.ts | buildRepairSummary | 修复摘要 |
| profile-summary.ts | buildProfileSummary | 数据画像信息 |
| execution-summary.ts | buildExecutionSummary | 执行过程摘要 |
| verification-summary.ts | buildVerificationSummary | 验证结果摘要 |
| error-summary.ts | buildErrorSummary | 错误信息摘要 |

## Verification (lib/v3/verification)

### `verification-engine.ts`
- `verifyExecution(plan, inputCols, inputRows, outputCols, outputRows): VerificationResult`
- `registerAllVerifiers()`: 注册所有 9 个 Verifier

### Verifiers
| Verifier | Type | Checks |
|----------|------|--------|
| FilterVerifier | filter | 条件满足、空结果、全部删除、类型检查 |
| AggregateVerifier | aggregate | Schema、分组数量、重算验证 |
| MatchVerifier | match | 匹配率、未匹配、追加行 |
| FormulaVerifier | formula | 目标列、数值类型、空值、源列 |
| ProjectionVerifier | projection | 包含列、排除列、重命名、列序 |
| UpdateVerifier | update | 行数、更新值、条件更新 |
| DedupVerifier | dedup | 重复检查、去重统计 |
| CleanVerifier | clean | 空值减少、列数、清洗质量 |
| PipelineVerifier | pipeline | 步骤计数、空输出 |

### `statistics.ts`
- `computeTableStats(rows, cols): TableStats`
- `computeGroupKeys(rows, groupByCols): Set<string>`
- `computeMatchStats(left, right, matchCols, output): MatchStats`

### `diff.ts`
- `computeDiff(inputCols, inputRows, outputCols, outputRows): DiffResult`

### `report-builder.ts`
- `buildVerificationReport(result, operationLabel): VerificationReport`

## Config (lib/v3/config)
```ts
config.feature     // Feature flags
config.limit       // Limits (maxVersions, maxRows, etc.)
config.threshold   // Thresholds (confidence, nullRate, etc.)
config.performance // Performance settings
config.api         // API settings (timeout, retry)
config.ui          // UI settings
```

## Error Codes (lib/v3/error-codes)
```ts
AppError            // Structured error class
ErrorCodes          // Error code definitions
ErrorCategory       // VALIDATION | EXECUTION | COMPILATION | AI | FILE | CONFIG | UNKNOWN
ErrorSeverity       // INFO | WARNING | ERROR | FATAL
```

## Utils

### `logger.ts`
```ts
logger.info(...args)   // [timestamp][INFO]
logger.warn(...args)   // [timestamp][WARN]
logger.error(...args)  // [timestamp][ERROR]
logger.debug(...args)  // [timestamp][DEBUG]
logger.setLevel(level) // 'debug' | 'info' | 'warn' | 'error'
```

### `perf.ts`
```ts
perfTracker.mark(name)           // Mark start time
perfTracker.measure(stage, label, markName)  // Record duration
perfTracker.addRecord(stage, label, durationMs)
perfTracker.getRecords()         // Get all records
perfTracker.getTotal()           // Total duration
perfTracker.getStageSummary()    // Grouped by stage
perfTracker.generateReport()     // Full performance report
perfTracker.reset()              // Reset all records
```
