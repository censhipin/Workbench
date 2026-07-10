'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ColumnDef, RowData, EditMode, CellHighlight } from '@/lib/types';
import { TableStyle } from '@/lib/tableStyles';

interface DataTableProps {
  columns: ColumnDef[];
  rows: RowData[];
  maxHeight?: string;
  highlightRow?: number | null;
  onRowClick?: (index: number) => void;
  resetKey?: string | number;
  editMode?: EditMode;
  highlightCell?: CellHighlight | null;
  onCellEdit?: (rowIndex: number, colKey: string, newValue: string) => void;
  scrollToRow?: number | null;
  onRowReorder?: (fromIndex: number, toIndex: number) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  onAddColumn?: () => void;
  onAddRow?: () => void;
  onRemoveColumn?: (columnKey: string) => void;
  onRemoveRow?: (rowIndex: number) => void;
  resizable?: boolean;
  stylePreset?: TableStyle;
}

function formatCell(value: string | number | null) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2);
  return String(value);
}

function colLetter(index: number): string {
  var s = '';
  var n = index + 1;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

var ROW_H = 32;
var ROW_NO_W = 60;
var BUFFER = 10;
var ADD_COL_W = 36;
var HEADER_H = 46;

export default function DataTable({ columns, rows, maxHeight = '500px', highlightRow, onRowClick, resetKey, editMode, highlightCell, onCellEdit, scrollToRow, onRowReorder, onColumnReorder, onAddColumn, onAddRow, onRemoveColumn, onRemoveRow, resizable, stylePreset }: DataTableProps) {
  var scrollRef = useRef<HTMLDivElement>(null);
  var [scrollY, setScrollY] = useState(0);
  var [vh, setVh] = useState(500);
  var [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  var [editValue, setEditValue] = useState('');
  // Drag visual feedback state
  var [dragFeedback, setDragFeedback] = useState<{ type: 'row' | 'column'; overIndex: number } | null>(null);
  var [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  // Delete confirmation state
  var [pendingDeleteCol, setPendingDeleteCol] = useState<string | null>(null);
  var [pendingDeleteRow, setPendingDeleteRow] = useState<number | null>(null);
  // Column resize state
  var [colWidths, setColWidths] = useState<Record<string, number>>({});
  var resizingRef = useRef<{ colKey: string; startX: number; startW: number } | null>(null);

  useEffect(function () {
    var el = scrollRef.current;
    if (!el) return;
    var ro = new ResizeObserver(function (entries) { if (entries[0]) setVh(entries[0].contentRect.height); });
    ro.observe(el);
    return function () { ro.disconnect(); };
  }, []);

  useEffect(function () {
    if (scrollRef.current) { scrollRef.current.scrollTop = 0; setScrollY(0); }
  }, [resetKey]);

  useEffect(function () {
    if (scrollToRow === null || scrollToRow === undefined || !scrollRef.current) return;
    var targetY = scrollToRow * ROW_H - vh / 2;
    if (targetY < 0) targetY = 0;
    scrollRef.current.scrollTop = targetY;
    setScrollY(targetY);
  }, [scrollToRow, vh]);

  var onScroll = useCallback(function () {
    if (scrollRef.current) setScrollY(scrollRef.current.scrollTop);
  }, []);

  var handleDoubleClick = function (rowIndex: number, colKey: string, currentValue: string | number | null) {
    if (editMode !== 'editing' || !onCellEdit) return;
    setEditingCell({ row: rowIndex, col: colKey });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  };

  var handleSave = function () {
    if (editingCell && onCellEdit) onCellEdit(editingCell.row, editingCell.col, editValue);
    setEditingCell(null);
  };

  var handleKeyDown = function (e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); setEditingCell(null); }
  };

  // ─── Row Y-position helper (accounts for header + virtual scroll) ─────
  var getRowIndexFromY = useCallback(function (clientY: number): number {
    var el = scrollRef.current;
    if (!el) return 0;
    var rect = el.getBoundingClientRect();
    var yInBody = clientY - rect.top + el.scrollTop - HEADER_H;
    if (yInBody < 0) return 0;
    // Can return rows.length, meaning "after the last row"
    return Math.min(Math.floor(yInBody / ROW_H), rows.length);
  }, [rows.length]);

  // ─── Row drag handlers ─────────────────────────────────────────────────
  var hasRowDrag = editMode === 'editing' && !!onRowReorder;

  var handleRowDragStart = useCallback(function (e: React.DragEvent) {
    var td = e.currentTarget as HTMLElement;
    var idx = Number(td.getAttribute('data-row-index'));
    if (isNaN(idx)) return;
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDragSourceIdx(idx);
  }, []);

  var handleBodyDragOver = useCallback(function (e: React.DragEvent) {
    if (!hasRowDrag) return;
    e.preventDefault();
    var idx = getRowIndexFromY(e.clientY);
    setDragFeedback({ type: 'row', overIndex: idx });
  }, [hasRowDrag, getRowIndexFromY]);

  var handleBodyDragLeave = useCallback(function (e: React.DragEvent) {
    var related = e.relatedTarget as Node;
    if (!related || !e.currentTarget.contains(related)) {
      setDragFeedback(null);
    }
  }, []);

  var handleRowDrop = useCallback(function (e: React.DragEvent) {
    e.preventDefault();
    var fromIdx = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(fromIdx) || !hasRowDrag) {
      setDragFeedback(null); setDragSourceIdx(null);
      return;
    }
    var targetIdx = getRowIndexFromY(e.clientY);
    if (targetIdx >= rows.length) targetIdx = rows.length - 1;
    if (targetIdx > fromIdx) targetIdx--;
    if (fromIdx !== targetIdx) {
      onRowReorder!(fromIdx, targetIdx);
    }
    setDragFeedback(null); setDragSourceIdx(null);
  }, [hasRowDrag, getRowIndexFromY, rows.length, onRowReorder]);

  var handleDragEnd = useCallback(function () {
    setDragFeedback(null); setDragSourceIdx(null);
  }, []);

  // ─── Column drag handlers (only on the title row) ──────────────────────
  var hasColDrag = editMode === 'editing' && !!onColumnReorder;

  var handleColDragStart = useCallback(function (e: React.DragEvent) {
    var el = e.currentTarget as HTMLElement;
    var idx = Number(el.getAttribute('data-col-index'));
    if (isNaN(idx)) return;
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDragSourceIdx(idx);
    setDragFeedback({ type: 'column', overIndex: idx });
  }, []);

  var handleColDragOver = useCallback(function (e: React.DragEvent) {
    if (!hasColDrag) return;
    e.preventDefault();
    var th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    var ci = Number(th.getAttribute('data-col-index'));
    if (isNaN(ci) || ci < 0 || ci >= columns.length) return;
    setDragFeedback({ type: 'column', overIndex: ci });
  }, [hasColDrag, columns.length]);

  var handleColDrop = useCallback(function (e: React.DragEvent) {
    e.preventDefault();
    if (!hasColDrag) {
      setDragFeedback(null); setDragSourceIdx(null);
      return;
    }
    var fromIdx = Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(fromIdx)) {
      setDragFeedback(null); setDragSourceIdx(null);
      return;
    }
    var th = (e.target as HTMLElement).closest('th');
    var toIdx = -1;
    if (th) {
      toIdx = Number(th.getAttribute('data-col-index'));
    }
    if (isNaN(toIdx) || toIdx < 0) {
      toIdx = columns.length - 1;
    }
    if (toIdx > fromIdx) toIdx--;
    if (fromIdx !== toIdx) {
      onColumnReorder!(fromIdx, toIdx);
    }
    setDragFeedback(null); setDragSourceIdx(null);
  }, [hasColDrag, columns.length, onColumnReorder]);

  var handleColDragLeave = useCallback(function (e: React.DragEvent) {
    var related = e.relatedTarget as Node;
    var current = e.currentTarget as Node;
    if (!related || !current.contains(related)) {
      setDragFeedback(null);
    }
  }, []);

  // ─── Column resize handlers ──────────────────────────────────────────────
  var handleColResizeStart = useCallback(function (e: React.MouseEvent, colKey: string) {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    var th = (e.currentTarget as HTMLElement).closest('th');
    var startW = th ? th.offsetWidth : 80;
    resizingRef.current = { colKey: colKey, startX: e.clientX, startW: startW };

    var onMouseMove = function (ev: MouseEvent) {
      if (!resizingRef.current) return;
      var diff = ev.clientX - resizingRef.current.startX;
      var newW = Math.max(40, resizingRef.current.startW + diff);
      setColWidths(function (prev) { return { ...prev, [colKey]: newW }; });
    };

    var onMouseUp = function () {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [resizable]);

  // ─── Render ───────────────────────────────────────────────────────────
  if (columns.length === 0) return null;

  var hasAddCol = !!onAddColumn;
  var hasAddRow = !!onAddRow;

  var totalH = rows.length * ROW_H;
  var start = Math.max(0, Math.floor(scrollY / ROW_H) - BUFFER);
  var end = Math.min(rows.length, Math.ceil((scrollY + vh) / ROW_H) + BUFFER);
  var visible = rows.slice(start, end);

  var isHighlighted = function (rowIdx: number, colKey: string): boolean {
    if (!highlightCell) return false;
    return Date.now() - highlightCell.startedAt <= 3000 && highlightCell.rowIndex === rowIdx && highlightCell.colKey === colKey;
  };

  var dragHandleSvg = React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 12 12', className: 'shrink-0 opacity-40 group-hover:opacity-70 transition-opacity' },
    React.createElement('circle', { cx: 3, cy: 3, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 9, cy: 3, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 3, cy: 6, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 9, cy: 6, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 3, cy: 9, r: 1.5, fill: 'currentColor' }),
    React.createElement('circle', { cx: 9, cy: 9, r: 1.5, fill: 'currentColor' })
  );

  // ── Style preset overrides ──
  var sp = stylePreset;
  var makeContainerStyle = function (base: React.CSSProperties): React.CSSProperties {
    return sp ? { ...base, borderColor: sp.borderColor } : base;
  };
  var makeHeaderCellStyle = function (base: React.CSSProperties): React.CSSProperties {
    return sp ? { ...base, background: sp.headerBg, color: sp.headerColor, borderColor: sp.borderColor } : base;
  };
  var makeRowStyle = function (isEven: boolean): React.CSSProperties {
    return sp ? { background: isEven ? sp.rowEvenBg : sp.rowOddBg, borderColor: sp.borderColor } : {};
  };
  var makeCellStyle = function (base: React.CSSProperties): React.CSSProperties {
    return sp ? { ...base, borderColor: sp.borderColor } : base;
  };

  return React.createElement('div', {
    ref: scrollRef,
    className: 'overflow-auto rounded-lg border border-zinc-200',
    style: makeContainerStyle({ maxHeight: maxHeight, height: maxHeight, contain: 'strict' as any }),
    onScroll: onScroll,
  },
    React.createElement('table', { className: 'min-w-full text-sm border-collapse', style: { tableLayout: 'auto' as any } },
      React.createElement('thead', null,
        // ── Row 1: column letters (not draggable) ──
        React.createElement('tr', null,
          React.createElement('th', {
            className: 'sticky top-0 z-30 bg-zinc-50 border-b border-r border-zinc-200 select-none',
            style: makeHeaderCellStyle({ width: ROW_NO_W, minWidth: ROW_NO_W, height: 20, padding: 0, fontSize: 10 })
          }),
          columns.map(function (col, ci) {
            var w = colWidths[col.key] || undefined;
            return React.createElement('th', {
              key: 'l-' + col.key,
              'data-col-index': ci,
              className: 'sticky top-0 z-20 bg-zinc-50 text-center font-mono text-[10px] text-zinc-400 font-semibold select-none border-b border-r border-zinc-200',
              style: makeHeaderCellStyle({ height: 20, padding: '0 6px', minWidth: 40, width: w })
            }, colLetter(ci));
          }),
          hasAddCol ? React.createElement('th', {
            key: '__add_col_letter__',
            className: 'sticky top-0 z-20 bg-zinc-50 border-b border-zinc-200',
            style: makeHeaderCellStyle({ width: ADD_COL_W, minWidth: ADD_COL_W, height: 20, padding: 0 })
          }) : null
        ),
        // ── Row 2: column titles (draggable) ──
        React.createElement('tr', {
          onDragOver: hasColDrag ? handleColDragOver : undefined,
          onDrop: hasColDrag ? handleColDrop : undefined,
          onDragLeave: hasColDrag ? handleColDragLeave : undefined,
          onDragEnd: hasColDrag ? handleDragEnd : undefined
        },
          React.createElement('th', {
            className: 'sticky top-[20px] z-30 bg-zinc-100 border-b border-r border-zinc-200 select-none',
            style: makeHeaderCellStyle({ width: ROW_NO_W, minWidth: ROW_NO_W, height: 26, padding: 0 })
          }),
          columns.map(function (col, ci) {
            var isOver = dragFeedback && dragFeedback.type === 'column' && dragFeedback.overIndex === ci;
            var isSource = dragFeedback && dragFeedback.type === 'column' && dragSourceIdx === ci;
            var canDeleteCol = editMode === 'editing' && onRemoveColumn && columns.length > 1;
            var w = colWidths[col.key] || undefined;
            return React.createElement('th', {
              key: col.key,
              draggable: hasColDrag,
              'data-col-index': ci,
              onDragStart: hasColDrag ? handleColDragStart : undefined,
              className: 'sticky top-[20px] z-20 bg-zinc-100 text-center text-[12px] text-zinc-600 font-medium select-none border-b border-r border-zinc-200 whitespace-nowrap group'
                + (hasColDrag ? ' cursor-grab active:cursor-grabbing' : ''),
              style: makeHeaderCellStyle({
                height: 26,
                padding: '0 6px',
                minWidth: 40,
                width: w,
                borderLeft: isOver ? '2px solid #3b82f6' : undefined,
                opacity: isSource ? 0.4 : undefined
              })
            },
              React.createElement('div', { className: 'flex items-center justify-center gap-0.5 relative' },
                React.createElement('span', { className: 'truncate' }, col.title),
                canDeleteCol ? React.createElement('button', {
                  onClick: function (e: React.MouseEvent) { e.stopPropagation(); setPendingDeleteCol(col.key); },
                  className: 'shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-all',
                  title: '删除列',
                  style: { lineHeight: 1 }
                },
                  React.createElement('svg', { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                    React.createElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
                    React.createElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
                  )
                ) : null
              ),
              // Resize handle
              resizable ? React.createElement('div', {
                onMouseDown: function (e: React.MouseEvent) { handleColResizeStart(e, col.key); },
                className: 'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10',
                style: { background: 'transparent' }
              }) : null
            );
          }),
          hasAddCol ? React.createElement('th', {
            key: '__add_col__',
            className: 'sticky top-[20px] z-20 bg-zinc-100 border-b border-zinc-200',
            style: makeHeaderCellStyle({ width: ADD_COL_W, minWidth: ADD_COL_W, height: 26, padding: 0 })
          },
            React.createElement('button', {
              onClick: onAddColumn,
              className: 'w-full h-full flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium',
              title: '新增列'
            }, '+')
          ) : null
        )
      ),
      React.createElement('tbody', {
        onDragOver: hasRowDrag ? handleBodyDragOver : undefined,
        onDrop: hasRowDrag ? handleRowDrop : undefined,
        onDragLeave: hasRowDrag ? handleBodyDragLeave : undefined,
        onDragEnd: hasRowDrag ? handleDragEnd : undefined
      },
        // Top spacer (virtual scroll)
        React.createElement('tr', { key: '__spacer_top__', style: { height: start * ROW_H } }),

        // Visible rows
        visible.map(function (row, vi) {
          var i = start + vi;
          var isOver = dragFeedback && dragFeedback.type === 'row' && dragFeedback.overIndex === i;
          var isSource = dragFeedback && dragFeedback.type === 'row' && dragSourceIdx === i;
          return React.createElement('tr', {
            key: i,
            className: i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30',
            style: {
              height: ROW_H,
              borderTop: isOver ? '2px solid #3b82f6' : undefined,
              opacity: isSource ? 0.4 : undefined,
              ...makeRowStyle(i % 2 === 0)
            }
          },
            // Drag handle + row number
            React.createElement('td', {
              'data-row-index': hasRowDrag ? i : undefined,
              draggable: hasRowDrag,
              onDragStart: hasRowDrag ? handleRowDragStart : undefined,
              className: 'text-center font-mono text-[11px] text-zinc-300 select-none border-b border-r border-zinc-100 bg-zinc-50/50'
                + (hasRowDrag || onRemoveRow ? ' group' : '') + (hasRowDrag ? ' cursor-grab active:cursor-grabbing' : ''),
              style: makeCellStyle({ width: ROW_NO_W, minWidth: ROW_NO_W, padding: '0 2px' })
            },
              React.createElement('div', { className: 'flex items-center justify-center gap-0.5' },
                hasRowDrag ? dragHandleSvg : null,
                editMode === 'editing' && onRemoveRow ? React.createElement('button', {
                  onClick: function (e: React.MouseEvent) { e.stopPropagation(); setPendingDeleteRow(i); },
                  className: 'shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded p-0.5 transition-all',
                  title: '删除行',
                  style: { lineHeight: 1 }
                },
                  React.createElement('svg', { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
                    React.createElement('path', { d: 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' })
                  )
                ) : null,
                React.createElement('span', { style: { lineHeight: '32px' } }, i + 1)
              )
            ),
            // Data cells
            columns.map(function (col) {
              var cellEditing = editingCell && editingCell.row === i && editingCell.col === col.key;
              var hl = isHighlighted(i, col.key);
              var cellStyle: any = { padding: '0 6px', borderRight: '1px solid #f0f0f0', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
              if (hl) cellStyle.boxShadow = 'inset 0 0 0 2px #ef4444';
              var isEditable = editMode === 'editing' && !!onCellEdit;

              if (cellEditing) {
                return React.createElement('td', { key: col.key, className: 'border-b border-zinc-100 overflow-visible', style: makeCellStyle(cellStyle) },
                  React.createElement('input', {
                    autoFocus: true,
                    type: 'text',
                    value: editValue,
                    onChange: function (e: any) { setEditValue(e.target.value); },
                    onBlur: handleSave,
                    onKeyDown: handleKeyDown,
                    className: 'w-full text-center text-sm bg-blue-50 border-none outline-none px-1 py-0.5 rounded',
                    style: { width: Math.max(40, editValue.length * 12) + 'px', minWidth: '40px', transition: 'width 0.1s' }
                  })
                );
              }

              return React.createElement('td', {
                key: col.key,
                className: 'border-b border-zinc-100 text-sm' + (isEditable ? ' cursor-pointer hover:bg-blue-50/30' : '') + (col.type === 'number' ? ' tabular-nums' : ''),
                style: makeCellStyle(cellStyle),
                onDoubleClick: isEditable ? function () { handleDoubleClick(i, col.key, row[col.key]); } : undefined
              }, formatCell(row[col.key]));
            }),
            // Empty cell for add-column column space
            hasAddCol ? React.createElement('td', {
              key: '__add_col_cell__',
              className: 'border-b border-zinc-100',
              style: makeCellStyle({ width: ADD_COL_W, minWidth: ADD_COL_W, padding: 0 })
            }) : null
          );
        }),

        // Bottom spacer (virtual scroll)
        React.createElement('tr', { key: '__spacer_bottom__', style: { height: Math.max(0, totalH - end * ROW_H) } }),

        // Add-row button
        hasAddRow ? React.createElement('tr', {
          key: '__add_row__',
          className: 'bg-white hover:bg-zinc-50/50 transition-colors',
          style: { height: ROW_H }
        },
          React.createElement('td', {
            className: 'border-b border-zinc-100 bg-zinc-50/50',
            style: { width: ROW_NO_W, minWidth: ROW_NO_W, padding: 0 }
          }),
          React.createElement('td', {
            colSpan: columns.length + (hasAddCol ? 1 : 0),
            className: 'border-b border-zinc-100',
            style: { padding: 0 }
          },
            React.createElement('button', {
              onClick: onAddRow,
              className: 'w-full h-full flex items-center justify-center text-zinc-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-xs gap-1',
              title: '新增行'
            },
              React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
                React.createElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
                React.createElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
              ),
              '新增行'
            )
          )
        ) : null
      )
    ),
    rows.length === 0 ? React.createElement('div', { className: 'flex items-center justify-center py-16 text-sm text-zinc-400' }, '暂无数据') : null,
    // ── Column delete confirmation dialog ──
    pendingDeleteCol ? React.createElement('div', {
      key: '__confirm_delete_col__',
      className: 'fixed inset-0 z-[60] flex items-center justify-center',
      onClick: function () { setPendingDeleteCol(null); }
    },
      React.createElement('div', { className: 'absolute inset-0 bg-black/20' }),
      React.createElement('div', {
        className: 'relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-5 py-4 w-72 max-w-full',
        onClick: function (e: React.MouseEvent) { e.stopPropagation(); }
      },
        React.createElement('p', { className: 'text-sm font-medium text-zinc-800 mb-1' }, '删除列'),
        React.createElement('p', { className: 'text-xs text-zinc-500 mb-4' }, '确定删除当前列？所有行该字段将被删除。'),
        React.createElement('div', { className: 'flex items-center gap-2 justify-end' },
          React.createElement('button', {
            onClick: function () { setPendingDeleteCol(null); },
            className: 'text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors'
          }, '取消'),
          React.createElement('button', {
            onClick: function () { if (onRemoveColumn && pendingDeleteCol) onRemoveColumn(pendingDeleteCol); setPendingDeleteCol(null); },
            className: 'text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors'
          }, '删除')
        )
      )
    ) : null,
    // ── Row delete confirmation dialog ──
    pendingDeleteRow !== null ? React.createElement('div', {
      key: '__confirm_delete_row__',
      className: 'fixed inset-0 z-[60] flex items-center justify-center',
      onClick: function () { setPendingDeleteRow(null); }
    },
      React.createElement('div', { className: 'absolute inset-0 bg-black/20' }),
      React.createElement('div', {
        className: 'relative bg-white rounded-xl shadow-2xl border border-zinc-200 px-5 py-4 w-72 max-w-full',
        onClick: function (e: React.MouseEvent) { e.stopPropagation(); }
      },
        React.createElement('p', { className: 'text-sm font-medium text-zinc-800 mb-1' }, '删除行'),
        React.createElement('p', { className: 'text-xs text-zinc-500 mb-4' }, '确定删除第 ' + (pendingDeleteRow + 1) + ' 行？'),
        React.createElement('div', { className: 'flex items-center gap-2 justify-end' },
          React.createElement('button', {
            onClick: function () { setPendingDeleteRow(null); },
            className: 'text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors'
          }, '取消'),
          React.createElement('button', {
            onClick: function () { if (onRemoveRow && pendingDeleteRow !== null) onRemoveRow(pendingDeleteRow); setPendingDeleteRow(null); },
            className: 'text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors'
          }, '删除')
        )
      )
    ) : null
  );
}
