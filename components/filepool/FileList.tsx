'use client';

import { WorkbenchFile } from '@/lib/types';
import FileItem from './FileItem';

interface FileListProps {
  files: WorkbenchFile[];
  selectedFileId: string | null;
  taskFileIds: string[];
  onSelect: (id: string) => void;
  onAddToTask: (id: string) => void;
  onRemoveFile: (id: string) => void;
}

export default function FileList({ files, selectedFileId, taskFileIds, onSelect, onAddToTask, onRemoveFile }: FileListProps) {
  return (
    <div className="flex-1 overflow-auto px-2 space-y-2">
      {files.map((file) => (
        <FileItem key={file.id} file={file} isSelected={selectedFileId === file.id} isInTask={taskFileIds.includes(file.id)} onSelect={onSelect} onAddToTask={onAddToTask} onRemove={onRemoveFile} />
      ))}
    </div>
  );
}
