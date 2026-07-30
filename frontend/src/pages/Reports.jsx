import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Banknote,
  Scale,
  FileSpreadsheet,
  CalendarRange,
} from 'lucide-react';
import { reportsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import SegmentedControl from '../components/forms/SegmentedControl';
import { downloadCsv } from '../utils/csvExport';
import { formatProductNameWithSize } from '../utils/productDisplay';

function formatDateISO(d) {
  return d.toISOString().split('T')[0];
}

function getPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = formatDateISO(today);

  if (preset === 'week') {
    const start = new Date(today);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { from: formatDateISO(start), to };
  }
  if (preset === 'month') {
    return { from: formatDateISO(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (preset === 'year') {
    return { from: formatDateISO(new Date(today.getFullYear(), 0, 1)), to };
  }
  return { from: to, to };
}

function formatDisplayDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Reports() {
  const monthDefault = getPresetRange('month');
  const [fromDate, setFromDate] = useState(monthDefault.from);
  const [toDate, setToDate] = useState(monthDefault.to);
  const [preset, setPreset] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    if (!fromDate || !toDate || fromDate > toDate) return;
    try {
      setLoading(true);
      const data = await reportsAPI.get({ from: fromDate, to: toDate });
      setReport(data);
    } catch (err) {
      alert('Error loading report: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function applyPreset(value) {
    setPreset(value);
    const range = getPresetRange(value);
    setFromDate(range.from);
    setToDate(range.to);
  }

  function handleFromChange(value) {
    setPreset('custom');
    setFromDate(value);
  }

  function handleToChange(value) {
    setPreset('custom');
    setToDate(value);
  }

  const summary = report?.summary;
  const sales = report?.sales || [];
  const purchases = report?.purchases || [];
  const expenses = report?.expenses || [];
  const salesLineItems = report?.salesLineItems || [];
  const purchaseLineItems = report?.purchaseLineItems || [];

  function exportSalesCsv() {
    downloadCsv(
      `sales-report-${fromDate}-to-${toDate}`,
      ['Date', 'Invoice No.', 'Party', 'Amount (₹)'],
      sales.map((row) => [
        row.invoice_date,
        row.invoice_number,
        row.party_name || '',
        Number(row.total_amount).toFixed(2),
      ])
    );
  }

  function exportPurchasesCsv() {
    downloadCsv(
      `purchases-report-${fromDate}-to-${toDate}`,
      ['Date', 'Party', 'Amount (₹)', 'Notes'],
      purchases.map((row) => [
        row.purchase_date,
        row.party_name || '',
        Number(row.total_amount).toFixed(2),
        row.notes || '',
      ])
    );
  }

  function exportSalesLineItemsCsv() {
    downloadCsv(
      `sales-line-items-${fromDate}-to-${toDate}`,
      ['Date', 'Invoice No.', 'Party', 'Product', 'Qty', 'Amount (₹)'],
      salesLineItems.map((row) => [
        row.invoice_date,
        row.invoice_number,
        row.party_name || '',
        formatProductNameWithSize(row, 'inline'),
        row.quantity,
        Number(row.amount).toFixed(2),
      ])
    );
  }

  function exportPurchaseLineItemsCsv() {
    downloadCsv(
      `purchase-line-items-${fromDate}-to-${toDate}`,
      ['Date', 'Party', 'Product', 'Qty', 'Amount (₹)', 'Notes'],
      purchaseLineItems.map((row) => [
        row.purchase_date,
        row.party_name || '',
        formatProductNameWithSize(row, 'inline'),
        row.quantity,
        Number(row.amount).toFixed(2),
        row.notes || '',
      ])
    );
  }

  function exportExpensesCsv() {
    downloadCsv(
      `expenses-report-${fromDate}-to-${toDate}`,
      ['Date', 'Category', 'Title', 'Payment', 'Amount (₹)'],
      expenses.map((row) => [
        row.expense_date,
        row.category,
        row.title,
        row.payment_method,
        Number(row.amount).toFixed(2),
      ])
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Sales, purchases, and expenses for any date range — export to CSV for Excel."
      />

      <div className="premium-glass-card p-5 sm:p-6 border border-indigo-200/40">
        <div className="flex items-center gap-2 mb-4">
          <CalendarRange className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Date range</h2>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <label className="flex flex-col gap-1.5 text-sm flex-1">
              <span className="font-medium text-slate-600">From</span>
              <input
                type="date"
                className="input input-premium"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm flex-1">
              <span className="font-medium text-slate-600">To</span>
              <input
                type="date"
                className="input input-premium"
                value={toDate}
                onChange={(e) => handleToChange(e.target.value)}
              />
            </label>
          </div>
          <SegmentedControl
            value={preset === 'custom' ? '' : preset}
            onChange={applyPreset}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
              { value: 'year', label: 'This year' },
            ]}
          />
        </div>
        {fromDate > toDate && (
          <p className="text-sm text-rose-600 mt-3">From date must be on or before to date.</p>
        )}
      </div>

      {loading && !report ? (
        <LoadingState message="Loading report…" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard
              title="Total sales"
              value={`₹${(summary?.totalSales ?? 0).toLocaleString('en-IN')}`}
              icon={TrendingUp}
              tone="emerald"
            />
            <SummaryCard
              title="Total purchases"
              value={`₹${(summary?.totalPurchases ?? 0).toLocaleString('en-IN')}`}
              icon={ShoppingBag}
              tone="indigo"
            />
            <SummaryCard
              title="Total expenses"
              value={`₹${(summary?.totalExpenses ?? 0).toLocaleString('en-IN')}`}
              icon={Banknote}
              tone="violet"
            />
            <SummaryCard
              title="Net profit"
              value={`₹${(summary?.netProfit ?? 0).toLocaleString('en-IN')}`}
              subtitle="Sales − purchases − expenses"
              icon={Scale}
              tone="amber"
            />
          </div>

          <ReportSection
            title="Sales report"
            description={`${sales.length} invoice(s) · ${formatDisplayDate(fromDate)} – ${formatDisplayDate(toDate)}`}
            onExport={exportSalesCsv}
            exportLabel="Export sales CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice no.</th>
                  <th>Party</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-slate-500">
                      No sales in this range.
                    </td>
                  </tr>
                ) : (
                  sales.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular-nums whitespace-nowrap">{formatDisplayDate(row.invoice_date)}</td>
                      <td className="font-medium text-slate-900">{row.invoice_number}</td>
                      <td>{row.party_name || '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-emerald-700">
                        ₹{Number(row.total_amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection
            title="Sales line items"
            description={`${salesLineItems.length} product line(s) sold`}
            onExport={exportSalesLineItemsCsv}
            exportLabel="Export line items CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice</th>
                  <th>Party</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {salesLineItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500">
                      No sales line items in this range.
                    </td>
                  </tr>
                ) : (
                  salesLineItems.map((row, index) => (
                    <tr key={`${row.invoice_number}-${index}`}>
                      <td className="tabular-nums whitespace-nowrap">{formatDisplayDate(row.invoice_date)}</td>
                      <td className="font-medium text-slate-900">{row.invoice_number}</td>
                      <td>{row.party_name || '—'}</td>
                      <td className="font-medium text-slate-900">
                        {formatProductNameWithSize(row, 'inline')}
                      </td>
                      <td className="text-right tabular-nums">{row.quantity}</td>
                      <td className="text-right font-semibold tabular-nums text-emerald-700">
                        ₹{Number(row.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection
            title="Purchase report"
            description={`${purchases.length} purchase(s)`}
            onExport={exportPurchasesCsv}
            exportLabel="Export purchases CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Party</th>
                  <th>Notes</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-slate-500">
                      No purchases in this range.
                    </td>
                  </tr>
                ) : (
                  purchases.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular-nums whitespace-nowrap">{formatDisplayDate(row.purchase_date)}</td>
                      <td>{row.party_name || '—'}</td>
                      <td className="text-slate-600 max-w-[200px] truncate">{row.notes || '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-indigo-700">
                        ₹{Number(row.total_amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection
            title="Purchase line items"
            description={`${purchaseLineItems.length} product line(s) purchased`}
            onExport={exportPurchaseLineItemsCsv}
            exportLabel="Export line items CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Party</th>
                  <th>Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {purchaseLineItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500">
                      No purchase line items in this range.
                    </td>
                  </tr>
                ) : (
                  purchaseLineItems.map((row, index) => (
                    <tr key={`${row.purchase_date}-${row.product_name}-${index}`}>
                      <td className="tabular-nums whitespace-nowrap">{formatDisplayDate(row.purchase_date)}</td>
                      <td>{row.party_name || '—'}</td>
                      <td className="font-medium text-slate-900">
                        {formatProductNameWithSize(row, 'inline')}
                      </td>
                      <td className="text-right tabular-nums">{row.quantity}</td>
                      <td className="text-right font-semibold tabular-nums text-indigo-700">
                        ₹{Number(row.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="text-slate-600 max-w-[200px] truncate">{row.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>

          <ReportSection
            title="Expense report"
            description={`${expenses.length} expense(s)`}
            onExport={exportExpensesCsv}
            exportLabel="Export expenses CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Title</th>
                  <th>Payment</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-slate-500">
                      No expenses in this range.
                    </td>
                  </tr>
                ) : (
                  expenses.map((row) => (
                    <tr key={row.id}>
                      <td className="tabular-nums whitespace-nowrap">{formatDisplayDate(row.expense_date)}</td>
                      <td>
                        <span className="badge badge-blue">{row.category}</span>
                      </td>
                      <td className="font-medium text-slate-900">{row.title}</td>
                      <td>{row.payment_method}</td>
                      <td className="text-right font-semibold tabular-nums text-rose-700">
                        ₹{Number(row.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon: Icon, tone }) {
  const styles = {
    emerald: 'border-emerald-200/50 from-emerald-50/50',
    indigo: 'border-indigo-200/50 from-indigo-50/50',
    violet: 'border-violet-200/50 from-violet-50/50',
    amber: 'border-amber-200/50 from-amber-50/40',
  };
  const icons = {
    emerald: 'from-emerald-500 to-emerald-700',
    indigo: 'from-indigo-700 to-indigo-950',
    violet: 'from-violet-600 to-indigo-900',
    amber: 'from-amber-500 to-amber-700',
  };

  return (
    <div
      className={`premium-glass-card p-5 border bg-gradient-to-br via-white to-white ${styles[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${icons[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ReportSection({ title, description, onExport, exportLabel, children }) {
  return (
    <div className="table-wrap">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white">
        <div>
          <h3 className="card-section-title mb-0">{title}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
        <button type="button" onClick={onExport} className="btn btn-secondary w-full sm:w-auto">
          <FileSpreadsheet className="h-4 w-4" />
          {exportLabel}
        </button>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
