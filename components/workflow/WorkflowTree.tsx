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
  parentVersion: string | undefined;
}

function buildTree(versions: Version[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const v of versions) {
    map.set(v.id, { version: v, children: [], parentVersion: v.parentVersion });
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

function TreeNodeItem({ node, currentVersionId, onSelectVersion, isLast, prefix }: {
  node: TreeNode;
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  isLast: boolean;
  prefix: string;
}) {
  const isCurrent = node.version.id === currentVersionId;
  const connector = isLast ? '└──' : '├──';

  return (
    <div>
      <div
        onClick={() => onSelectVersion(node.version.id)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-xs ${
          isCurrent
            ? 'bg-[#eef1ff] text-[#1a1a2e] font-medium border-l-[3px] border-l-[#4f6ef7]'
            : 'text-[#6b7280] hover:bg-[#f3f4f6]'
        }`}
      >
        <span className="text-[#d1d5db] select-none shrink-0 font-mono text-[11px]">{prefix}{connector}</span>
        <span className="shrink-0 text-[#9ca3af] tabular-nums font-mono text-[10px]">v{node.version.label}</span>
        <span className="truncate">{node.version.operation}</span>
        {isCurrent && (
          <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#4f6ef7] text-white font-medium">当前</span>
        )}
      </div>
      {node.children.length > 0 && (
        <div>
          {node.children.map((child, i) => {
            const last = i === node.children.length - 1;
            const childPrefix = prefix + (isLast ? '  ' : '│ ');
            return (
              <TreeNodeItem
                key={child.version.id}
                node={child}
                currentVersionId={currentVersionId}
                onSelectVersion={onSelectVersion}
                isLast={last}
                prefix={childPrefix}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WorkflowTree({ versions, currentVersionId, onSelectVersion, onSelectRawData, onOpenHistory }: WorkflowTreeProps) {
  const tree = buildTree(versions);
  const onRawData = !currentVersionId;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Workflow</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-2">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <p className="text-xs text-[#9ca3af]">暂无操作步骤</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* 原始数据 - 可点击回到原始数据 */}
            <div
              onClick={onSelectRawData}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs ${
                onRawData
                  ? 'bg-[#eef1ff] text-[#1a1a2e] font-medium border-l-[3px] border-l-[#4f6ef7]'
                  : 'bg-white border border-[#e9ecef] text-[#6b7280] font-medium hover:bg-[#f3f4f6]'
              }`}
            >
              <span className="shrink-0 text-[#9ca3af] font-mono text-[10px]">v0</span>
              <span className="truncate">原始数据</span>
              {onRawData && (
                <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[#4f6ef7] text-white font-medium">当前</span>
              )}
            </div>
            {tree.map((node, i) => {
              const isLastBranch = i === tree.length - 1;
              return (
                <div key={node.version.id}>
                  <TreeNodeItem
                    node={node}
                    currentVersionId={currentVersionId}
                    onSelectVersion={onSelectVersion}
                    isLast={isLastBranch}
                    prefix=""
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[#e9ecef] shrink-0">
        <button onClick={onOpenHistory} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
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
