'use client';

import { Version } from '@/lib/types';

interface WorkflowTreeProps {
  versions: Version[];
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSelectRawData: () => void;
  onOpenHistory: () => void;
}

// ── Tree data ──
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

// ── Branch palette ──
const PALETTE = [
  { accent: '#4f6ef7', bg: '#eef1ff', line: '#c7d2fe' },
  { accent: '#059669', bg: '#ecfdf5', line: '#a7f3d0' },
  { accent: '#d97706', bg: '#fffbeb', line: '#fde68a' },
  { accent: '#7c3aed', bg: '#f5f3ff', line: '#ddd6fe' },
  { accent: '#0891b2', bg: '#ecfeff', line: '#cffafe' },
  { accent: '#db2777', bg: '#fdf2f8', line: '#fbcfe8' },
];

// ── SVG line rendering constants ──
const LV_WIDTH = 22;   // width of each ancestor level column
const CV_WIDTH = 28;   // width of the connector column

function TreeNodeItem({
  node, color, ancestorLineFlags, isLast, currentVersionId, onSelectVersion,
}: {
  node: TreeNode;
  color: (typeof PALETTE)[number];
  ancestorLineFlags: boolean[];
  isLast: boolean;
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
}) {
  const isCurrent = node.version.id === currentVersionId;
  const depth = ancestorLineFlags.length;
  const hasChildren = node.children.length > 0;
  const isLastTreeRoot = ancestorLineFlags.length === 0 && isLast;

  // ── SVG dimensions ──
  const svgWidth = depth * LV_WIDTH + CV_WIDTH;
  const svgHeight = 38; // enough for a row
  const markerX = depth * LV_WIDTH + CV_WIDTH - 12;
  const markerY = svgHeight / 2;

  return (
    <div>
      {/* Row container */}
      <div
        className="relative flex items-stretch cursor-pointer group"
        onClick={() => onSelectVersion(node.version.id)}
      >
        {/* SVG gutter — draws ALL lines as a single continuous SVG */}
        <svg
          width={svgWidth}
          height={svgHeight}
          className="shrink-0"
          style={{ minWidth: svgWidth }}
        >
          {/* Draw ancestor vertical lines */}
          {ancestorLineFlags.map((showLine, i) => {
            if (!showLine) return null;
            return (
              <line
                key={`vl-${i}`}
                x1={i * LV_WIDTH + LV_WIDTH / 2}
                y1={0}
                x2={i * LV_WIDTH + LV_WIDTH / 2}
                y2={svgHeight}
                stroke="#d1d5db"
                strokeWidth={1.5}
                className="group-hover:opacity-80 transition-opacity"
              />
            );
          })}

          {/* Connector horizontal line */}
          <line
            x1={depth * LV_WIDTH}
            y1={markerY}
            x2={depth * LV_WIDTH + CV_WIDTH - 12}
            y2={markerY}
            stroke="#d1d5db"
            strokeWidth={1.5}
          />

          {/* Vertical continuation downward (if node has children or siblings follow) */}
          {(hasChildren || (!isLastTreeRoot && !isLast)) && (
            <line
              x1={depth * LV_WIDTH + CV_WIDTH - 12}
              y1={markerY}
              x2={depth * LV_WIDTH + CV_WIDTH - 12}
              y2={svgHeight}
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
          )}

          {/* Vertical continuation upward (always from top to marker) */}
          {depth > 0 && (
            <line
              x1={depth * LV_WIDTH + CV_WIDTH - 12}
              y1={0}
              x2={depth * LV_WIDTH + CV_WIDTH - 12}
              y2={markerY}
              stroke="#d1d5db"
              strokeWidth={1.5}
            />
          )}

          {/* Square marker */}
          <rect
            x={markerX - 5.5}
            y={markerY - 5.5}
            width={11}
            height={11}
            rx={2}
            ry={2}
            transform={`rotate(45, ${markerX}, ${markerY})`}
            fill={isCurrent ? color.accent : '#d1d5db'}
            className="transition-colors duration-200"
          />
        </svg>

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
            <span
              className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: color.accent, backgroundColor: isCurrent ? 'white' : '#f3f4f6' }}
            >
              v{node.version.label}
            </span>
            <span className="truncate text-gray-700 font-medium">{node.version.operation}</span>
            <span className="shrink-0 text-gray-400 text-[10px]">{node.version.rows.length}行</span>
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

      {/* Children */}
      {hasChildren && (
        <div>
          {node.children.map((child, i) => {
            const lastChild = i === node.children.length - 1;
            // This node's vertical line continues if it has children OR isn't last among siblings
            const thisLineContinues = hasChildren || (!isLastTreeRoot && !isLast);
            return (
              <TreeNodeItem
                key={child.version.id}
                node={child}
                color={color}
                ancestorLineFlags={[...ancestorLineFlags, thisLineContinues && !isLastTreeRoot]}
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

// ── Main ──
export default function WorkflowTree({
  versions, currentVersionId, onSelectVersion, onSelectRawData, onOpenHistory,
}: WorkflowTreeProps) {
  const tree = buildTree(versions);
  const onRawData = !currentVersionId;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-gray-100">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</span>
      </div>

      <div className="flex-1 overflow-auto px-1 py-3">
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
            {/* Raw data node */}
            <div
              className="flex items-stretch cursor-pointer group mb-2"
              onClick={onSelectRawData}
            >
              <div className="flex shrink-0 items-start pt-2" style={{ width: 36 }}>
                <div
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 bg-white transition-colors"
                  style={{ borderColor: onRawData ? '#4f6ef7' : '#d1d5db' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={onRawData ? '#4f6ef7' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              </div>
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

            {/* Branch container - vertical trunk on the left */}
            <div className="relative">
              {tree.map((node, i) => {
                const branchColor = PALETTE[i % PALETTE.length];
                const lastBranch = i === tree.length - 1;
                return (
                  <div key={node.version.id} className="relative">
                    {/* Color dot on trunk */}
                    <svg width="12" height="12" className="absolute -left-[5px] z-10" style={{ top: 13 }}>
                      <circle cx="6" cy="6" r="4" fill={branchColor.accent} stroke="white" strokeWidth="2" />
                    </svg>
                    <TreeNodeItem
                      node={node}
                      color={branchColor}
                      ancestorLineFlags={[]}
                      isLast={lastBranch}
                      currentVersionId={currentVersionId}
                      onSelectVersion={onSelectVersion}
                    />
                  </div>
                );
              })}

              {/* Vertical trunk line spanning all branches - drawn as an absolutely positioned SVG */}
              {tree.length > 0 && (
                <svg
                  className="absolute top-0 left-[1px]"
                  width={4}
                  height="100%"
                  style={{ pointerEvents: 'none' }}
                >
                  <line x1={2} y1={0} x2={2} y2="100%" stroke="#d1d5db" strokeWidth={2} />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

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
