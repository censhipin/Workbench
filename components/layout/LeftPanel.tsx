'use client';

import Workspace from '@/components/workspace/Workspace';
import WorkflowTree from '@/components/workflow/WorkflowTree';
import { WorkbenchFile, Version } from '@/lib/types';

interface LeftPanelProps {
  files: WorkbenchFile[];
  selectedFileId: string | null;
  selectedSheet?: string | null;
  taskFileIds?: string[];
  onSelectFile: (id: string, sheet?: string) => void;
  onAddFile: () => void;
  onRemoveFile: (id: string) => void;
  onAddToTask?: (id: string) => void;
  versions: Version[];
  currentVersionId: string | null;
  onSelectVersion: (id: string) => void;
  onSelectRawData: () => void;
  onOpenHistory: () => void;
}

export default function LeftPanel({
  files,
  selectedFileId,
  selectedSheet,
  taskFileIds = [],
  onSelectFile,
  onAddFile,
  onRemoveFile,
  onAddToTask,
  versions,
  currentVersionId,
  onSelectVersion,
  onSelectRawData,
  onOpenHistory,
}: LeftPanelProps) {
  return (
    <aside className="w-[260px] shrink-0 flex flex-col h-full" style={{ borderRight: '1px solid var(--border-color)', background: 'var(--bg-sidebar)' }}>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <Workspace
              files={files}
              selectedFileId={selectedFileId}
              selectedSheet={selectedSheet}
              taskFileIds={taskFileIds}
              onSelectFile={onSelectFile}
              onAddFile={onAddFile}
              onRemoveFile={onRemoveFile}
              onAddToTask={onAddToTask}
            />
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)' }} />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <WorkflowTree
              versions={versions}
              currentVersionId={currentVersionId}
              onSelectVersion={onSelectVersion}
              onSelectRawData={onSelectRawData}
              onOpenHistory={onOpenHistory}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
