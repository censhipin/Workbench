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

const PALETTE = [
  { accent: '#4f6ef7', bg: '#eef1ff', line: '#c7d2fe' },
  { accent: '#059669', bg: '#ecfdf5', line: '#a7f3d0' },
  { accent: '#d97706', bg: '#fffbeb', line: '#fde68a' },
  { accent: '#7c3aed', bg: '#f5f3ff', line: '#ddd6fe' },
  { accent: '#0891b2', bg: '#ecfeff', line: '#cffafe' },
  { accent: '#db2777', bg: '#fdf2f8', line: '#fbcfe8' },
];

/** Recursive node: each level adds 28px left padding + left border */
function TreeNodeItem({
  node, color, isLastChild, currentVersionId, onSelectVersion, depth,
}: {
  node: TreeNode;
  color: (typeof PALETTE)[number];
  isLastChild: boolean;
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  depth: number;
}) {
  const isCurrent = node.version.id === currentVersionId;
  const meLast = isLastChild;
  const hasChildren = node.children.length > 0;
  // Vertical line within this row
  const vWidth = 1;
  const vColor = '#d5d5d5';

  return (
    <div>
      {/* ── Row ── */}
      <div
        className="flex items-center cursor-pointer group relative text-xs"
        onClick={() => onSelectVersion(node.version.id)}
        style={{ minHeight: 34 }}
      >
        {/* Gutter with tree lines */}
        <div className="shrink-0 self-stretch flex relative" style={{ width: depth === 0 ? 14 : 28 }}>
          {/* Vertical continuation from parent */}
          {depth > 0 && (
            <div
              className="absolute left-[14px] top-0 bottom-0"
              style={{ width: vWidth, backgroundColor: vColor }}
            />
          )}
          {/* Horizontal connector to this node */}
          {depth > 0 && (
            <div
              className="absolute"
              style={{
                left: 14,
                top: '50%',
                width: 14,
                height: vWidth,
                backgroundColor: vColor,
              }}
            />
          )}
          {/* Vertical downward continuation (if has children or not last child) */}
          {(hasChildren || !meLast) && (
            <div
              className="absolute left-[14px]"
              style={{
                width: vWidth,
                backgroundColor: vColor,
                top: '50%',
                bottom: 0,
              }}
            />
          )}
        </div>

        {/* Dot */}
        {depth === 0 && (
          <div className="shrink-0 flex items-center justify-center" style={{ width: 14 }}>
            <svg width="10" height="10">
              <circle cx="5" cy="5" r="4.5" fill={isCurrent ? color.accent : '#d1d5db'} stroke="white" strokeWidth="1" />
            </svg>
          </div>
        )}

        {/* Card */}
        <div className="flex-1 min-w-0 flex items-center py-0.5 pr-2">
          <div
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg border transition-all duration-150"
            style={{
              backgroundColor: isCurrent ? color.bg : 'white',
              borderColor: isCurrent ? color.accent : '#ececed',
              borderLeftWidth: isCurrent ? 3 : 1,
            }}
          >
            <span
              className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: color.accent, backgroundColor: isCurrent ? 'white' : '#f5f5f5' }}
            >
              v{node.version.label}
            </span>
            <span className="truncate text-gray-700 font-[500]">{node.version.operation}</span>
            <span className="shrink-0 text-gray-400 text-[10px]">{node.version.rows.length}行</span>
            {isCurrent && (
              <span
                className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: color.accent }}
              >
                当前
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Children ── */}
      {hasChildren && (
        <div>
          {node.children.map((child, i) => {
            const lastChild = i === node.children.length - 1;
            return (
              <div key={child.version.id} className="relative">
                {/* Left border for the entire child subtree */}
                {!lastChild && (
                  <div
                    className="absolute left-[14px] top-0 bottom-0"
                    style={{ width: vWidth, backgroundColor: vColor }}
                  />
                )}
                <TreeNodeItem
                  node={child}
                  color={color}
                  isLastChild={lastChild}
                  currentVersionId={currentVersionId}
                  onSelectVersion={onSelectVersion}
                  depth={depth + 1}
                />
              </div>
            );
          })}
        </div>
      )}
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

      {/* Tree */}
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
            {/* Raw data row */}
            <div
              className="flex items-center gap-1.5 py-1.5 px-1 rounded-lg cursor-pointer transition-all text-xs"
              onClick={onSelectRawData}
              style={{ backgroundColor: onRawData ? '#f5f5f5' : 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={onRawData ? '#4f6ef7' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span className="font-semibold text-gray-700 truncate">原始数据</span>
              {onRawData && (
                <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500 text-white font-semibold">当前</span>
              )}
            </div>

            {/* Branches */}
            {tree.map((node, i) => {
              const color = PALETTE[i % PALETTE.length];
              const lastBranch = i === tree.length - 1;

              return (
                <div key={node.version.id} className="relative">
                  {/* Trunk vertical line spanning all branches */}
                  {!lastBranch && (
                    <div
                      className="absolute left-[7px] top-0 bottom-0"
                      style={{ width: 1, backgroundColor: '#d5d5d5' }}
                    />
                  )}
                  <TreeNodeItem
                    node={node}
                    color={color}
                    isLastChild={lastBranch}
                    currentVersionId={currentVersionId}
                    onSelectVersion={onSelectVersion}
                    depth={0}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
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
