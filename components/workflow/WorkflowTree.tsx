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

const ACCENT = ['#4f6ef7', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#db2777'];
const ACCENT_BG = ['#eef1ff', '#f0fdf4', '#fff7ed', '#f5f3ff', '#ecfeff', '#fdf2f8'];

/** A single node row: horizontal arm + square + card */
function NodeRow({
  label, op, count, isCurrent, accentIdx, onClick,
}: {
  label: string; op?: string; count?: number; isCurrent: boolean;
  accentIdx: number; onClick: () => void;
}) {
  const c = ACCENT[accentIdx % ACCENT.length];
  const cb = ACCENT_BG[accentIdx % ACCENT_BG.length];
  return (
    <div className="flex items-stretch cursor-pointer group min-h-[34px]" onClick={onClick}>
      {/* Horizontal arm from trunk to square */}
      <svg width={20} height={34} className="shrink-0 block">
        <line x1={0} y1={17} x2={20} y2={17} stroke="#cbd5e1" strokeWidth={2} />
      </svg>
      {/* Square */}
      <div className="shrink-0 flex items-center justify-center" style={{ width: 14 }}>
        <div
          className="w-2.5 h-2.5 rotate-45 rounded-sm transition-all duration-150"
          style={{ backgroundColor: isCurrent ? c : '#cbd5e1' }}
        />
      </div>
      {/* Card */}
      <div className="flex-1 min-w-0 py-0.5 pr-2">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all duration-150"
          style={{
            backgroundColor: isCurrent ? cb : '#ffffff',
            borderColor: isCurrent ? c : '#e9ecef',
            borderLeftWidth: isCurrent ? 3 : 1,
            borderLeftColor: isCurrent ? c : '#e9ecef',
          }}
        >
          <span
            className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: c, backgroundColor: isCurrent ? '#ffffff' : '#f5f5f5' }}
          >
            v{label}
          </span>
          {op && <span className="truncate text-gray-700 font-[500]">{op}</span>}
          {count !== undefined && <span className="shrink-0 text-gray-400 text-[10px]">{count}行</span>}
          {isCurrent && (
            <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: c }}>
              当前
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Branch({ nodes, accentIdx, currentVersionId, onSelectVersion }: {
  nodes: TreeNode[]; accentIdx: number;
  currentVersionId: string | null; onSelectVersion: (id: string) => void;
}) {
  return (
    <div>
      {nodes.map((node, i) => (
        <div key={node.version.id}>
          <NodeRow
            label={node.version.label}
            op={node.version.operation}
            count={node.version.rows.length}
            isCurrent={node.version.id === currentVersionId}
            accentIdx={accentIdx}
            onClick={() => onSelectVersion(node.version.id)}
          />
          {node.children.length > 0 && (
            <div className="ml-[20px] border-l-2 border-gray-300 pl-[4px]">
              <Branch
                nodes={node.children}
                accentIdx={accentIdx}
                currentVersionId={currentVersionId}
                onSelectVersion={onSelectVersion}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function WorkflowTree({
  versions, currentVersionId, onSelectVersion, onSelectRawData, onOpenHistory,
}: WorkflowTreeProps) {
  const tree = buildTree(versions);
  const onRaw = !currentVersionId;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-4 py-3 shrink-0 border-b border-gray-100">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Workflow</span>
      </div>

      <div className="flex-1 overflow-auto px-2 py-3">
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
            {/* Raw data */}
            <div
              className="flex items-center gap-1.5 px-1 py-1.5 rounded-lg cursor-pointer text-xs"
              onClick={onSelectRawData}
              style={{ backgroundColor: onRaw ? '#f5f5f5' : 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={onRaw ? '#4f6ef7' : '#9ca3af'} strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span className="font-semibold text-gray-700 truncate">原始数据</span>
              {onRaw && <span className="ml-auto shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-gray-500 text-white font-semibold">当前</span>}
            </div>

            {/* Main trunk — a single continuous border-left for ALL root branches */}
            <div className="ml-[7px] border-l-[2.5px] border-gray-300">
              {/* Dashed segment from raw data to first branch */}
              <svg width="16" height="16" className="block ml-[-1px]">
                <line x1={1} y1={0} x2={1} y2={16} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="3 2" />
              </svg>

              {tree.map((rootNode, i) => (
                <div key={rootNode.version.id}>
                  <NodeRow
                    label={rootNode.version.label}
                    op={rootNode.version.operation}
                    count={rootNode.version.rows.length}
                    isCurrent={rootNode.version.id === currentVersionId}
                    accentIdx={i}
                    onClick={() => onSelectVersion(rootNode.version.id)}
                  />
                  {rootNode.children.length > 0 && (
                    <div className="ml-[20px] border-l-2 border-gray-300 pl-[4px]">
                      <Branch
                        nodes={rootNode.children}
                        accentIdx={i}
                        currentVersionId={currentVersionId}
                        onSelectVersion={onSelectVersion}
                      />
                    </div>
                  )}
                  {i < tree.length - 1 && <div className="h-3" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 shrink-0">
        <button onClick={onOpenHistory} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">
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
