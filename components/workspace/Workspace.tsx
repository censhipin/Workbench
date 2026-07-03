'use client';

import { useState } from 'react';
import { WorkbenchFile } from '@/lib/types';

interface WorkspaceProps {
  files: WorkbenchFile[];
  selectedFileId: string | null;
  selectedSheet?: string | null;
  taskFileIds?: string[];
  onSelectFile: (id: string, sheet?: string) => void;
  onAddFile: () => void;
  onRemoveFile: (id: string) => void;
  onAddToTask?: (id: string) => void;
}

export default function Workspace({
  files,
  selectedFileId,
  selectedSheet,
  taskFileIds = [],
  onSelectFile,
  onAddFile,
  onRemoveFile,
  onAddToTask,
}: WorkspaceProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          <span className="text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Workspace</span>
        </div>
        <span className="text-[11px] text-[#9ca3af]">{files.length} 文件</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-3 space-y-1.5">
        {files.map((file) => {
          const isSelected = selectedFileId === file.id;
          const isExpanded = expandedFileId === file.id;
          const hasMultiSheets = file.sheets.length > 1;
          const isInTask = taskFileIds.includes(file.id);
          return (
            <div key={file.id} className="space-y-1">
              <div
                className={'relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all group ' + (
                  isSelected
                    ? 'bg-[#eef1ff] border-l-[3px] border-l-[#4f6ef7] shadow-sm'
                    : 'bg-white border border-[#e9ecef] hover:border-[#d1d5db] hover:shadow-sm'
                )}
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0"
                  onClick={() => {
                    onSelectFile(file.id);
                    if (hasMultiSheets) setExpandedFileId(isExpanded ? null : file.id);
                  }}
                >
                  <span className="text-lg shrink-0">{file.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium text-[#1a1a2e]">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">
                      {file.rowCount}行 x {file.colCount}列
                      {hasMultiSheets && (' - ' + file.sheets.length + '页')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onAddToTask && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddToTask(file.id); }}
                      className={'w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium transition-all opacity-0 group-hover:opacity-100 ' + (isInTask ? 'bg-[#4f6ef7] text-white' : 'text-[#9ca3af] hover:text-[#4f6ef7] hover:bg-[#eef1ff]')}
                      title={isInTask ? '移除任务文件' : '加入任务文件'}
                    >
                      {isInTask ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      )}
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(file.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#d1d5db] hover:text-[#ef4444] hover:bg-[#fef2f2] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="删除文件"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              {isExpanded && hasMultiSheets && (
                <div className="pl-9 space-y-0.5">
                  {file.sheets.map((sheet) => {
                    const isSheetSelected = isSelected && selectedSheet === sheet.name;
                    return (
                      <div
                        key={sheet.name}
                        onClick={() => onSelectFile(file.id, sheet.name)}
                        className={'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-xs ' + (isSheetSelected ? 'bg-[#eef1ff] text-[#4f6ef7] font-medium' : 'text-[#6b7280] hover:bg-[#f3f4f6]')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        </svg>
                        <span>{sheet.name}</span>
                        <span className="ml-auto text-[10px] text-[#9ca3af]">{sheet.rows.length}行</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {files.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-[#9ca3af]">暂无文件</p>
          </div>
        )}
      </div>

      <div className="px-3 py-3 shrink-0 border-t border-[#e9ecef]">
        <button onClick={onAddFile} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-[#d1d5db] text-xs font-medium text-[#6b7280] hover:border-[#4f6ef7] hover:text-[#4f6ef7] hover:bg-[#eef1ff] transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          上传文件
        </button>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-lg border border-[#e9ecef] px-5 py-4 w-72 max-w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[#1a1a2e] mb-1">删除文件</p>
            <p className="text-xs text-[#6b7280] mb-4">确定删除该文件？版本数据保留在后台。</p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="text-xs px-3 py-1.5 rounded-lg border border-[#e9ecef] text-[#6b7280] hover:bg-[#f3f4f6] transition-colors">取消</button>
              <button onClick={() => { onRemoveFile(deleteConfirm); setDeleteConfirm(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
