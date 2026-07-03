'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ColumnDef, RowData, WorkbenchFile, PlanStep, HistoryItem, ResultSummary, AuditReport, FixResult, CellHighlight, EditMode, QuickAction, StepStatus, Version, DataTab, PlanViewMode } from '@/lib/types';
import { runExecutionEngine, EngineRunResult } from '@/lib/execution-engine';
import { parseIntentWithAI, parseAndResolve } from '@/lib/nlu';
import { parseFile, exportToExcel } from '@/lib/file-engine';
import { runQualityCheck, type InferenceResult } from '@/lib/quality';
import { runAudit as auditEngine } from '@/lib/audit-engine';
import { mockFiles, quickActions, mockHistory } from '@/lib/mock-data';
import { getApiKey } from '@/lib/api-key';
import { loadFiles, saveFile, loadTaskFileIds, saveTaskFileIds, loadHistory, saveHistory } from '@/lib/db';
import { AmbiguityDetector } from '@/lib/ambiguity-detector';
import { onTraceUpdate, offTraceUpdate, type PipelineTrace } from '@/lib/pipeline-trace';

// Layout components
import TopBar from '@/components/layout/TopBar';
import LeftPanel from '@/components/layout/LeftPanel';
import MainPanel from '@/components/layout/MainPanel';
import RightPanel from '@/components/layout/RightPanel';
import BottomBar from '@/components/layout/BottomBar';

// Content components
import DataPreview from '@/components/workspace/DataPreview';
import ResultPreview from '@/components/workspace/ResultPreview';
import CompareView from '@/components/workspace/CompareView';
import ExecutionPlan from '@/components/taskpanel/ExecutionPlan';
import VersionTimeline from '@/components/version/VersionTimeline';
import OperationHistoryModal from '@/components/common/OperationHistoryModal';
import type { HistoryItemType } from '@/components/common/OperationHistoryModal';

// Dialogs
import ConfirmationDialog from '@/components/common/ConfirmationDialog';
import DataAudit from '@/components/taskpanel/DataAudit';
import EmptyState from '@/components/common/EmptyState';
import DebugTraceModal from '@/components/debug/DebugTraceModal';
import SettingsDialog from '@/components/common/SettingsDialog';

