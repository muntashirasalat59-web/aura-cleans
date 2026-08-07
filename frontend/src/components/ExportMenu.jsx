import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { exportTable } from '../utils/exportData';
import { useToast } from '../context/ToastContext';

/**
 * Dropdown: Export as CSV / Excel for the currently visible rows.
 *
 * @param {object} props
 * @param {() => object[]} props.getRows - returns mapped row objects for export
 * @param {{ key: string, header: string }[]} props.columns
 * @param {string} props.filePrefix - e.g. "products"
 * @param {string} props.successLabel - e.g. "Products"
 * @param {boolean} [props.disabled]
 */
export default function ExportMenu({
  getRows,
  columns,
  filePrefix,
  successLabel,
  disabled = false,
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleExport(format) {
    if (exporting) return;
    setOpen(false);
    const rows = typeof getRows === 'function' ? getRows() : [];
    if (!rows.length) {
      showToast(`No ${successLabel.toLowerCase()} to export`, { type: 'error' });
      return;
    }

    try {
      setExporting(true);
      await exportTable(format, rows, columns, filePrefix);
      showToast(`${successLabel} exported successfully`);
    } catch (err) {
      showToast(err.message || 'Export failed', { type: 'error' });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative w-full sm:w-auto" ref={rootRef}>
      <button
        type="button"
        className="btn btn-secondary w-full sm:w-auto"
        disabled={disabled || exporting}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {exporting ? 'Exporting…' : 'Export'}
      </button>

      {open && !exporting && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => handleExport('csv')}
          >
            <FileText className="h-4 w-4 text-slate-500" />
            Export as CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => handleExport('xlsx')}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export as Excel (.xlsx)
          </button>
        </div>
      )}
    </div>
  );
}
