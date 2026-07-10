'use client';

import { Version } from '@/lib/types';

interface WorkflowTreeProps {
  versions: Version[];
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSelectRawData: () => void;
  onOpenHistory: () => void;
}

// ── Tree data structure ──
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
    const node = map.get(v.id)!;
    if (v.parentVersion && map.has(v.parentVersion)) {
      map.get(v.parentVersion)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ── Color palette for branches ──
const PALETTE = [
  { accent: '#4f6ef7', bg: '#eef1ff', line: '#c7d2fe', marker: '#4f6ef7', label: '蓝色' },
  { accent: '#059669', bg: '#ecfdf5', line: '#a7f3d0', marker: '#059669', label: '绿色' },
  { accent: '#d97706', bg: '#fffbeb', line: '#fde68a', marker: '#d97706', label: '橙色' },
  { accent: '#7c3aed', bg: '#f5f3ff', line: '#ddd6fe', marker: '#7c3aed', label: '紫色' },
  { accent: '#0891b2', bg: '#ecfeff', line: '#cffafe', marker: '#0891b2', label: '青色' },
  { accent: '#db2777', bg: '#fdf2f8', line: '#fbcfe8', marker: '#db2777', label: '粉色' },
];

// ── Recursive node renderer ──
function TreeNodeItem({
  node,
  color,
  ancestorHasNext,
  isLast,
  currentVersionId,
  onSelectVersion,
}: {
  node: TreeNode;
  color: (typeof PALETTE)[number];
  ancestorHasNext: boolean[];
  isLast: boolean;
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
}) {
  const isCurrent = node.version.id === currentVersionId;
  const depth = ancestorHasNext.length;
  const hasChildren = node.children.length > 0;
  // The vertical line at current level continues if hasChildren OR has next sibling
  const lineContinues = hasChildren || !isLast;

  // Build segments: each ancestor level plus current connector
  const segments: { width: number; hasLine: boolean; isConnector?: boolean }[] = [];

  // Ancestor levels
  for (let i = 0; i < depth; i++) {
    segments.push({ width: 24, hasLine: ancestorHasNext[i] });
  }
  // Connector + marker level
  segments.push({ width: 28, hasLine: false, isConnector: true });

  const totalGutter = segments.reduce((s, seg) => s + seg.width, 0);

  return (
    <div>
      {/* Row */}
      <div
        className="relative flex items-stretch cursor-pointer group"
        onClick={() => onSelectVersion(node.version.id)}
      >
        {/* Left gutter with tree lines */}
        <div className="flex shrink-0" style={{ width: totalGutter }}>
          {segments.map((seg, i) => {
            if (seg.isConnector) {
              // Connector: horizontal line + square marker
              // Draw vertical continuation line if this node has children/siblings below
              return (
                <div key={i} className="relative flex items-center" style={{ width: seg.width }}>
                  {/* Horizontal line */}
                  <div className="h-px flex-1 bg-gray-300 group-hover:bg-gray-400 transition-colors" />
                  {/* Vertical continuation (only if this node isn't the very end of the line) */}
                  {lineContinues && (
                    <div className="absolute left-1/2 top-1/2 w-px bg-gray-300" style={{ height: '50%', top: '50%' }} />
                  )}
                  {/* Square marker */}
                  <div
                    className="w-[11px] h-[11px] shrink-0 rotate-45 rounded-sm transition-all duration-200 z-10"
                    style={{
                      backgroundColor: isCurrent ? color.marker : '#d1d5db',
                      boxShadow: isCurrent ? `0 0 0 3px ${color.bg}` : 'none',
                    }}
                  />
                  {/* Vertical line going down from marker (for children) */}
                  {lineContinues && (
                    <div className="absolute left-1/2 w-px bg-gray-300" style={{ height: '50%', top: '50%', marginLeft: 0 }} />
                  )}
                </div>
              );
            }
            // Ancestor level: vertical line
            return (
              <div key={i} className="relative flex justify-center" style={{ width: seg.width }}>
                {seg.hasLine && <div className="w-px self-stretch bg-gray-300 group-hover:bg-gray-400 transition-colors" />}
              </div>
            );
          })}
        </div>

        {/* Card content */}
        <div className="flex-1 min-w-0 py-1 pr-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all duration-200"
            style={{
              backgroundColor: isCurrent ? color.bg : 'white',
              borderColor: isCurrent ? color.line : '#e9ecef',
              borderLeftColor: isCurrent ? color.accent : '#e9ecef',
              borderLeftWidth: isCurrent ? 3 : 1,
            }}
          >
            {/* Version badge */}
            <span
              className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                color: color.accent,
                backgroundColor: isCurrent ? 'white' : '#f3f4f6',
              }}
            >
              v{node.version.label}
            </span>

            {/* Operation name */}
            <span className="truncate text-gray-700 font-medium">{node.version.operation}</span>

            {/* Row count */}
            <span className="shrink-0 text-gray-400 text-[10px]">{node.version.rows.length}行</span>

            {/* Current badge */}
            {isCurrent && (
              <span
                className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                style={{ backgroundColor: color.accent }}
              >
                当前
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children branch */}
      {hasChildren && (
        <div>
          {node.children.map((child, i) => {
            const lastChild = i === node.children.length - 1;
            const childAncestor = [...ancestorHasNext, lineContinues];
            return (
              <TreeNodeItem
                key={child.version.id}
                node={child}
                color={color}
                ancestorHasNext={childAncestor}
                isLast={lastChild}
                currentVersionId={currentVersionId}
                onSelectVersion={onSelectVersion}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
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

      {/* Scrollable tree */}
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
            {/* ── 原始数据 row ── */}
            <div
              className="flex items-stretch cursor-pointer group mb-2"
              onClick={onSelectRawData}
            >
              {/* Gutter with folder icon */}
              <div className="flex shrink-0 items-start pt-1.5" style={{ width: 36 }}>
                <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 bg-white transition-colors"
                  style={{
                    borderColor: onRawData ? '#4f6ef7' : '#d1d5db',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={onRawData ? '#4f6ef7' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              </div>
              {/* Card */}
              <div className="flex-1 min-w-0 py-1 pr-2">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs border transition-all duration-200"
                  style={{
                    backgroundColor: onRawData ? '#f3f4f6' : 'white',
                    borderColor: onRawData ? '#d1d5db' : '#e9ecef',
                    borderLeft: onRawData ? '3px solid #6b7280' : '1px solid #e9ecef',
                  }}
                >
                  <span className="font-semibold text-gray-700 truncate">原始数据</span>
                  <span className="shrink-0 text-gray-400 text-[10px]">起点</span>
                  {onRawData && (
                    <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500 text-white font-semibold">当前</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Branch container with vertical trunk line ── */}
            {tree.length > 0 && (
              <div className="relative ml-[17px] border-l-2 border-gray-200 pl-[1px]">
                {/* Vertical line top cap */}
                <div className="absolute -top-3 left-[-1px] w-[2px] h-3 bg-gray-200" />

                {tree.map((node, i) => {
                  const branchColor = PALETTE[i % PALETTE.length];
                  const lastBranch = i === tree.length - 1;

                  return (
                    <div key={node.version.id} className="relative">
                      {/* Branch color dot on the trunk */}
                      <div
                        className="absolute -left-[11px] top-[14px] w-[6px] h-[6px] rounded-full border-2 border-white z-10"
                        style={{ backgroundColor: branchColor.accent }}
                      />

                      <TreeNodeItem
                        node={node}
                        color={branchColor}
                        ancestorHasNext={[]}
                        isLast={lastBranch}
                        currentVersionId={currentVersionId}
                        onSelectVersion={onSelectVersion}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History link */}
      <div className="px-3 py-2 border-t border-gray-100 shrink-0">
        <button
          onClick={onOpenHistory}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          操作历史
        </button>
      </div>
    </div>
  );
}
