# Data Workbench — 项目概述

## 定位

表格数据工作台（Table Data Workbench）是一个基于 AI 自然语言处理的本地数据处理桌面工具。用户上传 Excel 文件后，用中文自然语言指令完成数据操作，无需书写公式或编写代码。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | 页面路由 + API 路由代理 |
| 前端 | React 19 + TypeScript | 组件化 SPA |
| 样式 | Tailwind CSS v4 | 工具类 CSS |
| 桌面壳 | Electron 35 | 桌面窗口 |
| 打包 | electron-builder 26 | NSIS 安装包 |
| 文件解析 | xlsx (SheetJS) | Excel 读写 |
| AI 接口 | DeepSeek Chat API | 自然语言 → 结构化指令 |
| 本地存储 | IndexedDB | 文件缓存、历史持久化 |
| 测试 | Vitest v4 | 333 个单元测试（通过） |

## 项目形态

- 开发模式：`npm run dev` → http://localhost:3000
- 桌面构建：`npm run package` → NSIS 安装包
- 纯前端应用，无后端服务器，所有数据在浏览器/Electron 中处理

## 设计原则

1. **AI First** — 自然语言理解优先走 AI，规则解析作为降级方案
2. **本地计算** — 所有数据处理在客户端完成
3. **版本化** — 每次操作生成不可变数据版本，支持回溯和分支
4. **插件化执行器** — 新增操作类型只需注册 Executor，不改执行引擎
