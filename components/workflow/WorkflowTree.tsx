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

const BRANCH_COLORS = [
  { bar: '#4f6ef7', tr: '#eef1ff', dot: '#4f6ef7', name: 'indigo' },
  { bar: '#16a34a', tr: '#f0fdf4', dot: '#16a34a', name: 'green' },
  { bar: '#ea580c', tr: '#fff7ed', dot: '#ea580c', name: 'orange' },
  { bar: '#7c3aed', tr: '#f5f3ff', dot: '#7c3aed', name: 'purple' },
  { bar: '#0891b2', tr: '#ecfeff', dot: '#0891b2', name: 'cyan' },
  { bar: '#db2777', tr: '#fdf2f8', dot: '#db2777', name: 'pink' },
];

const STROKE = '#cbd5e1';

// ── Single row of the tree ──
function TreeRow({
  label, operation, count, isCurrent, indent, color, isLastOfBranch, isLastOfParent, children, onClick,
}: {
  label: string; operation?: string; count?: number; isCurrent: boolean;
  indent: number; color: (typeof BRANCH_COLORS)[number];
  isLastOfBranch: boolean; isLastOfParent: boolean;
  children?: React.ReactNode;
  onClick: () => void;
}) {
  // ── Left gutter ──
  const gutterW = 12 + indent * 20;
  const dotL = gutterW - 7;

  return (
    <div className="relative">
      {/* The row */}
      <div
        className="relative flex items-start cursor-pointer group py-0.5"
        onClick={onClick}
      >
        {/* Left gutter with tree lines */}
        <svg width={gutterW} height={34} className="shrink-0 block">
          {/* ── vertical line 1 ── */}
          <line x1={5} y1={0} x2={5} y2={34} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 2" />
          {/* ── horizontal arm ── */}
          <line x1={5} y1={17} x2={dotL + 1} y2={17} stroke={STROKE} strokeWidth={1.5} />
          {/* ── square marker ── */}
          <rect
            x={dotL - 5} y={12} width={10} height={10} rx={2}
            fill={isCurrent ? color.dot : '#cbd5e1'}
          />
        </svg>

        {/* Card */}
        <div className="flex-1 min-w-0 py-1 pr-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all duration-150"
            style={{
              backgroundColor: isCurrent ? color.tr : '#ffffff',
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
            {operation && <span className="truncate text-gray-700 font-[500]">{operation}</span>}
            {count !== undefined && <span className="shrink-0 text-gray-400 text-[10px]">{count}行</span>}
            {isCurrent && (
              <span
                className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white"
                style={{ backgroundColor: color.bar }}
              >
                当前
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {children}
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
            {/* Raw data root */}
            <div
              className="flex items-center gap-1.5 py-1.5 px-1 rounded-lg cursor-pointer transition-all text-xs"
              onClick={onSelectRawData}
              style={{ backgroundColor: onRawData ? '#f5f5f5' : 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={onRawData ? '#4f6ef7' : '#9ca3af'} strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span className="font-semibold text-gray-700 truncate">原始数据</span>
              {onRawData && (
                <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500 text-white font-semibold">当前</span>
              )}
            </div>

            {/* Branches */}
            {tree.map((rootNode, bi) => {
              const color = BRANCH_COLORS[bi % BRANCH_COLORS.length];
              const isLastBranch = bi === tree.length - 1;

              return (
                <div key={rootNode.version.id}>
                  {/* ── Root node of this branch ── */}
                  <div
                    className="relative flex items-start cursor-pointer group py-0.5"
                    onClick={() => onSelectVersion(rootNode.version.id)}
                  >
                    {/* Gutter with tree lines */}
                    <svg width={22} height={34} className="shrink-0 block">
                      {/* Connecting line from root upward to raw data */}
                      <line x1={11} y1={0} x2={11} y2={34} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 2" />
                      {/* Square marker */}
                      <rect
                        x={6} y={12} width={10} height={10} rx={2}
                        fill={rootNode.version.id === currentVersionId ? color.dot : '#cbd5e1'}
                      />
                    </svg>

                    {/* Card */}
                    <div className="flex-1 min-w-0 py-1 pr-2">
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all duration-150"
                        style={{
                          backgroundColor: rootNode.version.id === currentVersionId ? color.tr : '#ffffff',
                          borderColor: rootNode.version.id === currentVersionId ? color.bar : '#e9ecef',
                          borderLeftWidth: rootNode.version.id === currentVersionId ? 3 : 1,
                          borderLeftColor: rootNode.version.id === currentVersionId ? color.bar : '#e9ecef',
                        }}
                      >
                        <span
                          className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{
                            color: color.bar,
                            backgroundColor: rootNode.version.id === currentVersionId ? '#ffffff' : '#f5f5f5',
                          }}
                        >
                          v{rootNode.version.label}
                        </span>
                        <span className="truncate text-gray-700 font-[500]">{rootNode.version.operation}</span>
                        <span className="shrink-0 text-gray-400 text-[10px]">{rootNode.version.rows.length}行</span>
                        {rootNode.version.id === currentVersionId && (
                          <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: color.bar }}>
                            当前
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Children of root ── */}
                  {rootNode.children.length > 0 && (
                    <div>
                      {rootNode.children.map((child, ci) => {
                        const lastChild = ci === rootNode.children.length - 1;
                        return (
                          <div key={child.version.id}>
                            {/* Striped line from root to first child */}
                            {ci === 0 && (
                              <svg width={22} height={12} className="block">
                                <line x1={11} y1={0} x2={11} y2={12} stroke={STROKE} strokeWidth={1.5} strokeDasharray="4 2" />
                              </svg>
                            )}
                            <TreeRow
                              label={child.version.label}
                              operation={child.version.operation}
                              count={child.version.rows.length}
                              isCurrent={child.version.id === currentVersionId}
                              indent={1}
                              color={color}
                              isLastOfBranch={lastChild}
                              isLastOfParent={lastChild}
                              onClick={() => onSelectVersion(child.version.id)}
                            >
                              {/* Grandchildren */}
                              {child.children.length > 0 && (
                                <div>
                                  {child.children.map((gc, gci) => (
                                    <TreeRow
                                      key={gc.version.id}
                                      label={gc.version.label}
                                      operation={gc.version.operation}
                                      count={gc.version.rows.length}
                                      isCurrent={gc.version.id === currentVersionId}
                                      indent={2}
                                      color={color}
                                      isLastOfBranch={gci === child.children.length - 1}
                                      isLastOfParent={lastChild && gci === child.children.length - 1}
                                      onClick={() => onSelectVersion(gc.version.id)}
                                    />
                                  ))}
                                </div>
                              )}
                            </TreeRow>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