export default function Home() {
  // ── 文件状态 ────────────────────────────────────────────
  const [files, setFiles] = useState<WorkbenchFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [taskFileIds, setTaskFileIdsState] = useState<string[]>([]);

  // ── 唯一执行数据源（永远指向原始 sheet 数据，不指向任何版本数据）──
  const [activeDataset, setActiveDataset] = useState<{ columns: ColumnDef[]; rows: RowData[] } | null>(null);

  // ── AI 输入 ─────────────────────────────────────────────
  const [promptText, setPromptText] = useState('');
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

  // ── 执行状态 ────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<PlanStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── 版本管理（仅用于显示，不参与执行数据选择）───────────
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DataTab>('original');

  // ── 右侧面板 ────────────────────────────────────────────
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [planMode, setPlanMode] = useState<PlanViewMode>('human');

  // ── 历史记录 ────────────────────────────────────────────
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── 歧义确认对话框 ─────────────────────────────────────
  const [ambiguityReport, setAmbiguityReport] = useState<any>(null);
  const [planPreview, setPlanPreview] = useState<any>(null);
  const [pendingHistoryItem, setPendingHistoryItem] = useState<HistoryItem | null>(null);
  const [resolvedIntent, setResolvedIntent] = useState<any>(null);

  // ── 审计 ────────────────────────────────────────────────
  const [showAudit, setShowAudit] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [inferences, setInferences] = useState<InferenceResult[]>([]);

  // ── UI ──────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<EditMode>('locked');
  const [highlightCell, setHighlightCell] = useState<CellHighlight | null>(null);
  const [scrollToRow, setScrollToRow] = useState<number | null>(null);
  const [resultKey, setResultKey] = useState(0);

  // ── Debug ────────────────────────────────────────────────
  const [debugMode, setDebugMode] = useState(false);
  const [pipelineTrace, setPipelineTrace] = useState<PipelineTrace | null>(null);

  // ── API Key 强制配置 ───────────────────────────────────────
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const key = getApiKey();
    const hasKey = !!key && key.length > 10;
    setHasApiKey(hasKey);
    if (!hasKey) {
      // 延迟弹出，确保其他 UI 已渲染
      const timer = setTimeout(() => setShowApiKeyDialog(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    onTraceUpdate(setPipelineTrace);
    return () => offTraceUpdate();
  }, []);

  // ── 已解析数据 ──────────────────────────────────────────
  const beforeDataRef = useRef<{ columns: ColumnDef[]; rows: RowData[] } | null>(null);

  // ── 初始化 ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadFiles().catch(() => [] as WorkbenchFile[]),
      loadTaskFileIds().catch(() => [] as string[]),
      loadHistory().catch(() => [] as HistoryItem[]),
    ]).then(([savedFiles, savedIds, savedHistory]) => {
      if (cancelled) return;

      const allMap = new Map<string, WorkbenchFile>();
      for (const f of mockFiles) allMap.set(f.id, f);
      for (const f of savedFiles) if (f && f.id) allMap.set(f.id, f);
      const allFiles = Array.from(allMap.values());

      setFiles(allFiles.length > 0 ? allFiles : mockFiles);
      const validTaskIds = savedIds.filter(id => allFiles.some(f => f.id === id));
      setTaskFileIdsState(validTaskIds.length > 0 ? validTaskIds : []);
      setHistoryItems(savedHistory.length > 0 ? savedHistory : mockHistory);
      if (!selectedFileId && allFiles.length > 0) {
        setSelectedFileId(allFiles[0].id);
      }
    });

    return () => { cancelled = true; };
  }, []);

  // ── 选中文件变更时 ──────────────────────────────────────
  useEffect(() => {
    const f = files.find(x => x.id === selectedFileId);
    if (f && f.sheets.length > 0) {
      if (!activeSheet || !f.sheets.some(s => s.name === activeSheet)) {
        setActiveSheet(f.sheets[0].name);
      }
    }
  }, [selectedFileId, files]);

  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const currentSheet = selectedFile?.sheets.find(s => s.name === activeSheet) ?? null;

  // activeDataset 与 currentSheet 同步：选中文件/Sheet变化时自动更新
  useEffect(() => {
    if (currentSheet) {
      setActiveDataset({ columns: currentSheet.columns, rows: currentSheet.rows });
    } else {
      setActiveDataset(null);
    }
  }, [currentSheet]);

  // ── 当前选中版本的数据（仅用于显示，不参与执行逻辑）─────────
  const currentVersion = versions.find(v => v.id === currentVersionId) ?? null;
  const displayColumns = currentVersion ? currentVersion.columns : (activeDataset ? activeDataset.columns : []);
  const displayRows = currentVersion ? currentVersion.rows : (activeDataset ? activeDataset.rows : []);

  const hasResult = displayRows.length > 0 && currentVersion !== null;
  const hasVersions = versions.length > 0;

  // ── 上传文件 ────────────────────────────────────────────
  const handleAddFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const wf = await parseFile(file);
        setFiles(prev => {
          const updated = [...prev, wf];
          saveFile(wf).catch(() => {});
          return updated;
        });
        setSelectedFileId(wf.id);
        // 新文件 → 重置版本
        setVersions([]);
        setCurrentVersionId(null);
        setActiveTab('original');
      } catch (err) {
        setError('文件解析失败: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    input.click();
  }, []);

  // ── 删除文件 ────────────────────────────────────────────
  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setTaskFileIdsState(prev => prev.filter(x => x !== id));
    if (selectedFileId === id) {
      const next = files.find(f => f.id !== id);
      setSelectedFileId(next?.id ?? null);
      setVersions([]);
      setCurrentVersionId(null);
      setActiveTab('original');
    }
  }, [selectedFileId, files]);

  // ── 切换任务文件 ─────────────────────────────────────
  const handleAddToTask = useCallback((id: string) => {
    setTaskFileIdsState(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveTaskFileIds(next).catch(() => {});
      return next;
    });
  }, []);

  const handleClearTaskFiles = useCallback(() => {
    setTaskFileIdsState([]);
    saveTaskFileIds([]).catch(() => {});
  }, []);

  const handleRemoveTaskFile = useCallback((id: string) => {
    setTaskFileIdsState(prev => {
      const next = prev.filter(x => x !== id);
      saveTaskFileIds(next).catch(() => {});
      return next;
    });
  }, []);

  // ── 创建版本 ────────────────────────────────────────────
  const createVersion = useCallback((operation: string, plan: object, columns: ColumnDef[], rows: RowData[], parentId?: string): Version => {
    const existing = versions;
    const maxV = existing.length > 0 ? Math.max(...existing.map(v => v.version)) : 0;
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

  // ── 提交 AI 处理 ────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!promptText.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    setExecutionSteps([]);
    beforeDataRef.current = null;

    try {
      const mainFile = selectedFile;
      const dataset = activeDataset;

      if (!dataset) {
        setError('请先在左侧选择一个文件');
        setIsRunning(false);
        return;
      }

      const cols = dataset.columns;
      const fileNames = mainFile ? [mainFile.name] : [];

      // 补充任务文件列表中的文件名（用于匹配操作）
      const allFileNames = [...fileNames];
      if (taskFileIds.length > 0) {
        for (const tid of taskFileIds) {
          if (tid === selectedFileId) continue;
          const tf = files.find(f => f.id === tid);
          if (tf && !allFileNames.includes(tf.name)) allFileNames.push(tf.name);
        }
      }

      const result = await parseIntentWithAI(
        promptText,
        mainFile?.name ?? '',
        cols,
        dataset.rows,
        allFileNames
      );

      // ★ AI 额度/Key 无效 → 弹设置框
      if (!result.intent && !result.aiUsed && result.resolution?.message?.includes('API Key')) {
        setError(result.resolution.message);
        setShowApiKeyDialog(true);
        setIsRunning(false);
        return;
      }

      if (!result.intent || !result.intent.operation) {
        const fallback = parseAndResolve(promptText, cols, allFileNames, dataset.rows);
        if (fallback.intent?.operation) {
          result.intent = fallback.intent;
          result.resolution = fallback.resolution;
        }
      }

      if (!result.intent || !result.intent.operation) {
        setError('无法理解您的指令，请换个说法试试');
        setIsRunning(false);
        return;
      }

      const skipResolve = ['formula', 'update', 'pipeline'].includes(result.intent.operation);
      const ambResult = skipResolve ? null : AmbiguityDetector.detect(result.intent, result.resolution.candidates);
      if (ambResult) {
        const preview = AmbiguityDetector.buildPreviewPlan(result.intent, dataset.rows.length, 0);
        setAmbiguityReport(ambResult);
        setPlanPreview(preview);
        setResolvedIntent(result.intent);
        setIsRunning(false);
        return;
      }

      await executeIntent(result.intent, mainFile!, activeSheet, taskFileIds);
    } catch (err) {
      setError('处理出错: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRunning(false);
    }
  }, [promptText, isRunning, selectedFile, activeDataset, taskFileIds, files, activeSheet]);

  // ── 执行意图 ────────────────────────────────────────────
  const executeIntent = useCallback(async (
    intent: any,
    mainFile: WorkbenchFile,
    sheetName: string,
    taskFileIdsOverride?: string[],
  ) => {
    setIsRunning(true);
    setError(null);

    // 唯一执行数据源：activeDataset（快照化，深度隔离）
    const dataset = activeDataset;
    if (!dataset) {
      setError('没有可执行的数据');
      setIsRunning(false);
      return;
    }

    // 快照化执行输入（深度 copy，切断与 UI state 的所有引用）
    const snapColumns: ColumnDef[] = JSON.parse(JSON.stringify(dataset.columns));
    const snapRows: RowData[] = JSON.parse(JSON.stringify(dataset.rows));

    // 构建临时文件对象用于执行（基于快照）
    const execFile: WorkbenchFile = {
      ...mainFile,
      sheets: [{
        name: sheetName,
        columns: snapColumns,
        rows: snapRows,
      }],
    };

    // 构建任务文件列表（所有 taskFiles 也深拷贝）
    const selectedTaskFileIds = taskFileIdsOverride ?? taskFileIds;
    const taskFilesForExec: WorkbenchFile[] = [execFile];
    if (selectedTaskFileIds.length > 0) {
      for (const tid of selectedTaskFileIds) {
        if (tid === mainFile.id) continue;
        const tf = files.find(f => f.id === tid);
        if (tf && tf.sheets[0]) {
          taskFilesForExec.push({
            ...tf,
            sheets: [{
              name: tf.sheets[0].name,
              columns: JSON.parse(JSON.stringify(tf.sheets[0].columns)),
              rows: JSON.parse(JSON.stringify(tf.sheets[0].rows)),
            }],
          });
        }
      }
    }

    const engineResult: EngineRunResult = runExecutionEngine(intent, execFile, sheetName, taskFilesForExec);

    const waitingSteps = engineResult.steps.map(s => ({
      ...s,
      status: 'waiting' as StepStatus,
      subItems: undefined,
    }));
    setExecutionSteps(waitingSteps);

    // 有步骤才播动画（否则跳过）
    if (engineResult.steps.length > 0) {
      await new Promise(r => setTimeout(r, 100));
      for (const finalStep of engineResult.steps) {
        setExecutionSteps(prev => prev.map(s =>
          s.id === finalStep.id ? { ...finalStep, status: 'executing' as StepStatus, subItems: undefined } : s
        ));
        await new Promise(r => setTimeout(r, 480));
        setExecutionSteps(prev => prev.map(s =>
          s.id === finalStep.id ? finalStep : s
        ));
        await new Promise(r => setTimeout(r, 180));
      }
    }

    if (engineResult.success && engineResult.resultData) {
      // 结果深拷贝
      const resultColumns: ColumnDef[] = JSON.parse(JSON.stringify(engineResult.resultData.columns));
      const resultRows: RowData[] = JSON.parse(JSON.stringify(engineResult.resultData.rows));

      // 创建版本（基于 clone 后的结果）
      const newVersion = createVersion(
        promptText,
        intent,
        resultColumns,
        resultRows,
        undefined
      );

      setVersions(prev => {
        const next = [...prev, newVersion];
        if (next.length > 20) next.splice(0, next.length - 20);
        return next;
      });
      // 只切换显示，不改变执行数据源
      setCurrentVersionId(newVersion.id);
      setActiveTab('result');
      setResultKey(prev => prev + 1);
      beforeDataRef.current = { columns: snapColumns, rows: snapRows };

      // 记录历史（结果已深拷贝）
      const historyItem: HistoryItem = {
        id: 'h-' + Date.now(),
        action: promptText,
        timestamp: new Date().toISOString(),
        targetFiles: mainFile ? [mainFile.name] : [],
        resultData: { columns: resultColumns, rows: resultRows },
        resultSummary: engineResult.resultSummary ?? undefined,
      };
      setHistoryItems(prev => {
        const next = [historyItem, ...prev].slice(0, 50);
        saveHistory(next).catch(() => {});
        return next;
      });
    } else {
      setError(engineResult.error || '执行失败');
    }

    setIsRunning(false);
  }, [promptText, activeDataset, taskFileIds, files, createVersion]);

  // ── 版本操作（仅管理显示和历史，不影响执行数据源）─────────
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
    if (!hasResult) setActiveTab('original');
  }, [hasResult]);

  const handleReset = useCallback(() => {
    setVersions([]);
    setCurrentVersionId(null);
    setActiveTab('original');
    setExecutionSteps([]);
    setError(null);
    setResultKey(prev => prev + 1);
  }, []);

  // ── 确认歧义对话框 ──────────────────────────────────────
  const handleConfirmAmbiguity = useCallback((selections: any) => {
    if (!resolvedIntent) return;
    const mainFile = selectedFile;
    if (!mainFile || !currentSheet) return;

    if (selections?.selectedColumns?.length > 0) {
      resolvedIntent.resolvedColumns = selections.selectedColumns.map((c: any) => ({
        key: c.key,
        title: c.title,
        confidence: c.confidence,
        matchMethod: c.matchMethod,
      }));
    }

    executeIntent(resolvedIntent, mainFile, currentSheet.name);
    setAmbiguityReport(null);
    setPlanPreview(null);
  }, [resolvedIntent, selectedFile, currentSheet, executeIntent]);

  const handleCancelAmbiguity = useCallback(() => {
    setAmbiguityReport(null);
    setPlanPreview(null);
    setResolvedIntent(null);
  }, []);

  const handleModifyPrompt = useCallback(() => {
    setAmbiguityReport(null);
    setPlanPreview(null);
    setResolvedIntent(null);
  }, []);

  // ── 快捷操作 ────────────────────────────────────────────
  const handleQuickAction = useCallback((action: QuickAction) => {
    setPromptText(action.prompt);
    setActiveQuickAction(action.id);
    setTimeout(() => setActiveQuickAction(null), 500);
  }, []);

  // ── 导出 ────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (displayColumns.length === 0 || displayRows.length === 0) return;
    const name = selectedFile?.name?.replace(/\.xlsx?$/, '') ?? '导出';
    await exportToExcel([{ name: '结果', columns: displayColumns, rows: displayRows }], name + '_处理结果');
  }, [displayColumns, displayRows, selectedFile]);

  // ── 历史记录点击 ────────────────────────────────────────
  const handleHistoryClick = useCallback((item: HistoryItemType) => {
    if (!item.resultData) return;
    // 从历史记录创建临时版本
    const v = createVersion(
      item.action,
      {},
      item.resultData.columns,
      item.resultData.rows,
      undefined
    );
    setVersions(prev => [...prev, v]);
    setCurrentVersionId(v.id);
    setActiveTab('result');
    setShowHistory(false);
  }, [createVersion]);

  // ── 审计 ────────────────────────────────────────────────
  const handleAuditStart = useCallback(() => {
    if (!currentSheet) return;
    setInferences(runQualityCheck(currentSheet.rows, currentSheet.columns).inferences);
    setShowAudit(true);
  }, [currentSheet]);

  const handleAuditFix = useCallback((fixType: string, fixResults: FixResult[], fixedRows?: RowData[], fixedColumns?: ColumnDef[]) => {
    if (fixedRows && fixedColumns) {
      const v = createVersion('数据修复', { fixType }, fixedColumns, fixedRows, currentVersionId || undefined);
      setVersions(prev => [...prev, v]);
      setCurrentVersionId(v.id);
      setActiveTab('result');
      setShowAudit(false);
    }
  }, [createVersion, currentVersionId]);

  const handleReAudit = useCallback(() => {
    if (!currentSheet) return;
    setInferences(runQualityCheck(currentSheet.rows, currentSheet.columns).inferences);
  }, [currentSheet]);

  const runAuditFn = useCallback(() => {
    if (!currentSheet) return { stats: { totalRows: 0, totalCols: 0, blankCells: 0, blankRows: 0, numericCols: 0, textCols: 0, dateCols: 0 }, duplicates: [], nulls: [], anomalies: [], qualityScore: 0, qualityGrade: 'N/A', suggestions: [] };
    return auditEngine(currentSheet.rows, currentSheet.columns);
  }, [currentSheet]);

  // ── 单元格编辑 ──────────────────────────────────────────
  const handleCellEdit = useCallback((rowIndex: number, colKey: string, newValue: string) => {
    setVersions(prev => prev.map(v =>
      v.id === currentVersionId
        ? { ...v, rows: v.rows.map((r, ri) => ri === rowIndex ? { ...r, [colKey]: newValue } : r) }
        : v
    ));
  }, [currentVersionId]);

  // ── 上下文信息 ──────────────────────────────────────────
  const contextInfo = selectedFile
    ? `v${currentVersion?.version ?? 0} · 来源：${selectedFile.name} · ${displayRows.length}行×${displayColumns.length}列`
    : undefined;
  const statusBarText = currentVersion
    ? `当前显示：v${currentVersion.version} ${currentVersion.operation} · ${displayRows.length}行×${displayColumns.length}列`
    : (selectedFile ? `原始数据 · ${displayRows.length}行×${displayColumns.length}列` : undefined);

  // ── 渲染 ────────────────────────────────────────────────
  const taskFileItems = taskFileIds.map(id => {
    const f = files.find(x => x.id === id);
    return f ? { id: f.id, name: f.name, icon: f.icon } : null;
  }).filter(Boolean) as { id: string; name: string; icon: string }[];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-50">
      {/* 顶部栏 */}
      <TopBar
        fileName={selectedFile && activeSheet ? `${selectedFile.name} — ${activeSheet}` : selectedFile?.name}
        versionLabel={currentVersion ? `版本 v${currentVersion.version}` : undefined}
        debugMode={debugMode}
        onToggleDebug={() => setDebugMode(prev => !prev)}
      />

      {/* Debug toggle — not needed here anymore, shown via DebugTraceModal */}

      {/* 主体区域 */}
      <div className="flex flex-1 min-h-0">
        {/* 左栏 */}
        <LeftPanel
          files={files}
          selectedFileId={selectedFileId}
          selectedSheet={activeSheet}
          taskFileIds={taskFileIds}
          onSelectFile={(id, sheet) => {
            setSelectedFileId(id);
            if (sheet) {
              setActiveSheet(sheet);
            } else {
              const f = files.find(x => x.id === id);
              if (f && !f.sheets.some(s => s.name === activeSheet)) {
                setActiveSheet(f.sheets[0]?.name ?? '');
              }
            }
            setVersions([]);
            setCurrentVersionId(null);
            setActiveTab('original');
          }}
          onAddFile={handleAddFile}
          onRemoveFile={handleRemoveFile}
          onAddToTask={handleAddToTask}
          versions={versions}
          currentVersionId={currentVersionId}
          onSelectVersion={handleSelectVersion}
          onOpenHistory={() => setShowHistory(true)}
        />

        {/* 中间预览区 */}
        <MainPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasResult={hasVersions}
          statusBar={statusBarText}
          bottomBar={
            <BottomBar
              promptText={promptText}
              onPromptChange={setPromptText}
              onSubmit={handleSubmit}
              isRunning={isRunning}
              onUndo={handleUndo}
              onReset={handleReset}
              quickActions={quickActions}
              activeQuickAction={activeQuickAction}
              onQuickAction={handleQuickAction}
              contextInfo={contextInfo}
              canUndo={hasVersions}
              hasVersions={hasVersions}
              taskFileItems={taskFileItems}
              onRemoveTaskFile={handleRemoveTaskFile}
              onClearTaskFiles={handleClearTaskFiles}
            />
          }
        >
          {activeTab === 'original' && (
            currentSheet && selectedFile ? (
              <DataPreview
                fileName={selectedFile.name}
                fileIcon={selectedFile.icon}
                sheets={selectedFile.sheets}
                activeSheet={activeSheet}
                onSheetChange={setActiveSheet}
                onAudit={handleAuditStart}
                editMode={editMode}
                onToggleEditMode={() => setEditMode(prev => prev === 'locked' ? 'editing' : 'locked')}
                highlightCell={highlightCell}
                onCellEdit={handleCellEdit}
                scrollToRow={scrollToRow}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState icon="📂" title="选择一个文件开始处理" description="从左侧文件池中选择一个文件，或者上传新的 Excel 文件" />
              </div>
            )
          )}

          {activeTab === 'result' && (
            <ResultPreview
              columns={displayColumns}
              rows={displayRows}
              summary={currentVersion ? {
                totalRecords: displayRows.length,
                beforeCount: currentVersion.parentVersion
                  ? versions.find(v => v.id === currentVersion.parentVersion)?.rows.length
                  : undefined,
                afterCount: displayRows.length,
              } : null}
              showDiff={false}
              onToggleDiff={() => setActiveTab('compare')}
              beforeData={beforeDataRef.current}
              onExport={handleExport}
              resetKey={resultKey}
              error={error}
              isRunning={isRunning}
            />
          )}

          {activeTab === 'compare' && currentSheet && (
            <CompareView
              leftLabel="原始数据"
              rightLabel={currentVersion ? `v${currentVersion.version} 结果` : '处理结果'}
              leftColumns={currentSheet.columns}
              leftRows={currentSheet.rows}
              rightColumns={displayColumns}
              rightRows={displayRows}
            />
          )}
        </MainPanel>

        {/* 右侧面板 */}
        <RightPanel
          isCollapsed={rightPanelCollapsed}
          onToggle={() => setRightPanelCollapsed(prev => !prev)}
          planMode={planMode}
          onPlanModeChange={setPlanMode}
        >
          <ExecutionPlan steps={executionSteps} viewMode={planMode} taskFiles={taskFileItems} />
          <VersionTimeline
            versions={versions}
            currentVersionId={currentVersionId}
            onSelectVersion={handleSelectVersion}
            onSetCurrent={handleSetCurrentVersion}
            onDeleteVersion={handleDeleteVersion}
          />
        </RightPanel>
      </div>

      {/* 操作历史弹窗 */}
      {showHistory && (
        <OperationHistoryModal
          history={historyItems}
          onClose={() => setShowHistory(false)}
          onItemClick={handleHistoryClick}
        />
      )}

      {/* 歧义确认对话框 */}
      {ambiguityReport && planPreview && currentSheet && (
        <ConfirmationDialog
          ambiguity={ambiguityReport}
          planPreview={planPreview}
          availableColumns={currentSheet.columns}
          onConfirm={handleConfirmAmbiguity}
          onCancel={handleCancelAmbiguity}
          onModifyPrompt={handleModifyPrompt}
        />
      )}

      {/* 数据审计对话框 */}
      {showAudit && currentSheet && (
        <DataAudit
          onClose={() => setShowAudit(false)}
          onFix={handleAuditFix}
          onReAudit={handleReAudit}
          runAuditFn={runAuditFn}
          rows={currentSheet.rows}
          columns={currentSheet.columns}
          inferences={inferences}
        />
      )}

      {/* Debug mode: Pipeline Trace modal */}
      {debugMode && pipelineTrace && (
        <DebugTraceModal trace={pipelineTrace} onClose={() => setDebugMode(false)} />
      )}

      {/* API Key 强制配置弹窗 */}
      {showApiKeyDialog && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-[400px] max-w-[90vw] p-6">
            <h3 className="text-base font-semibold text-zinc-800 mb-2">配置 DeepSeek API Key</h3>
            <p className="text-sm text-zinc-500 mb-4">首次使用需要配置 API Key，请前往 <span className="font-mono text-zinc-600">platform.deepseek.com</span> 获取。</p>
            <SettingsDialog onClose={() => {
              const key = getApiKey();
              if (key && key.length > 10) {
                setHasApiKey(true);
                setShowApiKeyDialog(false);
              }
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
