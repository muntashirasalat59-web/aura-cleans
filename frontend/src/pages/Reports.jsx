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
import SummaryStatCard from '../components/ui/SummaryStatCard';
import { downloadCsv } from '../utils/csvExport';
import { formatProductNameWithSize } from '../utils/productDisplay';
import { useDataSync } from '../hooks/useDataSync';

/** Local calendar YYYY-MM-DD (not UTC — toISOString() shifts IST dates back a day). */
function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function formatInr(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : ''}₹${abs}`;
}

export default function Reports() {
  const monthDefault = getPresetRange('month');
  const [fromDate, setFromDate] = useState(monthDefault.from);
  const [toDate, setToDate] = useState(monthDefault.to);
  const [preset, setPreset] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadReport = useCallback(async (silent = false) => {
    if (!fromDate || !toDate || fromDate > toDate) return;
    try {
      if (!silent) setLoading(true);
      setLoadError('');
      const data = await reportsAPI.get({ from: fromDate, to: toDate });
      setReport(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load report');
      if (!silent) alert('Error loading report: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useDataSync('*', () => loadReport(true));

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
  const realizedByProduct = report?.realizedByProduct || [];

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

  function exportRealizedMarginCsv() {
    downloadCsv(
      `realized-margin-${fromDate}-to-${toDate}`,
      [
        'Product',
        'Qty sold',
        'Revenue (actual ₹)',
        'Cost (₹)',
        'Actual profit (₹)',
        'Margin % of revenue',
      ],
      realizedByProduct.map((row) => [
        formatProductNameWithSize(row, 'inline'),
        row.quantity,
        Number(row.revenue).toFixed(2),
        Number(row.cost).toFixed(2),
        Number(row.profit).toFixed(2),
        Number(row.margin_percent).toFixed(1),
      ])
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Sales, purchases, and expenses for any date range — export to CSV for Excel."
      />

      <div className="surface-panel p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarRange className="h-5 w-5 text-[var(--app-accent)] dark:text-indigo-400" />
          <h2 className="text-lg font-semibold text-[var(--app-heading)] dark:text-white">Date range</h2>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <label className="flex flex-col gap-1.5 text-sm flex-1">
              <span className="font-medium text-slate-600 dark:text-slate-300">From</span>
              <input
                type="date"
                className="input input-premium"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm flex-1">
              <span className="font-medium text-slate-600 dark:text-slate-300">To</span>
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
        {loadError && (
          <p className="text-sm text-rose-600 mt-3" role="alert">
            Could not load this report: {loadError}
          </p>
        )}
      </div>

      {loading && !report ? (
        <LoadingState message="Loading report…" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryStatCard
              title="Total sales"
              value={`₹${(summary?.totalSales ?? 0).toLocaleString('en-IN')}`}
              icon={TrendingUp}
              tone="emerald"
            />
            <SummaryStatCard
              title="Total purchases"
              value={`₹${(summary?.totalPurchases ?? 0).toLocaleString('en-IN')}`}
              icon={ShoppingBag}
              tone="indigo"
            />
            <SummaryStatCard
              title="Total expenses"
              value={`₹${(summary?.totalExpenses ?? 0).toLocaleString('en-IN')}`}
              icon={Banknote}
              tone="violet"
            />
            <SummaryStatCard
              title="Net profit"
              value={formatInr(summary?.netProfit ?? 0)}
              subtitle="Sales − purchases − expenses"
              icon={Scale}
              tone="amber"
            />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-[var(--app-heading)] dark:text-white">
              Realized vs catalog margin
            </h2>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Actual profit uses invoice line rates (after negotiation). Catalog potential is list
              price minus cost on the same quantity sold — not the Products page stock estimate.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <SummaryStatCard
                title="Actual profit (realized)"
                value={formatInr(summary?.realizedProfit ?? 0)}
                subtitle="Invoice rate − cost, × qty sold"
              />
              <SummaryStatCard
                title="Catalog potential (qty sold)"
                value={formatInr(summary?.catalogPotential ?? 0)}
                subtitle="List price − cost, × qty sold"
              />
              <SummaryStatCard
                title="Vs list price"
                value={formatInr(summary?.realizedVsCatalog ?? 0)}
                subtitle={
                  Number(summary?.realizedVsCatalog) < 0
                    ? 'Discount vs catalog (actual is lower)'
                    : Number(summary?.realizedVsCatalog) > 0
                      ? 'Sold above list price'
                      : 'Same as list price'
                }
              />
            </div>
          </div>

          <ReportSection
            title="Actual profit by product"
            description={`${realizedByProduct.length} product(s) · sorted by highest actual profit`}
            onExport={exportRealizedMarginCsv}
            exportLabel="Export realized margin CSV"
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Qty sold</th>
                  <th className="text-right">Revenue (actual)</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Actual profit</th>
                  <th className="text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {realizedByProduct.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500">
                      No sold products in this range.
                    </td>
                  </tr>
                ) : (
                  realizedByProduct.map((row) => (
                    <tr key={row.product_id ?? `${row.product_name}-${row.unit_size}`}>
                      <td className="font-medium text-slate-900">
                        {formatProductNameWithSize(row, 'inline')}
                      </td>
                      <td className="text-right tabular-nums">{row.quantity}</td>
                      <td className="text-right tabular-nums">{formatInr(row.revenue)}</td>
                      <td className="text-right tabular-nums">{formatInr(row.cost)}</td>
                      <td
                        className={`text-right font-semibold tabular-nums ${
                          Number(row.profit) >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {formatInr(row.profit)}
                      </td>
                      <td className="text-right tabular-nums">
                        {Number(row.margin_percent).toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ReportSection>

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

function ReportSection({ title, description, onExport, exportLabel, children }) {
  return (
    <div className="table-wrap">
      <div className="table-section-header px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-800/90 dark:to-slate-900">
        <div>
          <h3 className="card-section-title mb-0">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
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
