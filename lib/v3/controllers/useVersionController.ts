// ============================================================
// useVersionController — 版本管理控制器
// ============================================================
import { useState, useCallback } from 'react';
import type { ColumnDef, RowData, Version, DataTab } from '@/lib/types';

const MAX_VERSIONS = 20;

export function useVersionController(selectedFileId: string | null) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DataTab>('original');
  const [resultKey, setResultKey] = useState(0);
  const [beforeDataRef, setBeforeDataRef] = useState<{ columns: ColumnDef[]; rows: RowData[] } | null>(null);

  const currentVersion = versions.find(v => v.id === currentVersionId) ?? null;
  const hasVersions = versions.length > 0;

  const createVersion = useCallback((
    operation: string, plan: object, columns: ColumnDef[], rows: RowData[], parentId?: string
  ): Version => {
    const maxV = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0;
    return {
      id: 'v-' + Date.now(),
      fileId: selectedFileId ?? '',
      version: maxV + 1,
      parentVersion: parentId,
      operation,
      plan,
      columns,
      rows,
      createdAt: new Date().toISOString(),
    };
  }, [versions, selectedFileId]);

  const addVersion = useCallback((newVersion: Version, beforeData?: { columns: ColumnDef[]; rows: RowData[] }) => {
    setVersions(prev => {
      const next = [...prev, newVersion];
      if (next.length > MAX_VERSIONS) next.splice(0, next.length - MAX_VERSIONS);
      return next;
    });
    setCurrentVersionId(newVersion.id);
    setActiveTab('result');
    setResultKey(prev => prev + 1);
    if (beforeData) setBeforeDataRef(beforeData);
  }, []);

  const handleSelectVersion = useCallback((id: string) => {
    setCurrentVersionId(id);
    setActiveTab('result');
  }, []);

  const handleSetCurrentVersion = useCallback((id: string) => {
    setCurrentVersionId(id);
    setActiveTab('result');
  }, []);

  const handleDeleteVersion = useCallback((id: string) => {
    setVersions(prev => {
      const toDelete = new Set<string>();
      const collectDescendants = (vid: string) => {
        toDelete.add(vid);
        prev.filter(v => v.parentVersion === vid).forEach(v => collectDescendants(v.id));
      };
      collectDescendants(id);
      const remaining = prev.filter(v => !toDelete.has(v.id));
      if (currentVersionId && toDelete.has(currentVersionId)) {
        setCurrentVersionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
      return remaining;
    });
  }, [currentVersionId]);

  const handleUndo = useCallback(() => {
    setVersions(prev => {
      if (prev.length === 0) return prev;
      const remaining = prev.slice(0, -1);
      setCurrentVersionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      return remaining;
    });
  }, []);

  const handleReset = useCallback(() => {
    setVersions([]);
    setCurrentVersionId(null);
    setActiveTab('original');
    setBeforeDataRef(null);
    setResultKey(prev => prev + 1);
  }, []);

  const restoreVersion = useCallback((columns: ColumnDef[], rows: RowData[], action: string) => {
    const v = createVersion(action, {}, columns, rows, undefined);
    setVersions(prev => [...prev, v]);
    setCurrentVersionId(v.id);
    setActiveTab('result');
  }, [createVersion]);

  return {
    versions, currentVersion, currentVersionId, activeTab, hasVersions, resultKey, beforeDataRef,
    setVersions, setCurrentVersionId, setActiveTab,
    createVersion, addVersion,
    handleSelectVersion, handleSetCurrentVersion, handleDeleteVersion,
    handleUndo, handleReset, restoreVersion,
  };
}
