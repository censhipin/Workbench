// ============================================================
// useExecutionController — 执行控制器
// ============================================================
import { useState, useCallback } from 'react';
import type { ColumnDef, RowData, WorkbenchFile, PlanStep, StepStatus, HistoryItem, TaskSheetRef } from '@/lib/types';
import type { ExecutionExplanation } from '@/lib/v3/explain';
import { runExecutionEngine, type EngineRunResult } from '@/lib/execution-engine';
import { parseIntentWithAI, parseAndResolve } from '@/lib/nlu';
import { AmbiguityDetector } from '@/lib/ambiguity-detector';
import { getApiKey } from '@/lib/api-key';

export interface ExecutionState {
  isRunning: boolean;
  executionSteps: PlanStep[];
  error: string | null;
  currentExplanation: ExecutionExplanation | null;
}

export interface AmbiguityState {
  ambiguityReport: any;
  planPreview: any;
  pendingHistoryItem: HistoryItem | null;
  resolvedIntent: any;
}

export function useExecutionController(
  onError: (e: string | null) => void,
  onExplanation: (e: ExecutionExplanation | null) => void,
  onVersionCreated: (columns: ColumnDef[], rows: RowData[], intent: any) => void,
  onHistoryAdded: (item: HistoryItem) => void,
  activeDataset: { columns: ColumnDef[]; rows: RowData[] } | null,
  selectedFile: WorkbenchFile | null,
  activeSheet: string,
  taskSheets: TaskSheetRef[],
  files: WorkbenchFile[],
  promptText: string,
  setApiKeyMode: (m: 'settings' | 'execute' | 'audit') => void,
  setShowApiKeyDialog: (s: boolean) => void,
) {
  const [isRunning, setIsRunning] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<PlanStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentExplanation, setCurrentExplanation] = useState<ExecutionExplanation | null>(null);

  // 歧义状态
  const [ambiguityReport, setAmbiguityReport] = useState<any>(null);
  const [planPreview, setPlanPreview] = useState<any>(null);
  const [pendingHistoryItem, setPendingHistoryItem] = useState<HistoryItem | null>(null);
  const [resolvedIntent, setResolvedIntent] = useState<any>(null);

  const executeIntent = useCallback(async (
    intent: any,
    mainFile: WorkbenchFile,
    sheetName: string,
    taskSheetsOverride?: TaskSheetRef[],
  ) => {
    setIsRunning(true);
    setError(null);

    const dataset = activeDataset;
    if (!dataset) {
      setError('没有可执行的数据');
      setIsRunning(false);
      return;
    }

    const snapColumns: ColumnDef[] = structuredClone(dataset.columns);
    const snapRows: RowData[] = structuredClone(dataset.rows);

    const execFile: WorkbenchFile = {
      ...mainFile,
      sheets: [{ name: sheetName, columns: snapColumns, rows: snapRows }],
    };

    const selectedTaskSheets = taskSheetsOverride ?? taskSheets;
    const taskFilesForExec: WorkbenchFile[] = [execFile];
    if (selectedTaskSheets.length > 0) {
      for (const ref of selectedTaskSheets) {
        if (ref.fileId === mainFile.id) continue;
        const tf = files.find(f => f.id === ref.fileId);
        const sheet = tf?.sheets.find(s => s.name === ref.sheetName);
        if (tf && sheet) {
          taskFilesForExec.push({
            ...tf,
            sheets: [{
              name: ref.sheetName,
              columns: structuredClone(sheet.columns),
              rows: structuredClone(sheet.rows),
            }],
          });
        }
      }
    }

    const engineResult: EngineRunResult = runExecutionEngine(intent, execFile, sheetName, taskFilesForExec);

    const explanation = engineResult.explanation ?? null;
    setCurrentExplanation(explanation);
    onExplanation(explanation);

    const waitingSteps = engineResult.steps.map(s => ({
      ...s,
      status: 'waiting' as StepStatus,
      subItems: undefined,
    }));
    setExecutionSteps(waitingSteps);

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
      const resultColumns: ColumnDef[] = structuredClone(engineResult.resultData.columns);
      const resultRows: RowData[] = structuredClone(engineResult.resultData.rows);

      onVersionCreated(resultColumns, resultRows, intent);

      const historyItem: HistoryItem = {
        id: 'h-' + Date.now(),
        action: promptText,
        timestamp: new Date().toISOString(),
        targetFiles: mainFile ? [mainFile.name] : [],
        resultData: { columns: resultColumns, rows: resultRows },
        resultSummary: engineResult.resultSummary ?? undefined,
      };
      onHistoryAdded(historyItem);
    } else {
      setError(engineResult.error || '执行失败');
      onError(engineResult.error || '执行失败');
    }

    setIsRunning(false);
  }, [promptText, activeDataset, taskSheets, files, onError, onExplanation, onVersionCreated, onHistoryAdded]);

  const handleSubmit = useCallback(async () => {
    if (!promptText.trim() || isRunning) return;

    const existingKey = getApiKey();
    if (!existingKey || existingKey.length < 10) {
      setApiKeyMode('execute');
      setShowApiKeyDialog(true);
      return;
    }

    setIsRunning(true);
    setError(null);
    setExecutionSteps([]);

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
      const allFileNames = [...fileNames];
      if (taskSheets.length > 0) {
        for (const ref of taskSheets) {
          if (ref.fileId === selectedFile?.id) continue;
          const tf = files.find(f => f.id === ref.fileId);
          if (tf && !allFileNames.includes(tf.name)) allFileNames.push(tf.name);
        }
      }

      const result = await parseIntentWithAI(promptText, mainFile?.name ?? '', cols, dataset.rows, allFileNames);

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

      const skipResolve = ['formula', 'update', 'pipeline', 'select', 'remove', 'rename'].includes(result.intent.operation);
      const ambResult = skipResolve ? null : AmbiguityDetector.detect(result.intent, result.resolution.candidates);
      if (ambResult) {
        const preview = AmbiguityDetector.buildPreviewPlan(result.intent, dataset.rows.length, 0);
        setAmbiguityReport(ambResult);
        setPlanPreview(preview);
        setResolvedIntent(result.intent);
        setIsRunning(false);
        return;
      }

      await executeIntent(result.intent, mainFile!, activeSheet, taskSheets);
    } catch (err) {
      setError('处理出错: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRunning(false);
    }
  }, [promptText, isRunning, selectedFile, activeDataset, taskSheets, files, activeSheet, executeIntent, setApiKeyMode, setShowApiKeyDialog]);

  const handleConfirmAmbiguity = useCallback((selections: any) => {
    if (!resolvedIntent) return;
    const mainFile = selectedFile;
    if (!mainFile || !activeDataset) return;

    if (selections?.selectedColumns?.length > 0) {
      resolvedIntent.resolvedColumns = selections.selectedColumns.map((c: any) => ({
        key: c.key, title: c.title, confidence: c.confidence, matchMethod: c.matchMethod,
      }));
    }

    executeIntent(resolvedIntent, mainFile, activeSheet);
    setAmbiguityReport(null);
    setPlanPreview(null);
  }, [resolvedIntent, selectedFile, activeDataset, activeSheet, executeIntent]);

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

  return {
    isRunning, executionSteps, error, currentExplanation,
    ambiguityReport, planPreview, pendingHistoryItem, resolvedIntent,
    setExecutionSteps, setError,
    handleSubmit, executeIntent,
    handleConfirmAmbiguity, handleCancelAmbiguity, handleModifyPrompt,
  };
}
