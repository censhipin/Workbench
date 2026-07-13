'use client';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    id: 'quickstart',
    title: '快速入门',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    ),
    content: (
      <ol className="space-y-2 text-sm text-zinc-600 ml-5 list-decimal marker:text-zinc-300 marker:font-medium">
        <li>点击左侧 <span className="font-medium text-zinc-700">+ 上传</span> 上传 Excel 文件（支持 .xlsx / .xls / .csv）</li>
        <li>在文件区选择一个文件作为主表，可在多 Sheet 间切换</li>
        <li>在底部输入框中用<strong>自然语言</strong>描述你想做的操作，或点击快捷操作按钮</li>
        <li>按 Enter 执行，AI 自动理解指令并处理数据</li>
        <li>每次执行生成一个<strong>版本</strong>，可在左侧工作流树中切换查看</li>
      </ol>
    ),
  },
  {
    id: 'operations',
    title: '支持的操作',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    ),
    content: (
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { icon: '⊞', label: '筛选', color: '#4f6ef7', ex: ['筛选部门为技术部的数据', '筛选金额大于1000的订单', '只看张三的记录'] },
          { icon: '↕', label: '排序', color: '#059669', ex: ['按金额从大到小排序', '按日期升序排列', '先按部门再按工资排序'] },
          { icon: 'Σ', label: '聚合统计', color: '#d97706', ex: ['按部门统计总金额', '统计每个客户的订单数', '计算金额平均值'] },
          { icon: '⇌', label: '匹配合并', color: '#7c3aed', ex: ['按订单ID匹配合并两个表', '按姓名匹配员工表和联系方式表'] },
          { icon: '⊟', label: '合并（横向）', color: '#0891b2', ex: ['合并两个表（按行号拼接）', '合并所有月份销售数据'] },
          { icon: '⊟', label: '去重', color: '#dc2626', ex: ['删除重复的订单号', '按客户ID去重', '清除完全重复的行'] },
          { icon: '📄', label: '选择列', color: '#ca8a04', ex: ['只保留订单ID和金额', '删除备注列', '隐藏不需要的列'] },
          { icon: '✦', label: '数据清洗', color: '#059669', ex: ['删除空行', '去除空格', '格式化日期列'] },
          { icon: 'f(x)', label: '公式计算', color: '#2563eb', ex: ['计算利润=金额-成本', '计算折扣价=原价×0.8', '计算占比=金额/总计'] },
          { icon: '⊞', label: '透视表', color: '#9333ea', ex: ['按业务员统计各状态金额', '按月汇总各产品销量'] },
          { icon: '✎', label: '批量更新', color: '#ea580c', ex: ['将金额列全部乘以1.1', '将空值替换为0'] },
          { icon: '📊', label: '图表可视化', color: '#6366f1', ex: ['将结果转为柱状图/折线图', '导出图表为PNG/SVG/PDF/HTML'] },
        ].map(op => (
          <div key={op.label} className="bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100/80 hover:border-zinc-200 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm" style={{ color: op.color }}>{op.icon}</span>
              <span className="text-xs font-semibold text-zinc-700">{op.label}</span>
            </div>
            <ul className="space-y-0.5">
              {op.ex.map((ex, i) => (
                <li key={i} className="text-[11px] text-zinc-400 leading-relaxed truncate">
                  <span className="text-zinc-300 mr-1">·</span>{ex}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'dataview',
    title: '数据预览与编辑',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
    ),
    content: (
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🔒', label: '编辑模式切换', desc: '锁定/编辑模式切换，编辑模式下可修改单元格内容' },
            { icon: '↕', label: '拖拽排序', desc: '拖拽行号或列表头可调整行列顺序' },
            { icon: '➕', label: '新增行列', desc: '点击表头末尾 + 新增列，表格末尾 + 新增行' },
            { icon: '✕', label: '删除行列', desc: '鼠标悬停行号/列表头显示删除按钮' },
            { icon: '📋', label: '粘贴数据', desc: '支持从 Excel 复制粘贴整列数据' },
            { icon: '🔬', label: '数据检测', desc: '检查空值、重复值、异常值，提供修复方案' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2.5 bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100/80">
              <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <div className="text-xs font-medium text-zinc-700 mb-0.5">{item.label}</div>
                <div className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'multitable',
    title: '多表任务',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
    ),
    content: (
      <div className="space-y-3 text-sm text-zinc-600">
        <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
          <p className="text-sm font-medium text-blue-700 mb-1">匹配合并 vs 合并（横向）</p>
          <ul className="space-y-1 text-xs text-blue-600/90">
            <li>· <strong>匹配合并</strong>：按指定列匹配两个表（如按姓名匹配），有条件的合并</li>
            <li>· <strong>合并（横向）</strong>：直接把多个表按行号左右拼在一起，不管是否有相同列</li>
          </ul>
        </div>
        <ul className="space-y-2">
          <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">①</span><span>在左侧文件区，将需要合并/匹配的 Sheet 点击 <span className="inline-flex text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">+ 加入任务</span> 添加</span></li>
          <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">②</span><span>输入合并/匹配指令（如"合并两个表"或"按姓名匹配"）并执行</span></li>
          <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">③</span><span>同一 Excel 的不同 Sheet 也可以相互匹配合并</span></li>
        </ul>
      </div>
    ),
  },
  {
    id: 'charts',
    title: '图表可视化',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    ),
    content: (
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '▇', label: '柱状图', c: '#6366f1' },
            { icon: '━', label: '折线图', c: '#10b981' },
            { icon: '◢', label: '面积图', c: '#f59e0b' },
            { icon: '◯', label: '饼图', c: '#ef4444' },
            { icon: '⬡', label: '雷达图', c: '#8b5cf6' },
            { icon: '✦', label: '散点图', c: '#ec4899' },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-1.5 bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-zinc-100/80">
              <span style={{ color: t.c }} className="text-sm">{t.icon}</span>
              <span className="text-[11px] font-medium text-zinc-600">{t.label}</span>
            </div>
          ))}
        </div>
        <ul className="space-y-1.5 text-xs text-zinc-500">
          <li className="flex items-center gap-2"><span className="text-zinc-300">·</span>选择 X 轴（文本列）和 Y 轴（数值列）绘制图表</li>
          <li className="flex items-center gap-2"><span className="text-zinc-300">·</span>点击色板按钮更换图表主题色，支持 28 色预设 + 自定义取色</li>
          <li className="flex items-center gap-2"><span className="text-zinc-300">·</span>支持渐变色和 Top-N 数据筛选</li>
          <li className="flex items-center gap-2"><span className="text-zinc-300">·</span>点击导出按钮导出为 <strong>交互式 HTML</strong> / <strong>PNG</strong> / <strong>SVG</strong> / <strong>PDF</strong></li>
        </ul>
      </div>
    ),
  },
  {
    id: 'export',
    title: '数据导出',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
    ),
    content: (
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: '📊', label: 'Excel (.xlsx)', desc: '保留样式和格式' },
          { icon: '📄', label: 'CSV (.csv)', desc: '纯文本通用格式' },
          { icon: '📋', label: 'JSON (.json)', desc: '结构化数据格式' },
        ].map(f => (
          <div key={f.label} className="bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100/80">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm">{f.icon}</span>
              <span className="text-xs font-medium text-zinc-700">{f.label}</span>
            </div>
            <div className="text-[11px] text-zinc-400 ml-6">{f.desc}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'tips',
    title: '使用技巧',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    ),
    content: (
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { icon: '↩', title: '撤销操作', desc: '每次执行生成版本，可随时回退到任意历史版本' },
          { icon: '📜', title: '操作历史', desc: '左侧底部"操作历史"可查看所有历史记录并恢复' },
          { icon: '🎨', title: '表格样式', desc: '结果预览支持 14 种表格主题样式一键切换' },
          { icon: '⚡', title: '快捷操作', desc: '底部快捷按钮一键触发求和、排序、筛选等常用操作' },
          { icon: '🔍', title: '数据检测', desc: '输入"检查空值""检测重复"等指令可触发数据质量检测' },
          { icon: '📑', title: '多 Sheet', desc: '单文件含多个 Sheet 时可在顶部标签栏切换' },
        ].map(item => (
          <div key={item.title} className="flex items-start gap-2.5 bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100/80">
            <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
            <div>
              <div className="text-xs font-medium text-zinc-700 mb-0.5">{item.title}</div>
              <div className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

export default function HelpDialog({ open, onClose }: HelpDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[680px] max-w-[92vw] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-50 to-white px-6 pt-5 pb-4 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-800">帮助中心</h2>
                <p className="text-xs text-zinc-400 mt-0.5">DataPilot 全部功能指南</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scroll-smooth">
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500">
                  {section.icon}
                </div>
                <h3 className="text-sm font-semibold text-zinc-700">{section.title}</h3>
              </div>
              <div className="pl-0">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="font-medium text-zinc-500">DataPilot</span>
            <span>v0.3.0</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span>基于 DeepSeek AI · Next.js</span>
          </div>
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:shadow-sm transition-all">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
