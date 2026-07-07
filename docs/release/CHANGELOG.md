# CHANGELOG — 表格数据工作台 v1.0

> 发布日期：2026-07-07

---

## v1.0 (2026-07-07) — Production Release

### Phase 11 — Stability & Release Preparation (最终发布)

**性能修复：**

- 🔧 **fuzzyFind Set 重建问题** — `matchTwo` 中每行重建 `fuzzyCandidates` Set 改为循环外预计算，O(N²) → O(N)（PR: #1）
- 🔧 **JSON.parse/stringify 深拷贝** — 7 处统一替换为 `structuredClone`，30000 行克隆 ~140ms（PR: #2）

**Bug 修复（5 项关键数据正确性）：**

| Bug | 修复内容 | 影响 |
|-----|---------|------|
| Match Left Join = Full Outer Join | 删除 `matchTwo/matchTwoMulti` 中追加未匹配右表行的逻辑 | Left Join 语义正确 |
| Aggregate 空分组返回 0 | AVG/MAX/MIN 空数据返回 `null` | 语义正确 |
| Formula 静默置 null | 解析失败改抛 `AppError`，进入 Explain 层 | 错误可见 |
| Mock 数据污染生产 | 有已保存文件时不合并 `mockFiles` | 生产环境干净 |
| V3 Verification 未接入 | `execution-engine.ts` 调用 `verifyExecution` | 双重验证生效 |

**真实数据测试：**

- 建立真实 Excel 数据测试体系（`lib/__tests__/real-data-test.test.ts`）
- 覆盖 3010 / 5000 / 30000 行数据
- 12 个测试全部通过

**性能基准测试：**

- 3000 / 10000 / 30000 行三级基准
- Filter / Formula / Aggregate / Pipeline 覆盖
- 16 个测试全部通过

**发布文档：**

- [Release Whitepaper](docs/release/WHITEPAPER.md)
- [User Guide](docs/release/USER_GUIDE.md)
- [Real Data Test Report](docs/v3/REAL_DATA_TEST_REPORT.md)
- [Performance Test Report](docs/v3/PERFORMANCE_TEST_REPORT.md)

**最终验收状态：**

```
 ✓ TypeScript 0 error
 ✓ Build success
 ✓ ESLint success
 ✓ Tests 747/747 pass
```

---

### Phase 10 — Production Ready

**测试补全：**

- T7 Merge Bug 修复（测试只传 1 个表，改为传 2+ 个表）
- Verification 测试从 108 扩充到 120
- UI 组件测试从 73 扩充到 80

**代码重构：**

- page.tsx 瘦身：935 行 → ~550 行
- 5 个 Controller 抽取完成（Execution / Version / History / Export / Dialog）
- 统一 Logger（`lib/v3/utils/logger.ts`）
- 统一 Config Center（`lib/v3/config/index.ts`）
- 统一 ErrorCode 系统（`lib/v3/error-codes.ts`）
- Performance Tracker（`lib/v3/utils/perf.ts`）

**UI 接入：**

- ExecutionCenter / ExplanationPanel / VerificationPanel / PerformanceMonitor
- 4 个 Workbench 面板组件真实接入 page.tsx

**文档：**

- 7 份文档完成：FINAL_ARCHITECTURE / MODULE_GUIDE / API_REFERENCE / DEVELOPER_GUIDE / CHANGELOG / TEST_REPORT / PERFORMANCE_REPORT / FINAL_AUDIT_REPORT / FINAL_REVIEW

---

### Phase 9 — UX & Workbench

**Workbench 组件（10 个面板）：**

- ExecutionCenter — 执行控制中枢
- ExplanationPanel — 智能解释展示
- RepairPanel — 修复记录展示
- VerificationPanel — 验证报告展示
- DataProfilePanel — 数据画像展示
- QualityPanel — 质量监控展示
- ErrorDialogV3 — 新错误弹窗
- PerformanceMonitor — 性能监控面板
- WorkbenchPanel — 容器面板
- ResultSummaryPanel — 结果摘要

