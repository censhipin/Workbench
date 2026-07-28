# DataPilot (Workbench) — 项目完整介绍

> 用这份文档喂给 GPT，它可以完全理解这个项目是什么、怎么实现的、能做什么。

---

## 一、项目概述

| 项目 | 内容 |
|------|------|
| 名称 | DataPilot（内部代号 Workbench） |
| 版本 | v0.3.2 |
| 定位 | 自然语言驱动的桌面端表格数据处理工具 |
| 核心能力 | 用户上传 Excel 文件，用中文自然语言说出需求，软件自动理解并执行操作 |
| 一句话 | 类似"把表格需求用中文说出来就能自动执行"的工具 |

**解决的问题：** 日常工作中大量重复的表格操作（筛选、排序、分组统计、公式计算、数据匹配），不需要记 Excel 函数或写 SQL，直接说中文就行。

**运行方式：**
- 桌面端：Electron 打包的 Windows 安装程序
- Web 端：Vercel 部署的网页版（功能一致，但没有自动更新）

---

## 二、技术栈

| 技术 | 用途 |
|------|------|
| Next.js 16 (App Router) | Web 框架 |
| React 19 + TypeScript + Tailwind CSS | 前端界面 |
| Electron 35 | 桌面壳（把 Web 页包装成桌面应用） |
| electron-builder + NSIS | 打包 Windows 安装程序 |
| electron-updater | 自动更新机制 |
| DeepSeek Chat API | AI 理解自然语言（也支持接入其他 OpenAI 兼容 API） |
| SheetJS / exceljs | Excel 文件解析 |
| recharts | 图表可视化 |
| IndexedDB | 本地数据持久化 |
| Vitest | 单元测试 |

---

## 三、功能列表（用户能做什么）

### 核心操作（12种）

1. **筛选** — 多条件 AND/OR 筛选，支持大于/小于/等于/包含/日期范围等
2. **排序** — 单列或多列升序/降序
3. **分组统计** — SUM/AVG/COUNT/MAX/MIN，支持按列分组
4. **去重** — 按指定列去除重复行
5. **数据匹配** — 类似 Excel VLOOKUP，两张表按列匹配后拼接
6. **合并** — 多张表垂直拼接
7. **数据清洗** — 去除空行、修复异常数据
8. **列操作** — 选择/删除/重命名/排序列
9. **批量更新** — 按条件批量修改列的值
10. **公式计算** — 加减乘除、ROUND、ABS、IF、LEFT/RIGHT/MID/LEN、YEAR/MONTH/DAY/TODAY/DATEDIF、SUMIF/COUNTIF/AVERAGEIF、CONCAT/TRIM/UPPER/LOWER/SUBSTITUTE 等
11. **多步流水线** — 把多个操作串起来依次执行，上一步的结果给下一步
12. **数据透视表** — 行字段+列字段+值字段+聚合方式

### 附加功能

- **文件管理**：上传 .xlsx/.xls/.csv，多 Sheet 切换，多文件管理
- **版本管理**：每次操作都生成一个不可变的版本快照，可回溯、撤销、重置
- **操作历史**：记录所有操作，可还原到任意历史状态
- **数据质量检测**：自动检测空值、重复、异常数据，给出质量评分
- **智能修复**：列名模糊匹配、数据类型自动转换、值标准化
- **结果导出**：处理完的数据可导出为 Excel
- **界面主题**：3 套主题（经典蓝 / 暖阳米白 / 森系灰绿）
- **多模式**：单元格可锁定/编辑，支持数据比对视图
- **调试模式**：显示完整执行链路追踪

---

## 四、架构怎么工作的

软件分三层：

```
你输入中文 → 第一层：理解你说什么（NLU）
                   ↓
              第二层：执行操作（执行引擎）
                   ↓
              第三层：智能优化（数据画像→自动修复→验证→解释）
                   ↓
            你看到结果
```

### 第一层：自然语言理解（NLU）
优先走 AI 路径：把你的中文指令 + 表格的列名和样例数据，一起发给 DeepSeek AI，让它理解你想干什么。
如果 AI 不可用或解析失败，走规则引擎兜底（关键词匹配+语法分析），支持 82 个同义词、18 个概念组。

### 第二层：执行引擎
把理解后的结构化指令编译成执行计划，调度到对应的处理器去执行。
共有 12 种处理器：筛选、排序、分组统计、去重、匹配、合并、清洗、列操作、批量更新、公式计算、流水线、透视表。

### 第三层：智能优化中心
在执行前做数据画像分析（每列的类型分布、空值率、唯一值等），自动修复可能的问题（列名写错了尝试模糊匹配、数据类型不一致自动转换、公式自动修复），执行完后生成详细解释和验证报告。

---

## 五、项目目录结构

