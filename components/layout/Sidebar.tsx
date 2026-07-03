'use client';

import { useState } from 'react';
import { WorkbenchFile } from '@/lib/types';
import FileList from '@/components/filepool/FileList';
import SettingsDialog from '@/components/common/SettingsDialog';

interface SidebarProps {
  files: WorkbenchFile[];
  selectedFileId: string | null;
  taskFileIds: string[];
  onSelectFile: (id: string) => void;
  onAddToTask: (id: string) => void;
  onAddFile: () => void;
  onRemoveFile: (id: string) => void;
}

export default function Sidebar({ files, selectedFileId, taskFileIds, onSelectFile, onAddToTask, onAddFile, onRemoveFile }: SidebarProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-800">文件池</span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          title="设置"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
      <div className="px-3 py-2.5">
        <button onClick={onAddFile} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          上传文件
        </button>
      </div>
      <FileList files={files} selectedFileId={selectedFileId} taskFileIds={taskFileIds} onSelect={onSelectFile} onAddToTask={onAddToTask} onRemoveFile={onRemoveFile} />
      <div className="px-4 py-2.5 border-t border-zinc-100 text-xs text-zinc-400">共 {files.length} 个文件</div>
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </aside>
  );
}
