'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SheetInfo, EditMode, CellHighlight, ColumnDef, RowData } from '@/lib/types';
import DataTable from '@/components/common/DataTable';
import SheetTabs from '@/components/common/SheetTabs';
import EmptyState from '@/components/common/EmptyState';

interface DataPreviewProps {
  fileName: string | null;
  fileIcon: string | null;
  sheets: SheetInfo[];
  activeSheet: string;
  onSheetChange: (name: string) => void;
  flexBasis?: string;
  onAudit?: () => void;
  editMode?: EditMode;
  onToggleEditMode?: () => void;
  highlightCell?: CellHighlight | null;
  onCellEdit?: (rowIndex: number, colKey: string, newValue: string) => void;
  scrollToRow?: number | null;
}

interface TableState {
  columns: ColumnDef[];
  rows: RowData[];
}

export default function DataPreview(props: DataPreviewProps) {
  var fileName = props.fileName;
  var fileIcon = props.fileIcon;
  var sheets = props.sheets;
  var activeSheet = props.activeSheet;
  var onSheetChange = props.onSheetChange;
  var flexBasis = props.flexBasis || '1';
  var onAudit = props.onAudit;
  var editMode = props.editMode || 'locked';
  var onToggleEditMode = props.onToggleEditMode;
  var highlightCell = props.highlightCell;
  var onCellEdit = props.onCellEdit;
  var scrollToRow = props.scrollToRow;

  // ── Local table state for drag/add operations ──────────────────────────
  // Derived from props but independently mutable for UI-only changes.
  var currentSheet = sheets.find(function (s) { return s.name === activeSheet; });

  var [tableState, setTableState] = useState<TableState | null>(null);

  // Sync from props when sheet/file changes
  var sheetKey = fileName + '::' + activeSheet;
  var prevSheetKeyRef = useRef(sheetKey);
  useEffect(function () {
    if (prevSheetKeyRef.current !== sheetKey) {
      prevSheetKeyRef.current = sheetKey;
      if (currentSheet) {
        setTableState({
          columns: currentSheet.columns.slice(),
          rows: currentSheet.rows.slice()
        });
      } else {
        setTableState(null);
      }
    }
  }, [sheetKey, currentSheet]);

  // Initial sync
  useEffect(function () {
    if (!tableState && currentSheet) {
      setTableState({
        columns: currentSheet.columns.slice(),
        rows: currentSheet.rows.slice()
      });
    }
  }, [currentSheet]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row reorder ────────────────────────────────────────────────────────
  var handleRowReorder = useCallback(function (fromIndex: number, toIndex: number) {
    setTableState(function (prev) {
      if (!prev) return prev;
      var next = { columns: prev.columns, rows: prev.rows.slice() };
      var item = next.rows.splice(fromIndex, 1)[0];
      next.rows.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  // ── Column reorder ─────────────────────────────────────────────────────
  var handleColumnReorder = useCallback(function (fromIndex: number, toIndex: number) {
    setTableState(function (prev) {
      if (!prev) return prev;
      var cols = prev.columns.slice();
      var moved = cols.splice(fromIndex, 1)[0];
      cols.splice(toIndex, 0, moved);
      // Reorder each row's keys to match new column order
      var rows = prev.rows.map(function (row) {
        var entries = Object.entries(row);
        var colKeys = cols.map(function (c) { return c.key; });
        var reordered: Record<string, string | number | null> = {};
        for (var _i = 0, colKeys_1 = colKeys; _i < colKeys_1.length; _i++) {
          var key = colKeys_1[_i];
          if (key in row) reordered[key] = row[key];
        }
        // Append any extra keys not in columns
        for (var _a = 0, entries_1 = entries; _a < entries_1.length; _a++) {
          var entry = entries_1[_a];
          if (!(entry[0] in reordered)) reordered[entry[0]] = entry[1];
        }
        return reordered;
      });
      return { columns: cols, rows: rows };
    });
  }, []);

  // ── Add column ─────────────────────────────────────────────────────────
  var handleAddColumn = useCallback(function () {
    setTableState(function (prev) {
      if (!prev) return prev;
      var key = 'new_column_' + Date.now();
      var title = '新列';
      // Avoid duplicate key suffix
      var existingKeys = new Set(prev.columns.map(function (c) { return c.key; }));
      while (existingKeys.has(key)) key = 'new_column_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      var newCol: ColumnDef = { key: key, title: title, type: 'text' };
      var rows = prev.rows.map(function (row) {
        return { ...row, [key]: '' };
      });
      return { columns: prev.columns.concat(newCol), rows: rows };
    });
  }, []);

  // ── Add row ────────────────────────────────────────────────────────────
  var handleAddRow = useCallback(function () {
    setTableState(function (prev) {
      if (!prev) return prev;
      var emptyRow: RowData = {};
      for (var _i = 0, _a = prev.columns; _i < _a.length; _i++) {
        var col = _a[_i];
        emptyRow[col.key] = '';
      }
      return { columns: prev.columns, rows: prev.rows.concat(emptyRow) };
    });
  }, []);

  // ── Remove column ──────────────────────────────────────────────────────
  var handleRemoveColumn = useCallback(function (columnKey: string) {
    setTableState(function (prev) {
      if (!prev || prev.columns.length <= 1) return prev;
      return {
        columns: prev.columns.filter(function (c) { return c.key !== columnKey; }),
        rows: prev.rows.map(function (row) {
          var next = { ...row };
          delete next[columnKey];
          return next;
        })
      };
    });
  }, []);

  // ── Remove row ─────────────────────────────────────────────────────────
  var handleRemoveRow = useCallback(function (rowIndex: number) {
    setTableState(function (prev) {
      if (!prev) return prev;
      var rows = prev.rows.slice();
      rows.splice(rowIndex, 1);
      return { columns: prev.columns, rows: rows };
    });
  }, []);

  // Determine what to pass to DataTable
  var displayColumns = tableState ? tableState.columns : (currentSheet ? currentSheet.columns : []);
  var displayRows = tableState ? tableState.rows : (currentSheet ? currentSheet.rows : []);

  if (!currentSheet || !fileName) {
    return React.createElement('div', { style: { flex: flexBasis }, className: 'flex flex-col min-h-0' },
      React.createElement(EmptyState, { icon: '📂', title: '请选择文件', description: '从左侧文件池选择文件即可预览数据' })
    );
  }

  return React.createElement('div', { className: 'flex flex-col min-h-0 overflow-hidden', style: { flex: flexBasis } },
    React.createElement('div', { className: 'flex items-start justify-between px-4 py-2.5 border-b border-zinc-100 shrink-0 gap-3' },
      React.createElement('div', { className: 'flex items-center gap-3 min-w-0' },
        React.createElement('span', { className: 'text-lg shrink-0' }, fileIcon),
        React.createElement('div', { className: 'min-w-0' },
          React.createElement('div', { className: 'flex items-center gap-3 flex-wrap' },
            React.createElement('h2', { className: 'text-sm font-semibold text-zinc-800 truncate' }, fileName),
            sheets.length > 1 && React.createElement(SheetTabs, { sheets: sheets, activeSheet: activeSheet, onSelect: onSheetChange })
          ),
          React.createElement('p', { className: 'text-[11px] text-zinc-400 mt-0.5' }, displayRows.length + ' 行 x ' + displayColumns.length + ' 列')
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2 shrink-0 flex-wrap' },
        React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400 shrink-0' }, '原始数据'),
        onToggleEditMode ? React.createElement('button', {
          onClick: onToggleEditMode,
          className: 'flex items-center gap-1 ml-1 text-[11px] px-2 py-1 rounded-md border transition-colors shrink-0 ' + (editMode === 'editing' ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50'),
          title: editMode === 'editing' ? '切换为锁定模式' : '切换为编辑模式'
        },
          editMode === 'editing' ? React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z' })
          ) : React.createElement('svg', { width: '10', height: '10', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('rect', { x: '3', y: '11', width: '18', height: '11', rx: '2', ry: '2' }),
            React.createElement('path', { d: 'M7 11V7a5 5 0 0110 0v4' })
          ),
          editMode === 'editing' ? '编辑模式' : '锁定模式'
        ) : null,
        onAudit ? React.createElement('button', {
          onClick: onAudit,
          className: 'flex items-center gap-1 ml-1 text-[11px] px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0',
          title: '数据体检'
        },
          React.createElement('svg', { width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' })
          ),
          '数据体检'
        ) : null
      )
    ),
    React.createElement('div', { className: 'flex-1 min-h-0 overflow-hidden' },
      React.createElement(DataTable, {
        columns: displayColumns,
        rows: displayRows,
        maxHeight: '100%',
        resetKey: editMode + activeSheet,
        editMode: editMode,
        highlightCell: highlightCell,
        onCellEdit: onCellEdit,
        scrollToRow: scrollToRow,
        onRowReorder: handleRowReorder,
        onColumnReorder: handleColumnReorder,
        onAddColumn: handleAddColumn,
        onAddRow: handleAddRow,
        onRemoveColumn: handleRemoveColumn,
        onRemoveRow: handleRemoveRow
      })
    )
  );
}