```
D:\workbench/
├── app/                          # 前端页面
│   ├── page.tsx                  # 主页面（单页应用，所有状态管理在这里）
│   ├── layout.tsx                # 根布局（主题初始化）
│   ├── globals.css               # 全局样式 + 三套主题 CSS 变量
│   └── api/deepseek/route.ts     # DeepSeek API 代理（转发请求，隐藏密钥）
│
├── components/                   # React 组件
│   ├── layout/                   # 布局组件（5大板块）
│   │   ├── TopBar.tsx            # 顶栏：标题 + 文件信息 + 版本 + 设置按钮
│   │   ├── LeftPanel.tsx         # 左侧：文件列表
│   │   ├── MainPanel.tsx         # 中间主区域：数据表格 + 标签页
│   │   ├── RightPanel.tsx        # 右侧：执行中心 + 版本时间线
│   │   └── BottomBar.tsx         # 底部：输入框 + 提交按钮 + 快捷操作
│   ├── common/                   # 通用组件
│   │   ├── DataTable.tsx         # 数据表格（核心，支持编辑/锁定）
│   │   ├── SettingsDialog.tsx    # 设置面板（API Key / 主题 / Debug / 关于 / 清数据）
│   │   ├── UpdateNotifier.tsx    # 自动更新通知组件（右下角弹窗）
│   │   ├── HelpDialog.tsx        # 帮助弹窗
│   │   └── ...                   # 其他：空状态、徽章、确认弹窗、图表等
│   ├── workspace/                # 工作区组件
│   ├── workbench/                # V3 面板（执行中心、解释、修复、验证等）
│   ├── taskpanel/                # 任务面板（执行计划、数据审计等）
│   ├── version/                  # 版本时间线
│   └── filepool/                 # 文件池
│
├── lib/                          # 核心逻辑（22K 行 TypeScript）
│   ├── types.ts                  # 所有核心类型定义
│   ├── settings.ts               # 设置管理（localStorage 持久化）
│   ├── execution-engine.ts       # 统一执行入口
│   ├── data-engine.ts            # 底层数据操作函数
│   ├── file-engine.ts            # Excel 文件解析
│   ├── db.ts                     # IndexedDB 持久化
│   │
│   ├── nlu/                      # 自然语言理解层
│   │   ├── index.ts              # 统一入口（AI优先，规则兜底）
│   │   ├── deepseek.ts           # DeepSeek API 集成
│   │   ├── semantic-parser.ts    # 规则语义解析器（2100行，中文语法分析引擎）
│   │   ├── intent-lexicon.ts     # 意图词典（82个同义词映射到10种操作）
│   │   └── schema-resolver.ts    # 语义到实际列的映射
│   │
│   ├── v2/                       # 执行引擎（稳定层，不轻易改）
│   │   ├── execution-engine.ts   # 执行调度
│   │   ├── task-compiler.ts      # 指令编译为执行计划
│   │   ├── plan-validator.ts     # 执行计划验证
│   │   ├── predicate.ts          # 条件求值（14种运算符）
│   │   └── executors/            # 12种操作执行器
│   │       ├── FilterExecutor.ts
│   │       ├── SortExecutor.ts
│   │       ├── AggregateExecutor.ts
│   │       ├── FormulaExecutor.ts
│   │       ├── formula-ast/      # 公式 AST 解析器
│   │       └── ...
│   │
│   └── v3/                       # 智能化中心（EIC）
│       ├── profile/              # 数据画像（列统计、类型推断、警告）
│       ├── repair/               # 自动修复（列名模糊匹配、类型转换、公式修复、连接键修复）
│       ├── explain/              # 智能解释生成
│       └── verification/         # 执行结果验证
│
├── electron/                     # Electron 桌面端
│   ├── main.ts                   # 主进程（启动 Next.js 服务、自动更新）
│   └── preload.ts                # 预加载脚本（暴露自动更新 API）
│
├── scripts/                      # 构建辅助脚本
├── docs/                         # 项目文档
└── tests/                        # 测试（747个单测，全部通过）
```

---

## 六、桌面端自动更新机制

```
软件启动 → 自动检查 GitHub Release 有无新版本
     ↓ 有新版本
右下角弹窗提示「有新版本 X.X.X 可用」
     ↓ 用户点击「下载更新」
后台下载（显示进度条）
     ↓ 下载完成
提示「更新已下载完成，立即重启」
     ↓ 用户点击「立即重启」
静默安装 → 自动重启 → 完成升级
```

技术实现：electron-updater 读取 GitHub Release 里的 latest.yml，比对版本号，下载新安装包，静默覆盖安装。

---

## 七、部署方式

- **Web 版**：Vercel 部署（https://workbench-phi-three.vercel.app）
- **桌面版**：npm run package → 生成 NSIS 安装包 → 上传 GitHub Releases
- **仓库**：github.com/censhipin/Workbench

---

## 八、版本历史

| 版本 | 主要更新 |
|------|---------|
| v0.1.0 | 初始版本：基本筛选、排序、分组统计 |
| v0.3.0 | 公式计算、IF 条件、设置面板 |
| v0.3.1 | IF Bug 修复、主题系统（3色）、Google Fonts 移除 |
| v0.3.2 | 设置面板导航式重构、自动更新优化、3个V2 Bug修复、静默安装 |

---

## 九、已知问题

1. 对比视图功能默认关闭（showDiff 硬编码为 false）
2. 有 3 个死代码文件未清理
3. 规则系统没有置信度评分，UI 无法区分 AI 解析和规则解析的结果
