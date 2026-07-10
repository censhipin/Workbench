'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ColumnDef, RowData, WorkbenchFile, PlanStep, HistoryItem, ResultSummary, AuditReport, FixResult, CellHighlight, EditMode, QuickAction, StepStatus, Version, DataTab, TaskSheetRef } from '@/lib/types';
import type { ExecutionExplanation } from '@/lib/v3/explain';
import { runQualityCheck, type InferenceResult } from '@/lib/quality';
import { runAudit as auditEngine } from '@/lib/audit-engine';
import { mockFiles, quickActions, mockHistory } from '@/lib/mock-data';
import { loadFiles, saveFile, loadTaskFileIds, saveTaskFileIds, loadHistory } from '@/lib/db';
import { onTraceUpdate, offTraceUpdate, type PipelineTrace } from '@/lib/pipeline-trace';

// Controllers
import { useExecutionController } from '@/lib/v3/controllers/useExecutionController';
import { useVersionController } from '@/lib/v3/controllers/useVersionController';
import { useHistoryController } from '@/lib/v3/controllers/useHistoryController';
import { useExportController } from '@/lib/v3/controllers/useExportController';
import { useDialogController } from '@/lib/v3/controllers/useDialogController';

// Layout
import TopBar from '@/components/layout/TopBar';
import LeftPanel from '@/components/layout/LeftPanel';
import MainPanel from '@/components/layout/MainPanel';
import RightPanel from '@/components/layout/RightPanel';
import BottomBar from '@/components/layout/BottomBar';

// Content
import DataPreview from '@/components/workspace/DataPreview';
import ResultPreview from '@/components/workspace/ResultPreview';
import CompareView from '@/components/workspace/CompareView';
import VersionTimeline from '@/components/version/VersionTimeline';
import OperationHistoryModal from '@/components/common/OperationHistoryModal';
import type { HistoryItemType } from '@/components/common/OperationHistoryModal';

