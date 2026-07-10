'use client';

import Workspace from '@/components/workspace/Workspace';
import WorkflowTree from '@/components/workflow/WorkflowTree';
import { WorkbenchFile, Version, TaskSheetRef } from '@/lib/types';

interface LeftPanelProps {
  files: WorkbenchFile[];
  selectedFileId: string | null;
  selectedSheet?: string | null;
  taskSheets?: TaskSheetRef[];
  onSelectFile: (id: string, sheet?: string) => void;
  onAddFile: () => void;
  onRemoveFile: (id: string) => void;
  onAddToTask: (fileId: string, sheetName: string) => void;
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
  taskSheets = [],
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
    <aside className="w-[260px] shrink-0 border-r border-[#e9ecef] bg-[#f8f9fa] flex flex-col h-full">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
            <Workspace
              files={files}
              selectedFileId={selectedFileId}
              selectedSheet={selectedSheet}
              taskSheets={taskSheets}
              onSelectFile={onSelectFile}
              onAddFile={onAddFile}
              onRemoveFile={onRemoveFile}
              onAddToTask={onAddToTask}
            />
          </div>
        </div>
        <div className="border-t border-[#e9ecef]" />
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
