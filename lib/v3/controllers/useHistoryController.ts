// ============================================================
// useHistoryController — 历史记录控制器
// ============================================================
import { useState, useCallback } from 'react';
import type { HistoryItem } from '@/lib/types';
import type { HistoryItemType } from '@/components/common/OperationHistoryModal';
import { saveHistory } from '@/lib/db';

export function useHistoryController(
  onHistoryRestore: (columns: any[], rows: any[], action: string) => void,
) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const addHistoryItem = useCallback((item: HistoryItem) => {
    setHistoryItems(prev => {
      const next = [item, ...prev].slice(0, 50);
      saveHistory(next).catch(() => {});
      return next;
    });
  }, []);

  const setHistoryItemsBulk = useCallback((items: HistoryItem[]) => {
    setHistoryItems(items);
  }, []);

  const handleHistoryClick = useCallback((item: HistoryItemType) => {
    if (!item.resultData) return;
    onHistoryRestore(item.resultData.columns, item.resultData.rows, item.action);
    setShowHistory(false);
  }, [onHistoryRestore]);

  return {
    historyItems, showHistory,
    setShowHistory, addHistoryItem, setHistoryItemsBulk, handleHistoryClick,
  };
}
