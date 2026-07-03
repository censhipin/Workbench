# TODO

## 紧急（影响主流程）

- [ ] `semantic-parser.ts` extractParams 增加 `/高于/`、`/超过/` 等同义词正则
- [ ] 确认 "只看/只保留" 的语义归属（当前 filter vs 实际 select/projection）

## 高优先级

- [ ] 恢复 `showDiff` — page.tsx:665 移除硬编码 `false`
- [ ] 修复 `operationWords` 中包含"产品"导致列名被过滤的问题
- [ ] 决定 WorkflowTree 去留（移除还是恢复功能）
- [ ] 清理死代码文件（AIInput.tsx, Workspace.tsx, taskpanel/OperationHistory.tsx）

## 中优先级

- [ ] 考虑 AI 降级方案（用本地小模型替代规则解析）
- [ ] 规则解析结果增加置信度标记
- [ ] BottomBar 恢复 promptExamples 提示列表
- [ ] 旧引擎 ExecutionEngine.execute() 是否可完全废弃

## 低优先级

- [ ] IndexedDB 版本升级时数据迁移
- [ ] Electron 窗口尺寸持久化
- [ ] 文件导入支持更多格式
- [ ] 批量文件处理