// Workbench V3 components
import WorkbenchPanel from '@/components/workbench/WorkbenchPanel';
import ExecutionCenter from '@/components/workbench/ExecutionCenter';
import ExplanationPanel from '@/components/workbench/ExplanationPanel';
import RepairPanel from '@/components/workbench/RepairPanel';
import VerificationPanel from '@/components/workbench/VerificationPanel';
import QualityPanel from '@/components/workbench/QualityPanel';
import ExecutionTimeline from '@/components/workbench/ExecutionTimeline';
import DataProfilePanel from '@/components/workbench/DataProfilePanel';
import ErrorDialogV3 from '@/components/workbench/ErrorDialogV3';
import PerformanceMonitor from '@/components/workbench/PerformanceMonitor';

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
  const [taskSheets, setTaskSheetsState] = useState<TaskSheetRef[]>([]);
  const [activeDataset, setActiveDataset] = useState<{ columns: ColumnDef[]; rows: RowData[] } | null>(null);
  const [promptText, setPromptText] = useState('');
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);

  // ── 右侧面板 ────────────────────────────────────────────
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // ── UI ──────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<EditMode>('locked');
  const [arrangeMode, setArrangeMode] = useState(false);
  const [highlightCell, setHighlightCell] = useState<CellHighlight | null>(null);
  const [scrollToRow, setScrollToRow] = useState<number | null>(null);

  // ── 审计 ────────────────────────────────────────────────
  const [inferences, setInferences] = useState<InferenceResult[]>([]);

  // ── 审计引导弹窗（检测/检查类指令时弹出） ────────────
  const [showAuditGuide, setShowAuditGuide] = useState(false);
  const [auditGuidePrompt, setAuditGuidePrompt] = useState('');

  // ── Pipeline Trace ──────────────────────────────────────
  const [pipelineTrace, setPipelineTrace] = useState<PipelineTrace | null>(null);

  // ── 引用 ────────────────────────────────────────────────
  const selectedFile = files.find(f => f.id === selectedFileId) ?? null;
  const currentSheet = selectedFile?.sheets.find(s => s.name === activeSheet) ?? null;

  // ── 对话框状态 ──────────────────────────────────────────
  const {
    showAudit, setShowAudit,
    showApiKeyDialog, setShowApiKeyDialog,
    apiKeyMode, setApiKeyMode,
    errorDialog, setErrorDialog,
    debugMode, setDebugMode,
    dismissError,
  } = useDialogController();

  // ── 版本管理 ────────────────────────────────────────────
  const {
    versions, currentVersion, currentVersionId, activeTab, hasVersions, resultKey, beforeDataRef,
    setVersions, setCurrentVersionId, setActiveTab,
    addVersion, createVersion,
    handleSelectVersion, handleSetCurrentVersion, handleDeleteVersion,
    handleUndo, handleReset, restoreVersion,
  } = useVersionController(selectedFileId);

  // ── 历史管理 ────────────────────────────────────────────
  const {
    historyItems, showHistory,
    setShowHistory, addHistoryItem, setHistoryItemsBulk, handleHistoryClick,
  } = useHistoryController(restoreVersion);

  // ── 执行控制器 ──────────────────────────────────────────
  const onErrorCallback = useCallback((e: string | null) => {
    setErrorDialog(e);
  }, []);
  const onExplanationCallback = useCallback((e: ExecutionExplanation | null) => {
    // could also update a shared store
  }, []);
  const onVersionCreated = useCallback((columns: ColumnDef[], rows: RowData[], intent: any) => {
    const parentId = currentVersionId || undefined;
    const newVersion = createVersion(promptText, intent, columns, rows, parentId);
    addVersion(newVersion, { columns: structuredClone(activeDataset?.columns ?? []), rows: structuredClone(activeDataset?.rows ?? []) });
    // 切换到新版本数据，后续操作在该结果上执行
    setActiveDataset({ columns, rows });
  }, [promptText, createVersion, addVersion, activeDataset, currentVersionId, setActiveDataset]);
  const onHistoryAdded = useCallback((item: HistoryItem) => {
    addHistoryItem(item);
  }, [addHistoryItem]);

  const {
    isRunning, executionSteps, error, currentExplanation,
    ambiguityReport, planPreview, resolvedIntent,
    setExecutionSteps,
    handleSubmit, executeIntent,
    handleConfirmAmbiguity, handleCancelAmbiguity, handleModifyPrompt,
  } = useExecutionController(
    onErrorCallback, onExplanationCallback, onVersionCreated, onHistoryAdded,
    activeDataset, selectedFile, activeSheet, taskSheets, files, promptText,
    setApiKeyMode, setShowApiKeyDialog,
  );

  // ── Workflow 版本选择/切换 ────────────────────────────
  const handleSelectRawData = useCallback(() => {
    setCurrentVersionId(null);
    if (currentSheet) {
      setActiveDataset({ columns: currentSheet.columns, rows: currentSheet.rows });
    }
    setActiveTab('original');
  }, [currentSheet, setCurrentVersionId, setActiveDataset, setActiveTab]);

  const wrappedHandleSelectVersion = useCallback((id: string) => {
    handleSelectVersion(id);
    const v = versions.find(x => x.id === id);
    if (v) setActiveDataset({ columns: v.columns, rows: v.rows });
  }, [handleSelectVersion, versions, setActiveDataset]);
  const { handleExport } = useExportController();

  // ── 显示数据 ────────────────────────────────────────────
  const displayColumns = currentVersion ? currentVersion.columns : (activeDataset ? activeDataset.columns : []);
  const displayRows = currentVersion ? currentVersion.rows : (activeDataset ? activeDataset.rows : []);

  // ── Error → errorDialog 同步 ────────────────────────────
  useEffect(() => {
    if (error) setErrorDialog(error);
  }, [error, setErrorDialog]);

  // ── Pipeline Trace ──────────────────────────────────────
  useEffect(() => {
    onTraceUpdate(setPipelineTrace);
    return () => offTraceUpdate();
  }, []);

  // ── 初始化 ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadFiles().catch(() => [] as WorkbenchFile[]),
      loadTaskFileIds().catch(() => [] as TaskSheetRef[]),
      loadHistory().catch(() => [] as HistoryItem[]),
    ]).then(([savedFiles, savedIds, savedHistory]) => {
      if (cancelled) return;
      // 有保存的文件时优先使用，无保存文件时用 mock 数据作为首次体验回退
      const hasSavedFiles = savedFiles.some(f => f && f.id);
      const allFiles = hasSavedFiles ? savedFiles.filter(f => f && f.id) : mockFiles;
      setFiles(allFiles);
      const validTaskIds = hasSavedFiles ? savedIds.filter(s => allFiles.some(f => f.id === s.fileId && f.sheets.some(sh => sh.name === s.sheetName))) : [];
      setTaskSheetsState(validTaskIds);
      setHistoryItemsBulk(savedHistory.length > 0 ? savedHistory : (hasSavedFiles ? [] : mockHistory));
      if (!selectedFileId && allFiles.length > 0) {
        setSelectedFileId(allFiles[0].id);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // ── 文件选中同步 ────────────────────────────────────────
  useEffect(() => {
    const f = files.find(x => x.id === selectedFileId);
    if (f && f.sheets.length > 0) {
      if (!activeSheet || !f.sheets.some(s => s.name === activeSheet)) {
        setActiveSheet(f.sheets[0].name);
      }
    }
  }, [selectedFileId, files]);

  useEffect(() => {
    if (currentSheet) {
      setActiveDataset({ columns: currentSheet.columns, rows: currentSheet.rows });
    } else {
      setActiveDataset(null);
    }
  }, [currentSheet]);

  // ── 文件操作 ────────────────────────────────────────────
  const handleAddFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const { parseFile } = await import('@/lib/file-engine');
        const wf = await parseFile(file);
        setFiles(prev => { saveFile(wf).catch(() => {}); return [...prev, wf]; });
        setSelectedFileId(wf.id);
        handleReset();
      } catch (err) {
        setErrorDialog('文件解析失败: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    input.click();
  }, [handleReset, setErrorDialog]);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setTaskSheetsState(prev => prev.filter(x => x.fileId !== id));
    if (selectedFileId === id) {
      const next = files.find(f => f.id !== id);
      setSelectedFileId(next?.id ?? null);
      handleReset();
    }
  }, [selectedFileId, files, handleReset]);

  const handleAddToTask = useCallback((fileId: string, sheetName: string) => {
    const ref: TaskSheetRef = { fileId, sheetName };
    setTaskSheetsState(prev => {
      const exists = prev.some(t => t.fileId === fileId && t.sheetName === sheetName);
      const next = exists ? prev.filter(t => t.fileId !== fileId || t.sheetName !== sheetName) : [...prev, ref];
      saveTaskFileIds(next).catch(() => {});
      return next;
    });
  }, []);

  const handleClearTaskFiles = useCallback(() => {
    setTaskSheetsState([]);
    saveTaskFileIds([]).catch(() => {});
  }, []);

  const handleRemoveTaskFile = useCallback((fileId: string, sheetName: string) => {
    setTaskSheetsState(prev => {
      const next = prev.filter(t => t.fileId !== fileId || t.sheetName !== sheetName);
      saveTaskFileIds(next).catch(() => {});
      return next;
    });
  }, []);

  // ── 快捷操作 ────────────────────────────────────────────
  const handleQuickAction = useCallback((action: QuickAction) => {
    setPromptText(action.prompt);
    setActiveQuickAction(action.id);
    setTimeout(() => setActiveQuickAction(null), 500);
  }, []);

  // ── 单元格编辑 ──────────────────────────────────────────
  const handleCellEdit = useCallback((rowIndex: number, colKey: string, newValue: string) => {
    // 更新底层文件 Sheet 数据，确保切换 Tab / Sheet / 刷新后仍保持
    setFiles(prev => {
      const newFiles = prev.map(f =>
        f.id === selectedFileId
          ? {
              ...f,
              sheets: f.sheets.map(s =>
                s.name === activeSheet
                  ? { ...s, rows: s.rows.map((r, ri) => ri === rowIndex ? { ...r, [colKey]: newValue } : r) }
                  : s
              )
            }
          : f
      );
      const updated = newFiles.find(f => f.id === selectedFileId);
      if (updated) { import('@/lib/db').then(({ saveFile }) => saveFile(updated).catch(() => {})); }
      return newFiles;
    });
    // 同时更新当前 Version（如果有）使结果 Tab 也能看到编辑
    setVersions(prev => prev.map(v =>
      v.id === currentVersionId
        ? { ...v, rows: v.rows.map((r, ri) => ri === rowIndex ? { ...r, [colKey]: newValue } : r) }
        : v
    ));
  }, [selectedFileId, activeSheet, currentVersionId, setVersions]);

  // ── 审计 ────────────────────────────────────────────────
  const handleAuditStart = useCallback(() => {
    if (!currentSheet) return;
    const { getApiKey } = require('@/lib/api-key');
    const existingKey = getApiKey();
    if (!existingKey || existingKey.length < 10) {
      setApiKeyMode('audit');
      setShowApiKeyDialog(true);
      return;
    }
    setInferences(runQualityCheck(currentSheet.rows, currentSheet.columns).inferences);
    setShowAudit(true);
  }, [currentSheet, setApiKeyMode, setShowApiKeyDialog]);

  const handleAuditFix = useCallback((fixType: string, fixResults: FixResult[], fixedRows?: RowData[], fixedColumns?: ColumnDef[]) => {
    if (fixedRows && fixedColumns) {
      const v = createVersion('数据修复', { fixType }, fixedColumns, fixedRows, currentVersionId || undefined);
      setVersions(prev => [...prev, v]);
      setCurrentVersionId(v.id);
      setActiveTab('result');
      setShowAudit(false);
    }
  }, [createVersion, currentVersionId, setVersions, setCurrentVersionId, setActiveTab]);

  const handleReAudit = useCallback(() => {
    if (!currentSheet) return;
    setInferences(runQualityCheck(currentSheet.rows, currentSheet.columns).inferences);
  }, [currentSheet]);

  const runAuditFn = useCallback(() => {
    if (!currentSheet) return { stats: { totalRows: 0, totalCols: 0, blankCells: 0, blankRows: 0, numericCols: 0, textCols: 0, dateCols: 0 }, duplicates: [], nulls: [], anomalies: [], qualityScore: 0, qualityGrade: 'N/A', suggestions: [] };
    return auditEngine(currentSheet.rows, currentSheet.columns);
  }, [currentSheet]);

  // ── 审计引导弹窗 ──────────────────────────────────
  const handleAuditGuideCancel = useCallback(() => {
    setShowAuditGuide(false);
    setAuditGuidePrompt('');
  }, []);

  const handleAuditGuideGo = useCallback(() => {
    setShowAuditGuide(false);
    setAuditGuidePrompt('');
    if (!currentSheet) return;
    const { getApiKey } = require('@/lib/api-key');
    const existingKey = getApiKey();
    if (!existingKey || existingKey.length < 10) {
      setApiKeyMode('audit');
      setShowApiKeyDialog(true);
      return;
    }
    setInferences(runQualityCheck(currentSheet.rows, currentSheet.columns).inferences);
    setShowAudit(true);
  }, [currentSheet, setApiKeyMode, setShowApiKeyDialog]);

  // 检测/检查类指令拦截 → 弹出审计引导，不走执行
  const AUDIT_TRIGGERS = [
    /^(?:检查|检测|审阅|查看|找|看|查一查|查一下|看看)/,   // 动作开头
    /(?:空值|缺失|缺少|空白|没填)/,                        // 空值相关
    // 格式相关需搭配检测动词，避免列名中含格式词（如"入职日期"）误触发
    /(?:检查|检测|审阅|查看|看).{0,20}(?:格式|手机号|身份证|邮箱|邮件|电话|日期|金额)/,
    /(?:重复|异常|错误|不对|有误|有问题|无效)/,           // 问题相关
    /(?:质量|质量检查|数据质量|完整性|规范性)/,           // 质量相关
  ];
  const handleSubmitWrapper = useCallback(() => {
    const lower = promptText.trim().toLowerCase();
    const isAuditRequest = AUDIT_TRIGGERS.some(re => re.test(lower));
    if (isAuditRequest && currentSheet) {
      setAuditGuidePrompt(promptText.trim());
      setShowAuditGuide(true);
      return;
    }
    handleSubmit();
  }, [promptText, currentSheet, handleSubmit]);

  // ── 上下文信息 ──────────────────────────────────────────
  const contextInfo = selectedFile
    ? `v${currentVersion?.label ?? 0} · 来源：${selectedFile.name} · ${displayRows.length}行×${displayColumns.length}列`
    : undefined;
  const statusBarText = currentVersion
    ? `当前显示：v${currentVersion.label} ${currentVersion.operation} · ${displayRows.length}行×${displayColumns.length}列`
    : (selectedFile ? `原始数据 · ${displayRows.length}行×${displayColumns.length}列` : undefined);

  const taskFileItems = taskSheets.map(ref => {
    const f = files.find(x => x.id === ref.fileId);
    return f ? { id: ref.fileId, name: f.name, icon: f.icon, sheet: ref.sheetName } : null;
  }).filter(Boolean) as { id: string; name: string; icon: string; sheet: string }[];

  // ── 模拟数据（用于 Workbench 面板展示）─────────────────
  const qualityData = currentSheet ? {
    rowCount: currentSheet.rows.length,
    columnCount: currentSheet.columns.length,
    nullRate: 0,
    duplicateRate: 0,
    suggestions: 0,
    columns: currentSheet.columns.map(c => ({
      columnKey: c.key, title: c.title ?? c.key, type: c.type,
      nullRate: 0, uniqueRate: 1, nullCount: 0,
    })),
  } : null;

  const perfData = currentExplanation ? [
    { stage: 'NLU' as const, durationMs: 120, label: 'AI 解析' },
    { stage: 'Execute' as const, durationMs: 300, label: '执行' },
  ] : [];

  // ── 渲染 ────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-50">
      {/* 顶部栏 */}
      <TopBar
        fileName={selectedFile && activeSheet ? `${selectedFile.name} — ${activeSheet}` : selectedFile?.name}
        versionLabel={currentVersion ? `版本 v${currentVersion.label}` : undefined}
        debugMode={debugMode}
        onToggleDebug={() => setDebugMode(prev => !prev)}
        onOpenSettings={() => { setApiKeyMode('settings'); setShowApiKeyDialog(true); }}
      />

      {/* 主体区域 */}
      <div className="flex flex-1 min-h-0">
        {/* 左栏 */}
        <LeftPanel
          files={files}
          selectedFileId={selectedFileId}
          selectedSheet={activeSheet}
          taskSheets={taskSheets}
          onSelectFile={(id, sheet) => {
            setSelectedFileId(id);
            if (sheet) setActiveSheet(sheet);
            else { const f = files.find(x => x.id === id); if (f && !f.sheets.some(s => s.name === activeSheet)) setActiveSheet(f.sheets[0]?.name ?? ''); }
            handleReset();
          }}
          onAddFile={handleAddFile}
          onRemoveFile={handleRemoveFile}
          onAddToTask={(fileId, sheetName) => handleAddToTask(fileId, sheetName)}
          versions={versions}
          currentVersionId={currentVersionId}
          onSelectVersion={wrappedHandleSelectVersion}
          onSelectRawData={handleSelectRawData}
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
              onSubmit={handleSubmitWrapper}
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
                selectedFileId={selectedFile.id}
                taskSheets={taskSheets}
                onAddToTask={handleAddToTask}
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
              beforeData={beforeDataRef}
              onExport={() => handleExport(displayColumns, displayRows, selectedFile)}
              resetKey={resultKey}
              error={error}
              isRunning={isRunning}
              arrangeMode={arrangeMode}
              onToggleArrange={() => setArrangeMode(prev => !prev)}
            />
          )}

          {activeTab === 'compare' && currentSheet && (
            <CompareView
              leftLabel="原始数据"
              rightLabel={currentVersion ? `v${currentVersion.label} 结果` : '处理结果'}
              leftColumns={currentSheet.columns}
              leftRows={currentSheet.rows}
              rightColumns={displayColumns}
              rightRows={displayRows}
            />
          )}
        </MainPanel>

        {/* 右侧面板 — Workbench V3 集成 */}
        <RightPanel
          isCollapsed={rightPanelCollapsed}
          onToggle={() => setRightPanelCollapsed(prev => !prev)}
        >
          {/* Execution Center — 执行进度 */}
          <WorkbenchPanel title="执行中心" icon="⚡">
            <ExecutionCenter steps={executionSteps} isRunning={isRunning} />
          </WorkbenchPanel>

          {/* Explanation Panel — 智能解释 */}
          <WorkbenchPanel title="执行解释" icon="💡">
            <ExplanationPanel explanation={currentExplanation} />
          </WorkbenchPanel>

          {/* Verification Panel — 验证结果 */}
          {(currentExplanation && currentExplanation.warnings.length > 0) && (
            <WorkbenchPanel title="验证结果" icon="🔬">
              <VerificationPanel
                passed={currentExplanation.warnings.length === 0}
                confidence={0.9}
                checks={currentExplanation.warnings.map(w => ({ name: '检查项', passed: false, detail: w }))}
              />
            </WorkbenchPanel>
          )}

          {/* Performance Monitor — 性能数据 */}
          {perfData.length > 0 && (
            <WorkbenchPanel title="性能监控" icon="⏱">
              <PerformanceMonitor entries={perfData} totalDuration={perfData.reduce((s, e) => s + e.durationMs, 0)} />
            </WorkbenchPanel>
          )}

          {/* Version Timeline */}
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

      {/* 审计引导弹窗 */}
      {showAuditGuide && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={handleAuditGuideCancel}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 w-[400px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-800">数据检测</h3>
              </div>
              <p className="text-xs text-zinc-600 mt-3 ml-10 leading-relaxed">
                检测、检查类操作将跳转到数据检测功能查看详情，不会直接修改数据。
              </p>
              {auditGuidePrompt && (
                <div className="mt-2 ml-10">
                  <span className="text-[11px] text-zinc-400">你输入了: </span>
                  <span className="text-[11px] font-medium text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
                    {auditGuidePrompt}
                  </span>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
              <button
                onClick={handleAuditGuideCancel}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAuditGuideGo}
                className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                去检测
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug mode: Pipeline Trace */}
      {debugMode && pipelineTrace && (
        <DebugTraceModal trace={pipelineTrace} onClose={() => setDebugMode(false)} />
      )}

      {/* 错误弹窗 — 使用 ErrorDialogV3 */}
      {errorDialog && currentExplanation && (
        <ErrorDialogV3 explanation={currentExplanation} onDismiss={dismissError} />
      )}

      {/* Fallback 错误弹窗 */}
      {errorDialog && !currentExplanation && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={dismissError}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-xl shadow-2xl border border-zinc-200 w-[400px] max-w-[90vw] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <h3 className="text-sm font-semibold text-zinc-800">执行失败</h3>
              </div>
              <p className="text-xs text-zinc-500 mt-2 ml-[26px] leading-relaxed">{errorDialog}</p>
            </div>
            <div className="px-5 pb-4 pt-2 border-t border-zinc-100 flex justify-end">
              <button onClick={dismissError} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">知道了</button>
            </div>
          </div>
        </div>
      )}

      {/* API Key 配置弹窗 */}
      {showApiKeyDialog && (
        <SettingsDialog
          mode={apiKeyMode}
          onClose={() => setShowApiKeyDialog(false)}
          onSaved={() => {
            if (apiKeyMode === 'execute') {
              handleSubmit();
            }
          }}
        />
      )}
    </div>
  );
}
