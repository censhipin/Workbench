# V3 Developer Guide

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 类型检查
npx tsc --noEmit

# 构建
pnpm build
```

## 架构原则

### 1. V2 不变性原则
`lib/v2/` 目录是旧版稳定层，V3 开发中原则上不修改 V2 文件。如需修改：
- 优先在 `lib/v3/` 中扩展
- 仅在修复 Bug 时才 touch V2

### 2. 模块化原则
- Controllers 负责状态和流程
- Components 只负责渲染
- Utils 保持纯函数

### 3. 测试优先
- Verification 测试 ≥ 120
- UI 测试 ≥ 80
- 每个新功能必须有测试覆盖

### 4. 配置外置
- 所有 Magic Number 放到 `lib/v3/config/index.ts`
- 禁止硬编码阈值

### 5. 日志规范
- 禁止 `console.log` / `console.error`
- 统一使用 `logger.info` / `logger.warn` / `logger.error` / `logger.debug`

## 代码规范

### 命名
- 文件名：kebab-case（`column-repair.ts`）
- 类名：PascalCase（`FilterVerifier`）
- 函数名：camelCase（`computeTableStats`）
- 类型/接口：PascalCase（`ExecutionPlan`）

### Import 顺序
1. React / 框架
2. 内部类型
3. 业务模块
4. （空行）
5. CSS

### Error 处理
```ts
// ❌ 禁止
throw new Error('xxx');

// ✅ 正确
import { AppError, ErrorCodes } from '@/lib/v3/error-codes';
throw new AppError(ErrorCodes.VAL_MISSING_COLUMN);
```

### Logger 使用
```ts
import { logger } from '@/lib/v3/utils/logger';

logger.info('修复完成', count);
logger.warn('阈值超限', rate);
logger.error('执行失败', error);
logger.debug('详细调试', detail);
```

## 关键流程

### 执行流程
```
① 用户输入 → ② parseIntentWithAI → ③ 规则解析 fallback
→ ④ AmbiguityDetector → ⑤ executeIntent → ⑥ compile
→ ⑦ PlanValidator → ⑧ Profile → ⑨ Repair → ⑩ 执行
→ ⑪ Verification (9 verifiers) → ⑫ Explain Builder
→ ⑬ UI 展示
```

### 添加断面
1. 注册到 `lib/v2/plan-validator.ts`
2. 创建 `lib/v3/verification/*-verifier.ts`
3. 注册到 `verification-engine.ts`
4. 在 Explain 中添加处理
5. 添加测试

## Config 指南

所有可配置项见 `lib/v3/config/index.ts`：

```ts
config.limit.maxVersions        // 20
config.threshold.nullRateWarning // 0.2 (20%)
config.api.minKeyLength          // 10
config.ui.sidebarWidthDefault    // 280
```
