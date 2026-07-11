'use client';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const operations = [
  {
    icon: '⊞',
    label: '筛选',
    examples: ['筛选状态为成功的订单', '筛选金额大于1000的数据', '只看张三的订单', '筛选2024年以后的记录'],
  },
  {
    icon: '↕',
    label: '排序',
    examples: ['按金额从大到小排序', '按日期升序排列', '先按业务员再按金额排序'],
  },
  {
    icon: 'Σ',
    label: '聚合统计',
    examples: ['按业务员统计总金额', '统计每个客户的订单数', '计算金额平均值', '按月份汇总销售额'],
  },
  {
    icon: '⇌',
    label: '匹配合并',
    examples: ['按订单ID匹配回款表数据', '两表按客户名称匹配', '把回款信息匹配到订单表'],
  },
  {
    icon: '⊟',
    label: '去重',
    examples: ['删除重复的订单号', '按客户ID去重', '清除完全重复的行'],
  },
  {
    icon: '📄',
    label: '选择列',
    examples: ['只保留订单ID和金额', '删除备注列', '隐藏不需要的列'],
  },
  {
    icon: '✦',
    label: '数据清洗',
    examples: ['删除空行', '去除空格', '格式化日期列'],
  },
  {
    icon: 'f(x)',
    label: '公式计算',
    examples: ['计算利润=金额-成本', '计算折扣价=原价*0.8', '计算占比=金额/总计'],
  },
];

export default function HelpDialog({ open, onClose }: HelpDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-zinc-200 w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-800">帮助</h2>
            <p className="text-xs text-zinc-400 mt-0.5">DataPilot 使用指南</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          {/* 快速入门 */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">快速入门</h3>
            <ol className="space-y-1.5 text-xs text-zinc-500 ml-4 list-decimal">
              <li>上传 Excel 文件（支持 .xlsx / .xls）</li>
              <li>在左侧文件区选择一个文件作为主表</li>
              <li>在输入框中用自然语言描述你想做的操作</li>
              <li>点击执行按钮，AI 会自动理解并执行</li>
              <li>执行结果会生成版本，可在左侧版本树中切换查看</li>
            </ol>
          </section>

          {/* 支持的操作 */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">支持的操作</h3>
            <div className="grid grid-cols-2 gap-3">
              {operations.map(op => (
                <div key={op.label} className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{op.icon}</span>
                    <span className="text-xs font-semibold text-zinc-700">{op.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {op.examples.map((ex, i) => (
                      <li key={i} className="text-[11px] text-zinc-400 leading-relaxed">
                        <span className="text-zinc-300 mr-1">·</span>
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 提示 */}
          <section className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
            <h3 className="text-xs font-semibold text-blue-700 mb-1.5">💡 使用技巧</h3>
            <ul className="space-y-1 text-[11px] text-blue-600">
              <li>· 多表匹配时，先在左侧把另一个文件/Sheet <strong>加入任务</strong>（点 + 号）</li>
              <li>· 同一 Excel 的不同 Sheet 也可以相互匹配</li>
              <li>· 每次执行会生成新版本，可以随时回退到任意历史版本</li>
              <li>· 数据量较大时（&gt;1万行），建议先筛选再执行其他操作</li>
            </ul>
          </section>

          {/* 关于 */}
          <section className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-600">DataPilot</span>
                <span className="text-[11px] text-zinc-400 ml-2">v1.0</span>
              </div>
              <span className="text-[11px] text-zinc-300">基于 DeepSeek AI · Next.js + Electron</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
