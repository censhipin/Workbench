## V3 Changelog

### Phase 10 — Production Ready (2026-07-07)
- ✅ T7 Merge Bug 修复（测试只传 1 个表 → 实际传 2+ 个表）
- ✅ 测试覆盖补齐（Verification 108→120 / UI 73→80）
- ✅ Workbench 组件真实接入 page.tsx（ExecutionCenter/ExplanationPanel/VerificationPanel/PerformanceMonitor）
- ✅ page.tsx 瘦身（935 行 → 约 550 行）
- ✅ 5 个 Controller 抽取（Execution/Version/History/Export/Dialog）
- ✅ 统一 Logger（lib/v3/utils/logger.ts）
- ✅ 统一 Config Center（lib/v3/config/index.ts）
- ✅ 统一 ErrorCode 系统（lib/v3/error-codes.ts）
- ✅ Performance Tracker（lib/v3/utils/perf.ts）
- ✅ 文档生成（7 份文档）

### Phase 9 — UX & Workbench (2026-07-01)
- 10 个工作台面板组件完成
- 73+ UI 测试完成
- 嵌入 RightPanel

### Phase 8 — Verification & Quality
- 9 个专用 Verifier
- Statistics / Diff / Report Builder
- 108 个验证测试

### Phase 7 — Core Executor 重构
- Formula AST 解析器
- GroupBy 语义重构
- Left Join 降级
- NullDefinition 统一

### Phase 6 — Explain 智能解释层
- 11 个解释模块
- ExecutionExplanation 结构化输出

### Phase 5 — Repair 接入执行主链
- Repair 成为强制必经路径
- 89 个 Repair 测试

### Phase 4 — EIC Repair 修复层
- 8 个修复模块
- 自动修复 + 建议修复

### Phase 3 — DataProfile 扩展
- plan-validator 感知数据画像

### Phase 2 — EIC Profile
- lib/v3/profile/ 建立

### Phase 1 — 架构规划
- 10 份设计文档
