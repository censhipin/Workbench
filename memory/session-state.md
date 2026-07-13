---
name: session-state
description: 本轮修复 select/remove/rename 映射缺失、clean 假阳性修复提示、新增检测弹窗
metadata:
  type: project
---

# 会话状态

**保存时间**: 2026-07-09 10:30
**最新提交**: `602648f` — feat: 扩大检测弹窗触发范围，覆盖自然语言表达
**部署域名**: [workbench-phi-three.vercel.app](https://workbench-phi-three.vercel.app)

## 本轮改动（全部已推送+部署）

1. **fix: DeepSeek select 操作列映射缺失** — mapAction 补 case 'select'、skipResolve 加 select、plan.columns 映射 params.targets
2. **fix: 删除列识别为数据筛选** — remove 操作全链路映射（8 处），包括 detectDeletion（排除"删除重复"）、parseStandardIntent、rule-taskplan-converter、types.ts
3. **fix: 重命名列识别为列选择** — rename 操作全链路映射（8 处），detectRename、parseStandardIntent、rule-taskplan-converter
4. **fix: rename 验证器查 key 而非 title** — ProjectionVerifier 改为查 key=oldKey + title=newName
5. **fix: clean 操作空值修复假阳性** — repairNullHandling 对 clean 的 category 从 auto 改为 suggest，不再误导用户
6. **feat: 检测检查类指令→数据检测弹窗** — 全在 page.tsx 一个文件实现，不碰执行链。弹窗引导→点击"去检测"→进入 DataAudit

## 检测弹窗触发范围

AUDIT_TRIGGERS 覆盖：
- 动作词开头：检查/检测/审阅/查看/找/看/查一查/查一下/看看
- 空值相关：空值/缺失/缺少/空白/没填
- 格式相关：格式/手机号/身份证/邮箱/邮件/电话/日期/金额
- 问题相关：重复/异常/错误/不对/有误/有问题/无效
- 质量相关：质量/质量检查/数据质量/完整性/规范性

## 已知问题

- `v2-fallback-integration.test.ts` aggregate 测试预先存在失败（inline aggregate 逻辑移除了但测试没更新）
- 检测弹窗只做引导弹窗→跳转 DataAudit，不执行任何数据修改
- 手机号格式校验等检测能力依赖现有的 DataAudit/audit-engine.ts，未做增强

## 待办

- 用户提到后续需要实现手机号格式自动修复功能（本次只做了检测入口）
- clean 操作下的空值修复建议只在右侧面板显示，无独立弹窗交互
