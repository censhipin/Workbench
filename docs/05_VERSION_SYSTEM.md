# Version System

## 作用

每次数据处理操作后，创建一个不可变的数据快照。支持用户查看历史结果、切换基准数据、回退到之前的状态。

## 数据结构

```typescript
interface Version {
  id: string;           // "v-" + Date.now()
  fileId: string;       // 所属的文件
  version: number;      // 自增版本号（从1开始）
  parentVersion?: string; // 父版本ID（支持分支）
  operation: string;    // 执行描述（用户输入原文）
  plan: object;         // 执行计划
  columns: ColumnDef[]; // 数据快照列
  rows: RowData[];      // 数据快照行
  createdAt: string;    // ISO 时间戳
}
```

## 创建流程（page.tsx:200）

```
createVersion(operation, plan, columns, rows, parentId?)
  → { id, fileId, version: max+1, parentVersion, ... }
```

## 操作功能

| 功能 | 函数 | 实现位置 |
|------|------|---------|
| 生成版本 | `createVersion()` | page.tsx:200-214 |
| 切换版本 | `handleSelectVersion(id)` | page.tsx:398-401 |
| 设为基准 | `handleSetCurrentVersion(id)` | page.tsx:403-407 |
| 删除版本 | `handleDeleteVersion(id)` | page.tsx:409-427（级联删除子版本） |
| 撤销 | `handleUndo()` | page.tsx:429-441（只移除最后一个版本，不重新计算） |
| 重置 | `handleReset()` | page.tsx:443-451（清空所有版本回原始数据） |

## 版本回退机制

- `baseVersionId`：下次执行时的基准版本
- `currentVersionId`：当前显示版本
- 当 `baseVersionId` 存在时，`executeIntent()` 用该版本的数据而非 currentSheet 的数据
- 这允许用户在历史版本的快照上继续操作（形成分支）

## 容量限制

最多保留 20 个版本（page.tsx:365）。超过时从头部移除最早的版本。

## VersionTimeline 组件

位于 `components/version/VersionTimeline.tsx`。

展示方式：右侧显示版本卡片列表（按版本号降序排列），每张卡片显示版本号、操作描述、行数×列数。

交互：
- 点击卡片 → 选中该版本
- 右键菜单 → 设为当前 / 完整查看 / 删除（含后续版本确认）
- 全屏查看 → 弹窗显示完整数据表格

## WorkflowTree 组件

位于 `components/workflow/WorkflowTree.tsx`。

【历史设计】期望按 parentVersion 构建树形结构展示版本的分支关系  
【当前实现】在 LeftPanel 下半部分渲染，但始终显示"暂无操作步骤"，因为 versions 在初始加载时为空数组  
【后续计划】决定 WorkflowTree 的去留：是还原为版本树视图，还是完全移除

两者使用相同的数据源（versions 属性），但数据结构不同：
- VersionTimeline：线性的时间轴（按 version 降序）
- WorkflowTree：树形的分支图（按 parentVersion 构建）