**UI 测试：**

- 73+ UI 组件测试，覆盖全部 10 个面板
- Rendering / State / Interaction 三类

**特性：**

- 智能解释面板（ExecutionExplanation 结构化渲染）
- 验证结果逐项展示
- 修复记录清单
- 性能数据实时监控
- 错误弹窗（V3 新版）

---

### Phase 8 — Verification & Quality

**9 个专用 Verifier：**

- FilterVerifier — 筛选条件验证
- AggregateVerifier — 聚合值重算验证
- MatchVerifier — 匹配键验证 + 行数验证
- FormulaVerifier — 公式列存在性验证
- ProjectionVerifier — 投影列完整性验证
- UpdateVerifier — 更新范围和值验证
- DedupVerifier — 去重结果验证
- CleanVerifier — 清理数据验证
- PipelineVerifier — 流水线各步输出验证

**公用模块：**

- Statistics — 统计引擎（均值/中位数/标准差/分位数/分布）
- Diff — 差异计算引擎（行级/列级/统计级差异）
- ReportBuilder — 结构化报告生成

**测试：** 108 个 Verification 测试全部通过

---

### Phase 7 — Core Executor 重构

**Formula AST 解析器：**

- 完整表达式解析（四则运算/括号/优先级）
- 支持中文列名引用
- 错误定位（括号不匹配/列名未找到）

**其他重构：**

- GroupBy 语义重构（`lib/v2/executors/AggregateExecutor.ts`）
- Left Join 降级处理（静默降级保留左表）
- NullDefinition 统一空值处理

---

### Phase 6 — Explain 智能解释层

**11 个解释模块：**

- ExecutionExplanation — 顶层结构
- Summary — 操作汇总
- Warning — 警告提取
- Suggestion — 建议生成
- RepairSummary — 修复摘要
- ProfileSummary — 画像摘要
- ExecutionSummary — 执行摘要
- VerificationSummary — 验证摘要
- ErrorSummary — 错误摘要
- Builder — 构建器
- Types — 类型定义

---

### Phase 5 — Repair 接入执行主链

- Repair 成为 EIC 强制必经路径
- 89 个 Repair 测试
- `lib/execution-engine.ts` 集成 repairPlan 调用

---

### Phase 4 — EIC Repair 修复层

**8 个修复模块：**

- ColumnRepair — 列名引用修复
- ValueRepair — 值规范化修复
- TypeRepair — 类型推断/修复
- JoinRepair — Join 键映射修复
- FormulaRepair — 公式解析修复
- NullRepair — 空值修复
- RepairEngine — 修复编排器
- RepairReport — 修复报告

---

### Phase 3 — DataProfile 扩展

- `plan-validator` 感知数据画像
- Profile-driven 验证策略

---

### Phase 2 — EIC Profile

- `lib/v3/profile/` 建立
- DataProfile / ColumnProfile / Statistics

---

### Phase 1 — 架构规划

- 10 份设计文档
- V3 六层模型定义
- EIC (Execution Intelligence Center) 概念设计

---

## 前序版本（V2 阶段）

### Phase 0 — 项目初始化

- Next.js 16 极速初始化
- Electron 35 集成（开发 + 打包）
- Tailwind CSS v4
- 基础布局框架

### V2 核心开发 (Phase 1-8)

- Phase 1：DataEngine 基础层 + Operator + Predicate
- Phase 2：TaskCompiler + 11 种 ExecutionPlan
- Phase 3：V2 Execution Engine (runExecutionPlan)
- Phase 4：真实链路接入（parseIntentWithAI → compile → v2plan）
- Phase 5：11 个 Executor 重构为插件化
- Phase 6：OutputProcessor 统一输出约束
- Phase 7：V2 Verifier 11 个专用验证器
- Phase 8：前端 UI 重构（5 栏布局）

---

## 版本规范

```
v{major}.{minor}.{patch} (YYYY-MM-DD)

major: 架构级变更
minor: 功能级变更
patch: Bug 修复
```

当前版本 `v1.0.0` — 首次生产发布。
