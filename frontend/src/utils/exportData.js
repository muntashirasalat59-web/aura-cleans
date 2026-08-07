import * as XLSX from 'xlsx';

/** YYYY-MM-DD in local time */
export function exportDateStamp(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** rows: array of plain objects; columns: [{ key, header }] */
export function rowsToCsv(rows, columns) {
  const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(row[c.key])).join(',')
  );
  return [headerLine, ...lines].join('\r\n');
}

export function downloadCsv(rows, columns, filenameBase) {
  const csv = rowsToCsv(rows, columns);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filenameBase}.csv`);
}

export function downloadXlsx(rows, columns, filenameBase, sheetName = 'Export') {
  const aoa = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => {
      const v = row[c.key];
      return v == null ? '' : v;
    })),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${filenameBase}.xlsx`);
}

/**
 * @param {'csv'|'xlsx'} format
 * @param {object[]} rows - already mapped export rows
 * @param {{ key: string, header: string }[]} columns
 * @param {string} filePrefix - e.g. "products"
 */
export async function exportTable(format, rows, columns, filePrefix) {
  const filenameBase = `${filePrefix}_${exportDateStamp()}`;
  // Yield so the UI can paint a loading state before heavy work.
  await new Promise((r) => setTimeout(r, 0));
  if (format === 'xlsx') {
    downloadXlsx(rows, columns, filenameBase, filePrefix);
  } else {
    downloadCsv(rows, columns, filenameBase);
  }
  return { filenameBase, count: rows.length };
}
