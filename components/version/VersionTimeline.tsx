'use client';

import { useState } from 'react';
import { Version, ColumnDef, RowData } from '@/lib/types';

interface VersionTimelineProps {
  versions: Version[];
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSetCurrent: (id: string) => void;
  onDeleteVersion: (id: string) => void;
}

export default function VersionTimeline({
  versions,
  currentVersionId,
  onSelectVersion,
  onSetCurrent,
  onDeleteVersion,
}: VersionTimelineProps) {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [fullscreenVersion, setFullscreenVersion] = useState<Version | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e9ecef] shrink-0 bg-white">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">版本时间线</span>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-xs text-[#9ca3af]">暂无版本</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#e9ecef]" />
            <div className="space-y-0">
              {sorted.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <div key={v.id} className="relative flex gap-3 pb-5">
                    {/* Timeline dot */}
                    <div className={`relative z-10 shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? 'bg-[#4f6ef7] border-[#4f6ef7] shadow-[0_0_0_3px_rgba(79,110,247,0.15)]'
                        : 'bg-white border-[#d1d5db]'
                    }`}>
                      <span className={`text-[9px] font-bold ${isCurrent ? 'text-white' : 'text-[#9ca3af]'}`}>{v.label}</span>
                    </div>

                    {/* Card */}
                    <div className={`flex-1 min-w-0 rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-l-[#4f6ef7] border-l-[3px] bg-white border-[#e9ecef] shadow-sm'
                        : 'bg-white border-[#e9ecef] hover:shadow-sm'
                    }`}>
                      <div
                        onClick={() => onSelectVersion(v.id)}
                        className="p-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-xs font-semibold ${isCurrent ? 'text-[#4f6ef7]' : 'text-[#1a1a2e]'}`}>
                            v{v.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#eef1ff] text-[#4f6ef7] font-medium">当前</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setContextMenu({ id: v.id, x: e.clientX, y: e.clientY }); }}
                            className="ml-auto w-5 h-5 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                          </button>
                        </div>
                        <p className="text-[11px] text-[#6b7280] truncate">{v.operation}</p>
                        <p className="text-[10px] text-[#9ca3af] mt-1 font-mono">{v.rows.length}行 × {v.columns.length}列</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
          <div className="absolute bg-white rounded-xl shadow-lg border border-[#e9ecef] py-1.5 w-44" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { onSetCurrent(contextMenu.id); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#1a1a2e] hover:bg-[#f3f4f6] transition-colors">
              <span>📌</span>
              <span>设为当前</span>
            </button>
            <button onClick={() => { const v = versions.find(x => x.id === contextMenu.id); if (v) setFullscreenVersion(v); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#1a1a2e] hover:bg-[#f3f4f6] transition-colors">
              <span>👁</span>
              <span>完整查看</span>
            </button>
            <div className="border-t border-[#e9ecef] my-1" />
            <button onClick={() => { setDeleteConfirm(contextMenu.id); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#ef4444] hover:bg-[#fef2f2] transition-colors">
              <span>✕</span>
              <span>删除此版本</span>
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-lg border border-[#e9ecef] px-5 py-4 w-72 max-w-full" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#1a1a2e] mb-1">删除版本</p>
            <p className="text-xs text-[#6b7280] mb-4">确定删除该版本及所有后续版本？</p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="text-xs px-3 py-1.5 rounded-lg border border-[#e9ecef] text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">取消</button>
              <button onClick={() => { onDeleteVersion(deleteConfirm); setDeleteConfirm(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}

      {fullscreenVersion && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-[#e9ecef] shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[#1a1a2e]">v{fullscreenVersion.label} 数据</h2>
              <span className="text-xs text-[#9ca3af] bg-[#f3f4f6] px-2 py-0.5 rounded">{fullscreenVersion.rows.length}行×{fullscreenVersion.columns.length}列</span>
              <span className="text-xs text-[#6b7280]">{fullscreenVersion.operation}</span>
            </div>
            <button onClick={() => setFullscreenVersion(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#e9ecef] text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              关闭
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-6">
            <DataTableComponent columns={fullscreenVersion.columns} rows={fullscreenVersion.rows} maxHeight="100%" />
          </div>
        </div>
      )}
    </div>
  );
}

import DataTableComponent from '@/components/common/DataTable';
