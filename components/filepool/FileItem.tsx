'use client';

import React, { useState } from 'react';
import { WorkbenchFile } from '@/lib/types';

interface FileItemProps {
  file: WorkbenchFile;
  isSelected: boolean;
  isInTask: boolean;
  onSelect: (id: string) => void;
  onAddToTask: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function FileItem({ file, isSelected, isInTask, onSelect, onAddToTask, onRemove }: FileItemProps) {
  var [showConfirm, setShowConfirm] = useState(false);

  var handleRemoveClick = function (e: React.MouseEvent) {
    e.stopPropagation();
    setShowConfirm(true);
  };

  var handleConfirm = function (e: React.MouseEvent) {
    e.stopPropagation();
    setShowConfirm(false);
    onRemove(file.id);
  };

  var handleCancel = function (e: React.MouseEvent) {
    e.stopPropagation();
    setShowConfirm(false);
  };

  return (
    <div className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all group ${isSelected ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'border border-transparent hover:bg-zinc-100'}`}>
      <div onClick={() => onSelect(file.id)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
        <span className="text-lg shrink-0">{file.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${isSelected ? 'text-blue-700 font-medium' : 'text-zinc-700'}`} title={file.name}>{file.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-zinc-400">{file.rowCount} 行 x {file.colCount} 列</span>
          </div>
        </div>
        {file.sheets.length > 1 && <span className="text-[10px] text-zinc-400 bg-zinc-200/50 rounded px-1.5 py-0.5 shrink-0">{file.sheets.length}页</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={handleRemoveClick} className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all" title="删除文件">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAddToTask(file.id); }} className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium transition-all ${isInTask ? 'bg-blue-600 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-blue-100 hover:text-blue-600 opacity-0 group-hover:opacity-100'}`} title={isInTask ? '已加入任务' : '加入任务'}>
          {isInTask ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : '+'}
        </button>
      </div>
      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleCancel}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-5 py-4 w-72 max-w-full" onClick={function (e: React.MouseEvent) { e.stopPropagation(); }}>
            <p className="text-sm font-medium text-zinc-800 mb-1">删除文件</p>
            <p className="text-xs text-zinc-500 mb-4">确定删除 {file.name}？</p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={handleCancel} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors">取消</button>
              <button onClick={handleConfirm} className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">删除</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
