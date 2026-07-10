'use client';

import { Version } from '@/lib/types';

interface WorkflowTreeProps {
  versions: Version[];
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSelectRawData: () => void;
  onOpenHistory: () => void;
}

interface TreeNode {
  version: Version;
  children: TreeNode[];
}

function buildTree(versions: Version[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const v of versions) {
    map.set(v.id, { version: v, children: [] });
  }
  for (const v of versions) {
    const n = map.get(v.id)!;
    if (v.parentVersion && map.has(v.parentVersion)) {
      map.get(v.parentVersion)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

const COLORS = [
  { bar: '#4f6ef7', bg: '#eef1ff', line: '#c7d2fe' },
  { bar: '#16a34a', bg: '#f0fdf4', line: '#bbf7d0' },
  { bar: '#ea580c', bg: '#fff7ed', line: '#fed7aa' },
  { bar: '#7c3aed', bg: '#f5f3ff', line: '#ddd6fe' },
  { bar: '#0891b2', bg: '#ecfeff', line: '#cffafe' },
  { bar: '#db2777', bg: '#fdf2f8', line: '#fbcfe8' },
];

/** ── A single row in the tree (dot + label + card) ── */
function NodeRow({
  label, op, count, isCurrent, color, onClick,
}: {
  label: string; op?: string; count?: number; isCurrent: boolean;
  color: (typeof COLORS)[number]; onClick: () => void;
}) {
  return (
    <div className="flex items-stretch cursor-pointer group min-h-[36px]" onClick={onClick}>
      {/* Left gutter: 20px for the vertical trunk line */}
      <div className="shrink-0 flex flex-col items-center justify-center" style={{ width: 20 }}>
        <svg width={20} height={20} className="block shrink-0">
          <rect x={5} y={2} width={10} height={10} rx={2} fill={isCurrent ? color.bar : '#cbd5e1'} />
        </svg>
      </div>
      {/* Card */}
      <div className="flex-1 min-w-0 py-1 pr-2">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all duration-150"
          style={{
            backgroundColor: isCurrent ? color.bg : '#ffffff',
            borderColor: isCurrent ? color.bar : '#e9ecef',
            borderLeftWidth: isCurrent ? 3 : 1,
            borderLeftColor: isCurrent ? color.bar : '#e9ecef',
          }}
        >
          <span
            className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: color.bar, backgroundColor: isCurrent ? '#ffffff' : '#f5f5f5' }}
          >
            v{label}
          </span>
          {op && <span className="truncate text-gray-700 font-[500]">{op}</span>}
          {count !== undefined && <span className="shrink-0 text-gray-400 text-[10px]">{count}行</span>}
          {isCurrent && (
            <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: color.bar }}>
              当前
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** ── Recursive children with a continuous dashed border-left as the trunk line ── */
function ChildBranch({
  children: nodes, color, currentVersionId, onSelectVersion,
}: {
  children: TreeNode[]; color: (typeof COLORS)[number];
  currentVersionId: string | null; onSelectVersion: (id: string) => void;
}) {
  return (
    <div className="relative pl-[20px]">
      {/* Continuous vertical trunk line — this is THE key fix: border-left on the container */}
      <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-gray-300/80" />

      {nodes.map((node, i) => {
        const last = i === nodes.length - 1;
        const isCurrent = node.version.id === currentVersionId;
        return (
          <div key={node.version.id} className="relative">
            {/* Horizontal connector line + square marker */}
            <div className="absolute left-[-10px] top-[17px] w-[10px] h-0.5 bg-gray-300/80" />
            <NodeRow
              label={node.version.label}
              op={node.version.operation}
              count={node.version.rows.length}
              isCurrent={isCurrent}
              color={color}
              onClick={() => onSelectVersion(node.version.id)}
            />
            {/* Recursive children */}
            {node.children.length > 0 && (
              <ChildBranch
                children={node.children}
                color={color}
                currentVersionId={currentVersionId}
                onSelectVersion={onSelectVersion}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WorkflowTree({
  versions, currentVersionId, onSelectVersion, onSelectRawData, onOpenHistory,
}: WorkflowTreeProps) {
  const tree = buildTree(versions);
  const onRawData = !currentVersionId;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-gray-100">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</span>
      </div>

      <div className="flex-1 overflow-auto px-3 py-3">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <p className="text-xs">暂无操作步骤</p>
            <p className="text-[10px] text-gray-300">输入指令开始处理数据</p>
          </div>
        ) : (
          <div>
            {/* Row: Original data */}
            <div
              className="flex items-center gap-1.5 px-1 py-1.5 rounded-lg cursor-pointer transition-all text-xs"
              onClick={onSelectRawData}
              style={{ backgroundColor: onRawData ? '#f5f5f5' : 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={onRawData ? '#4f6ef7' : '#9ca3af'} strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span className="font-semibold text-gray-700 truncate">原始数据</span>
              {onRawData && <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500 text-white font-semibold">当前</span>}
            </div>

            {/* Branches — root nodes + their children */}
            {tree.map((rootNode, bi) => {
              const color = COLORS[bi % COLORS.length];
              const lastBranch = bi === tree.length - 1;
              return (
                <div key={rootNode.version.id} className="relative">
                  {/* Spacer + trunk line between raw data and root node */}
                  <div className="flex items-stretch" style={{ paddingLeft: 20 }}>
                    {/* Dashed line segment from raw data to root node's square */}
                    <svg width={20} height={18} className="shrink-0 block">
                      <line x1={10} y1={0} x2={10} y2={18} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 2" />
                    </svg>
                    <div className="flex-1" />
                  </div>

                  {/* Root node row */}
                  <NodeRow
                    label={rootNode.version.label}
                    op={rootNode.version.operation}
                    count={rootNode.version.rows.length}
                    isCurrent={rootNode.version.id === currentVersionId}
                    color={color}
                    onClick={() => onSelectVersion(rootNode.version.id)}
                  />

                  {/* Children branch — the continuous dashed line is ChildBranch's border-left */}
                  {rootNode.children.length > 0 && (
                    <ChildBranch
                      children={rootNode.children}
                      color={color}
                      currentVersionId={currentVersionId}
                      onSelectVersion={onSelectVersion}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 shrink-0">
        <button
          onClick={onOpenHistory}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          操作历史
        </button>
      </div>
    </div>
  );
}
