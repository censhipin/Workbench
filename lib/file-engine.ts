// ============================================================
// 文件解析引擎 — Excel/CSV 解析与导出
// ============================================================

import { ColumnDef, RowData, SheetInfo, WorkbenchFile } from './types';
import type { TableStyle } from './tableStyles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _XLSX: any = null;
async function getXLSX() {
  if (_XLSX) return _XLSX;
  _XLSX = await import('xlsx');
  return _XLSX;
}

/** 检测列类型 */
function inferType(values: unknown[]): ColumnDef['type'] {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';
  const allNum = nonNull.every((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== ''));
  if (allNum) return 'number';
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
  const allDate = nonNull.every((v) => typeof v === 'string' && datePattern.test(v));
  if (allDate) return 'date';
  return 'text';
}

/** 将 xlsx 解析的行数组转换为 SheetInfo */
function toSheetInfo(name: string, rawRows: unknown[][]): SheetInfo {
  if (rawRows.length === 0) return { name, columns: [], rows: [] };
  const headers = rawRows[0].map((h, i) => String((h as string | undefined) ?? `列${(i as number) + 1}`));
  const dataRows = rawRows.slice(1);
  const colSamples: unknown[][] = headers.map(() => []);
  const rows: RowData[] = dataRows.map((row) => {
    const obj: RowData = {};
    headers.forEach((h: string, i: number) => {
      const v = row[i];
      obj[h] = v !== undefined && v !== null ? String(v) : null;
      colSamples[i].push(v);
    });
    return obj;
  });
  const columns: ColumnDef[] = headers.map((h: string, i: number) => ({
    key: sanitizeKey(h, i),
    title: h,
    type: inferType(colSamples[i]),
  }));
  return { name, columns, rows };
}

function sanitizeKey(title: string, index: number): string {
  return title.replace(/[^a-zA-Z0-9一-鿿]/g, '_').replace(/^(\d)/, '_$1') || `col_${index}`;
}

/** 图标映射 */
const iconMap: Record<string, string> = {
  '销售': '📊', '订单': '📊', '业绩': '📊',
  '员工': '👤', '人事': '👤', '人员': '👤',
  '联系': '📞', '通讯': '📞', '电话': '📞',
  '工资': '💰', '财务': '💰', '薪资': '💰', '收入': '💰',
};
function pickIcon(name: string): string {
  for (const [kw, icon] of Object.entries(iconMap)) {
    if (name.includes(kw)) return icon;
  }
  return '📄';
}

/** 解析 File → WorkbenchFile */
export async function parseFile(file: File): Promise<WorkbenchFile> {
  const XLSX = await getXLSX();
  const data = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(data, { type: 'array' });

  const sheets: SheetInfo[] = workbook.SheetNames.map((name: string) => {
    const sheet = workbook.Sheets[name];
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    return toSheetInfo(name, rawRows);
  });

  const totalRows = sheets.reduce((s, sh) => s + sh.rows.length, 0);
  const maxCols = Math.max(...sheets.map((sh) => sh.columns.length), 0);

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    icon: pickIcon(file.name),
    sheets,
    rowCount: totalRows,
    colCount: maxCols,
    isMock: false,
    rawFile: file,
  };
}

/** 导出为 Excel 并触发下载 */
export async function exportToExcel(
  sheets: { name: string; columns: ColumnDef[]; rows: RowData[] }[],
  fileName: string,
  style?: TableStyle
) {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name || 'Sheet1');

    // Write header row
    const headerRow = ws.addRow(sheet.columns.map((c) => c.title));

    // Write data rows
    sheet.rows.forEach((row) => {
      ws.addRow(sheet.columns.map((c) => row[c.key] ?? ''));
    });

    // Auto column widths
    sheet.columns.forEach((c, ci) => {
      const maxLen = Math.max(
        c.title.length,
        ...sheet.rows.map((r) => String(r[c.key] ?? '').length)
      );
      ws.getColumn(ci + 1).width = Math.min(Math.max(maxLen + 3, 10), 60);
    });

    if (style) {
      // ── Header style ──
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style!.headerBg.replace('#', '') } };
        cell.font = { bold: true, color: { argb: style!.headerColor.replace('#', '') }, size: 11, name: 'Microsoft YaHei' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
          bottom: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
          left: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
          right: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
        };
      });
      headerRow.height = 24;

      // ── Data rows style (alternating) ──
      sheet.rows.forEach((_row, i) => {
        const excelRow = ws.getRow(i + 2);
        const bg = i % 2 === 0 ? style!.rowEvenBg : style!.rowOddBg;
        excelRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg.replace('#', '') } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
            bottom: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
            left: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
            right: { style: 'thin', color: { argb: style!.borderColor.replace('#', '') } },
          };
        });
        excelRow.height = 22;
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
