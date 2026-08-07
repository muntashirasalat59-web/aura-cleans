import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Boxes,
  IndianRupee,
  Sparkles,
  BarChart3,
  Layers,
  PackageCheck,
  CalendarDays,
  Wallet,
  AlertTriangle,
  Activity,
  Zap,
  UserPlus,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Gauge,
  Trophy,
  Banknote,
  Scale,
  X,
  Receipt,
} from 'lucide-react';
import { dashboardAPI } from '../api';
import LoadingState from '../components/LoadingState';
import TrendChart from '../components/dashboard/TrendChart';
import { formatProductNameWithSize, formatQuantityWithSize } from '../utils/productDisplay';
import { formatDisplayDate } from '../utils/invoicePayment';
import { LOW_STOCK_THRESHOLD, STOCK_ALERT_DISMISS_KEY } from '../config/stock';
import { PAYMENT_ALERT_DISMISS_KEY, PAYABLE_ALERT_DISMISS_KEY } from '../config/payments';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [trendRange, setTrendRange] = useState('7');
  const [stockAlertDismissed, setStockAlertDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STOCK_ALERT_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [paymentAlertDismissed, setPaymentAlertDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(PAYMENT_ALERT_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [payableAlertDismissed, setPayableAlertDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(PAYABLE_ALERT_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoadError(null);
      setLoading(true);
      const data = await dashboardAPI.getStats();
      setStats(data);
    } catch (err) {
      setLoadError(err.message || 'Failed to load dashboard');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!stats?.trends) return [];
    if (trendRange === '7') return stats.trends.last7Days;
    if (trendRange === '30') return stats.trends.last30Days;
    return stats.trends.thisMonth;
  }, [stats, trendRange]);

  // Must stay above early returns — Rules of Hooks.
  const stockAlertProducts = useMemo(() => {
    return (stats?.productInsights || [])
      .filter((p) => Number(p.stock_quantity) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
  }, [stats?.productInsights]);

  const pendingInvoices = useMemo(() => stats?.pendingInvoices || [], [stats?.pendingInvoices]);
  const pendingPurchases = useMemo(() => stats?.pendingPurchases || [], [stats?.pendingPurchases]);

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (!stats) {
    return (
      <div className="max-w-lg mx-auto mt-16 premium-glass-card p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Could not load dashboard</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{loadError || 'Unknown error'}</p>
        <button type="button" onClick={loadStats} className="btn btn-primary mt-6">
          Retry
        </button>
      </div>
    );
  }

  const insights = stats.productInsights || [];
  const recentActivity = stats.recentActivity || [];
  const topProducts = stats.topSellingProducts || [];
  const health = stats.businessHealth || {};
  const netProfit = stats.netProfit ?? stats.totalSales - stats.totalPurchases;
  const totalOutstanding = stats.outstandingAR ?? stats.pendingPayments ?? 0;

  const showStockAlert = !stockAlertDismissed && stockAlertProducts.length > 0;
  const stockAlertPreview = stockAlertProducts.slice(0, 5);

  const pendingTotalDue = Number(stats.pendingPayments ?? 0);
  const pendingCount = stats.pendingInvoiceCount ?? pendingInvoices.length;
  // Banner needs invoice rows from API (pendingInvoices). KPI amount alone is not enough.
  const showPaymentAlert =
    !paymentAlertDismissed && pendingInvoices.length > 0 && pendingTotalDue > 0;
  const paymentAlertPreview = pendingInvoices.slice(0, 5);
  const paymentTone = stats.pendingTone || 'info';

  const payableTotalDue = Number(stats.pendingPayables ?? 0);
  const payableCount = stats.pendingPurchaseCount ?? pendingPurchases.length;
  const showPayableAlert =
    !payableAlertDismissed && pendingPurchases.length > 0 && payableTotalDue > 0;
  const payableAlertPreview = pendingPurchases.slice(0, 5);
  const payableTone = stats.pendingPayableTone || 'info';

  function dismissStockAlert() {
    setStockAlertDismissed(true);
    try {
      sessionStorage.setItem(STOCK_ALERT_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function dismissPaymentAlert() {
    setPaymentAlertDismissed(true);
    try {
      sessionStorage.setItem(PAYMENT_ALERT_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  function dismissPayableAlert() {
    setPayableAlertDismissed(true);
    try {
      sessionStorage.setItem(PAYABLE_ALERT_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  const topMaxQty = Math.max(...topProducts.map((p) => p.quantity_sold), 1);

  return (
    <div className="dashboard-shell space-y-6 sm:space-y-8">
      {/* First in DOM so it shows above the fold on login / dashboard load (no scroll). */}
      {showStockAlert && (
        <div
          role="alert"
          className="relative z-10 overflow-hidden rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 px-4 py-4 sm:px-5 sm:py-4 shadow-sm dark:border-amber-500/40 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-amber-950/50"
        >
          <div className="flex gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-amber-950 dark:text-amber-100">
                    {stockAlertProducts.length} product
                    {stockAlertProducts.length === 1 ? '' : 's'} are running low on stock
                  </p>
                  <p className="mt-0.5 text-sm text-amber-900/80 dark:text-amber-200/80">
                    Stock at or below {LOW_STOCK_THRESHOLD} units — review and reorder soon.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissStockAlert}
                  className="shrink-0 rounded-lg p-1.5 text-amber-800/70 transition-colors hover:bg-amber-200/50 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-50"
                  aria-label="Dismiss stock alert"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="mt-3 flex flex-wrap gap-2">
                {stockAlertPreview.map((product) => (
                  <li
                    key={product.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/60 bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    <span className="truncate max-w-[10rem] sm:max-w-[14rem]">
                      {formatProductNameWithSize(product, 'paren')}
                    </span>
                    <span className="tabular-nums text-amber-700 dark:text-amber-300">
                      ({Number(product.stock_quantity).toLocaleString('en-IN')})
                    </span>
                  </li>
                ))}
                {stockAlertProducts.length > stockAlertPreview.length && (
                  <li className="inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium text-amber-800/80 dark:text-amber-200/80">
                    +{stockAlertProducts.length - stockAlertPreview.length} more
                  </li>
                )}
              </ul>

              <div className="mt-3">
                <Link
                  to={`/products?stock=low&threshold=${LOW_STOCK_THRESHOLD}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
                >
                  View details
                  <Package className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentAlert && (
        <PaymentAlertBanner
          count={pendingCount}
          totalDue={pendingTotalDue}
          tone={paymentTone}
          preview={paymentAlertPreview}
          totalCount={pendingInvoices.length}
          onDismiss={dismissPaymentAlert}
        />
      )}

      {showPayableAlert && (
        <PayableAlertBanner
          count={payableCount}
          totalDue={payableTotalDue}
          tone={payableTone}
          preview={payableAlertPreview}
          totalCount={pendingPurchases.length}
          onDismiss={dismissPayableAlert}
        />
      )}

      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 px-6 py-5 sm:px-8 sm:py-6 text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.08),transparent_50%)]" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="min-w-0 md:max-w-[52%] lg:max-w-[48%]">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-200/90 ring-1 ring-emerald-400/20 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              AURA CLEAN · Executive dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tighter text-white">
              Welcome back
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-xl">
              Sales, manufacturing, receivables, and hygiene SKU inventory — one premium command center.
            </p>
          </div>
          <div className="flex w-full md:w-auto flex-col sm:flex-row sm:flex-nowrap sm:items-end gap-4 sm:gap-0 md:shrink-0">
            <div className="min-w-0 sm:shrink-0">
              <p className="text-amber-200/80 text-xs uppercase tracking-wider font-medium whitespace-nowrap">Net profit</p>
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums mt-1 whitespace-nowrap ${
                  netProfit < 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                ₹{netProfit.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="min-w-0 sm:shrink-0 pt-4 border-t border-white/10 sm:pt-0 sm:border-t-0 sm:border-l sm:border-white/15 sm:pl-6 md:pl-8 pr-1">
              <p className="text-amber-200/80 text-[10px] uppercase tracking-wide font-medium whitespace-nowrap">
                This month revenue
              </p>
              <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-emerald-300 whitespace-nowrap">
                ₹{(stats.monthRevenue ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="min-w-0 sm:shrink-0 pt-4 border-t border-white/10 sm:pt-0 sm:border-t-0 sm:border-l sm:border-white/15 sm:pl-5 md:pl-7">
              <p className="text-amber-200/80 text-xs uppercase tracking-wider font-medium whitespace-nowrap">Stock value</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-amber-100 whitespace-nowrap">
                ₹{stats.stockValue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Total Sales"
          value={`₹${stats.totalSales.toLocaleString('en-IN')}`}
          variant="sales"
          icon={TrendingUp}
        />
        <StatCard
          title="Total Purchases"
          value={`₹${stats.totalPurchases.toLocaleString('en-IN')}`}
          variant="purchases"
          icon={ShoppingBag}
        />
        <StatCard
          title="Products"
          value={stats.productCount}
          variant="products"
          icon={Package}
        />
        <StatCard
          title="Total Stock"
          value={stats.totalStock.toLocaleString('en-IN')}
          subtitle={`Value ₹${stats.stockValue.toLocaleString('en-IN')}`}
          variant="stock"
          icon={Boxes}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiChip
          title="Today's sales"
          value={`₹${(stats.todaysSales ?? 0).toLocaleString('en-IN')}`}
          icon={CalendarDays}
          tone="emerald"
        />
        <KpiChip
          title="This month revenue"
          value={`₹${(stats.monthRevenue ?? 0).toLocaleString('en-IN')}`}
          icon={TrendingUp}
          tone="indigo"
        />
        <KpiChip
          title="Expenses (this month)"
          value={`₹${(stats.expensesThisMonth ?? 0).toLocaleString('en-IN')}`}
          icon={Banknote}
          tone="violet"
        />
        <KpiChip
          title="Total outstanding"
          value={`₹${Number(totalOutstanding).toLocaleString('en-IN')}`}
          subtitle={
            pendingTotalDue > 0 && stats.pendingPartiesCount > 0
              ? `${stats.pendingPartiesCount} part${stats.pendingPartiesCount === 1 ? 'y' : 'ies'} due`
              : pendingTotalDue > 0
                ? 'Unpaid invoices'
                : 'No dues'
          }
          icon={Scale}
          tone="amber"
        />
        <KpiChip
          title="Pending payments"
          value={`₹${pendingTotalDue.toLocaleString('en-IN')}`}
          subtitle={
            pendingTotalDue > 0
              ? pendingCount > 0
                ? `${pendingCount} invoice${pendingCount === 1 ? '' : 's'} due`
                : 'Unpaid invoices'
              : 'All clear'
          }
          icon={Wallet}
          tone={paymentTone === 'danger' ? 'rose' : paymentTone === 'warning' ? 'amber' : 'indigo'}
        />
        <KpiChip
          title="Low stock items"
          value={stats.lowStockCount ?? 0}
          subtitle={`Below ${stats.lowStockThreshold ?? LOW_STOCK_THRESHOLD} units`}
          icon={AlertTriangle}
          tone="rose"
        />
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 dark:text-slate-100">Quick actions</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <QuickAction to="/sales" label="New sale" icon={TrendingUp} accent="emerald" />
          <QuickAction to="/purchases" label="New purchase" icon={ShoppingBag} accent="indigo" />
          <QuickAction to="/products" label="Add product" icon={Package} accent="violet" />
          <QuickAction to="/parties" label="Add party" icon={UserPlus} accent="amber" />
          <QuickAction to="/expenses" label="Add expense" icon={Banknote} accent="indigo" />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 min-w-0">
          <TrendChart data={chartData} range={trendRange} onRangeChange={setTrendRange} />
        </div>
        <BusinessHealthWidget health={health} stats={stats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="premium-glass-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-amber-200 shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent activity</h3>
              <p className="text-sm text-slate-500">Latest sales and purchases</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No transactions yet.</p>
          ) : (
            <ul className="relative space-y-0">
              {recentActivity.map((item, index) => (
                <ActivityTimelineItem key={item.id} item={item} isLast={index === recentActivity.length - 1} />
              ))}
            </ul>
          )}
        </div>

        <div className="premium-glass-card p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top selling products</h3>
              <p className="text-sm text-slate-500">By quantity sold & revenue</p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No sales data yet.</p>
          ) : (
            <ul className="space-y-4">
              {topProducts.map((product, rank) => (
                <li key={product.id} className="flex gap-4 items-start">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600 tabular-nums">
                    {rank + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 items-baseline">
                      <p className="font-semibold text-slate-900 truncate">
                        {formatProductNameWithSize(product, 'paren')}
                      </p>
                      <p className="text-sm font-bold text-emerald-600 tabular-nums shrink-0">
                        ₹{product.revenue.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatQuantityWithSize(product.quantity_sold, product)} sold
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                        style={{ width: `${(product.quantity_sold / topMaxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="premium-glass-card overflow-hidden p-0">
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-950 text-amber-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Purchase & sales by product</h3>
              <p className="text-sm text-slate-500">Units purchased, sold, and remaining stock per SKU</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Purchased</th>
                <th>Sold</th>
                <th>Current stock</th>
                <th className="min-w-[140px]">Movement</th>
              </tr>
            </thead>
            <tbody>
              {insights.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    No products yet. Add products to see purchase vs sales breakdown.
                  </td>
                </tr>
              ) : (
                insights.map((row) => <ProductMovementRow key={row.id} row={row} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="premium-glass-card overflow-hidden p-0">
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/40 via-white to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Stock overview & reorder</h3>
                <p className="text-sm text-slate-500">
                  Below {stats.lowStockThreshold ?? LOW_STOCK_THRESHOLD} units triggers reorder suggestion
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product name</th>
                <th>Available stock</th>
                <th>Total sold</th>
                <th>Status</th>
                <th>Suggested reorder qty</th>
              </tr>
            </thead>
            <tbody>
              {insights.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    No inventory data available.
                  </td>
                </tr>
              ) : (
                insights.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-slate-900">
                      {formatProductNameWithSize(row, 'paren')}
                    </td>
                    <td>
                      <span
                        className={
                          row.stock_quantity <= (stats.lowStockThreshold ?? LOW_STOCK_THRESHOLD)
                            ? 'font-bold text-amber-700 tabular-nums'
                            : 'tabular-nums'
                        }
                      >
                        {formatQuantityWithSize(row.stock_quantity, row)}
                      </span>
                    </td>
                    <td className="tabular-nums">{row.total_sold}</td>
                    <td>
                      {row.needs_reorder ? (
                        <span className="badge badge-red font-semibold">{row.status_label}</span>
                      ) : (
                        <span className="badge badge-green">{row.status_label}</span>
                      )}
                    </td>
                    <td className="tabular-nums font-medium text-slate-800">
                      {row.suggested_reorder_qty > 0 ? (
                        <span className="text-amber-800">{row.suggested_reorder_qty} units</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, label, icon: Icon, accent }) {
  const styles = {
    emerald: 'border-emerald-200/60 hover:border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white icon:bg-emerald-600',
    indigo: 'border-indigo-200/60 hover:border-indigo-300 bg-gradient-to-br from-indigo-50/80 to-white',
    violet: 'border-violet-200/60 hover:border-violet-300 bg-gradient-to-br from-violet-50/80 to-white',
    amber: 'border-amber-200/60 hover:border-amber-300 bg-gradient-to-br from-amber-50/80 to-white',
  };
  const iconBg = {
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    indigo: 'bg-gradient-to-br from-indigo-700 to-indigo-950',
    violet: 'bg-gradient-to-br from-violet-600 to-indigo-900',
    amber: 'bg-gradient-to-br from-amber-500 to-amber-700',
  };

  return (
    <Link
      to={to}
      className={`group flex flex-col items-center gap-3 rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${styles[accent]}`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg group-hover:scale-105 transition-transform ${iconBg[accent]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-semibold text-slate-800 text-center">{label}</span>
      <PlusCircle className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
    </Link>
  );
}

function KpiChip({ title, value, subtitle, icon: Icon, tone }) {
  const toneMap = {
    emerald: 'border-emerald-200/50 bg-emerald-50/40 text-emerald-800',
    indigo: 'border-indigo-200/50 bg-indigo-50/40 text-indigo-900',
    amber: 'border-amber-200/50 bg-amber-50/40 text-amber-900',
    rose: 'border-rose-200/50 bg-rose-50/30 text-rose-900',
    violet: 'border-violet-200/50 bg-violet-50/40 text-violet-900',
  };
  const iconMap = {
    emerald: 'text-emerald-600',
    indigo: 'text-indigo-700',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    violet: 'text-violet-700',
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 sm:py-4 min-h-[5.5rem] h-full backdrop-blur-sm overflow-hidden ${toneMap[tone]}`}
    >
      <div className="flex items-start justify-between gap-2 h-full">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider opacity-80">{title}</p>
          <p className="mt-1 text-lg sm:text-xl font-bold tabular-nums truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-[11px] sm:text-xs opacity-70 truncate">{subtitle}</p>}
        </div>
        <Icon className={`h-5 w-5 shrink-0 opacity-80 ${iconMap[tone]}`} />
      </div>
    </div>
  );
}

function ActivityTimelineItem({ item, isLast }) {
  const isSale = item.type === 'sale';
  const dateLabel = item.date
    ? new Date(item.date + 'T12:00:00').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <li className="relative flex gap-4 pb-6">
      {!isLast && (
        <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gradient-to-b from-slate-200 to-transparent" />
      )}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
          isSale ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
        }`}
      >
        {isSale ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{isSale ? 'Sale' : 'Purchase'}</p>
            <p className="text-sm text-slate-600 truncate max-w-[200px] sm:max-w-none">{item.title}</p>
            {item.party_name && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{item.party_name}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p
              className={`font-bold tabular-nums text-sm ${isSale ? 'text-emerald-600' : 'text-indigo-700'}`}
            >
              {isSale ? '+' : '−'}₹{item.amount.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{dateLabel}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

function BusinessHealthWidget({ health, stats }) {
  const insufficient = Boolean(health.insufficientData);
  const score = insufficient ? 0 : Number(health.healthScore ?? 0);
  const margin = health.profitMarginPercent ?? 0;
  const monthProfit = health.monthNetProfit ?? stats.monthNetProfit ?? 0;
  const collectionRate = health.collectionRatePercent;
  const status = health.healthStatus ?? 'stable';
  const label = health.healthLabel ?? 'Stable';
  const hint = health.hint;

  const ringColor =
    status === 'healthy'
      ? 'stroke-emerald-500'
      : status === 'attention'
        ? 'stroke-rose-500'
        : status === 'insufficient'
          ? 'stroke-slate-300'
          : 'stroke-amber-500';

  const labelColor =
    status === 'healthy'
      ? 'text-emerald-700 dark:text-emerald-400'
      : status === 'attention'
        ? 'text-rose-700 dark:text-rose-400'
        : status === 'insufficient'
          ? 'text-slate-600 dark:text-slate-300'
          : 'text-amber-700 dark:text-amber-400';

  const circumference = 2 * Math.PI * 42;
  const offset = insufficient
    ? circumference
    : circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="premium-glass-card p-6 sm:p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-900 text-amber-200 shadow-md">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Business health</h3>
          <p className="text-sm text-slate-500">
            {insufficient ? 'Waiting on more sales history' : 'Collections, stock & trend'}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center flex-1 justify-center py-2">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={ringColor}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
            {insufficient ? (
              <>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                  Not enough data
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-1">
                  Yet
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{score}</span>
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score</span>
              </>
            )}
          </div>
        </div>
        <p className={`mt-4 text-sm font-semibold ${labelColor}`}>{label}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500 text-center max-w-[220px]">{hint}</p> : null}
      </div>

      <div className="space-y-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Profit this month</span>
          <span
            className={`font-bold tabular-nums ${
              monthProfit < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            ₹{Number(monthProfit).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400">Collection rate</span>
          <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {collectionRate != null ? `${collectionRate}%` : '—'}
          </span>
        </div>
        {!insufficient && (
          <div className="flex justify-between text-xs text-slate-500">
            <span className={margin < 0 ? 'text-rose-500' : 'text-emerald-600'}>
              Margin {margin}%
            </span>
            <span>
              {stats.lowStockCount ?? 0} low stock · ₹
              {(stats.pendingPayments ?? 0).toLocaleString('en-IN')} due
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentAlertBanner({ count, totalDue, tone, preview, totalCount, onDismiss }) {
  const styles = {
    danger: {
      wrap: 'border-red-300/70 bg-gradient-to-r from-red-50 via-rose-50 to-red-50 dark:border-red-500/40 dark:from-red-950/50 dark:via-rose-950/40 dark:to-red-950/50',
      iconWrap: 'bg-red-500/15 text-red-700 ring-red-500/30 dark:bg-red-400/10 dark:text-red-300',
      title: 'text-red-950 dark:text-red-100',
      sub: 'text-red-900/80 dark:text-red-200/80',
      dismiss:
        'text-red-800/70 hover:bg-red-200/50 hover:text-red-950 dark:text-red-200/70 dark:hover:bg-red-900/50 dark:hover:text-red-50',
      link: 'text-red-900 dark:text-red-200',
    },
    warning: {
      wrap: 'border-amber-300/70 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:border-amber-500/40 dark:from-amber-950/50 dark:via-yellow-950/40 dark:to-amber-950/50',
      iconWrap: 'bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300',
      title: 'text-amber-950 dark:text-amber-100',
      sub: 'text-amber-900/80 dark:text-amber-200/80',
      dismiss:
        'text-amber-800/70 hover:bg-amber-200/50 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-50',
      link: 'text-amber-900 dark:text-amber-200',
    },
    info: {
      wrap: 'border-sky-300/70 bg-gradient-to-r from-sky-50 via-blue-50 to-slate-50 dark:border-sky-500/40 dark:from-sky-950/50 dark:via-blue-950/40 dark:to-slate-950/50',
      iconWrap: 'bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:bg-sky-400/10 dark:text-sky-300',
      title: 'text-sky-950 dark:text-sky-100',
      sub: 'text-sky-900/80 dark:text-sky-200/80',
      dismiss:
        'text-sky-800/70 hover:bg-sky-200/50 hover:text-sky-950 dark:text-sky-200/70 dark:hover:bg-sky-900/50 dark:hover:text-sky-50',
      link: 'text-sky-900 dark:text-sky-200',
    },
  }[tone] || {
    wrap: 'border-sky-300/70 bg-sky-50',
    iconWrap: 'bg-sky-500/15 text-sky-700 ring-sky-500/30',
    title: 'text-sky-950',
    sub: 'text-sky-900/80',
    dismiss: 'text-sky-800/70 hover:bg-sky-200/50',
    link: 'text-sky-900',
  };

  const rowStyles = {
    overdue:
      'border-red-300/70 bg-red-50/90 text-red-950 dark:border-red-700/50 dark:bg-red-950/50 dark:text-red-100',
    due_soon:
      'border-amber-300/70 bg-amber-50/90 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-100',
    upcoming:
      'border-slate-200/80 bg-white/80 text-slate-800 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100',
    none: 'border-slate-200/80 bg-white/80 text-slate-800 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100',
  };

  return (
    <div
      role="alert"
      className={`relative z-10 overflow-hidden rounded-2xl border px-4 py-4 sm:px-5 sm:py-4 shadow-sm ${styles.wrap}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.iconWrap}`}
        >
          <Receipt className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-semibold ${styles.title}`}>
                {count} invoice{count === 1 ? '' : 's'} pending — ₹
                {Number(totalDue).toLocaleString('en-IN')} total due
              </p>
              <p className={`mt-0.5 text-sm ${styles.sub}`}>
                Collect outstanding balances. Overdue rows are highlighted in red.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className={`shrink-0 rounded-lg p-1.5 transition-colors ${styles.dismiss}`}
              aria-label="Dismiss payment alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {preview.map((inv) => (
              <li
                key={inv.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm ${rowStyles[inv.urgency] || rowStyles.none}`}
              >
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="font-semibold truncate max-w-[10rem] sm:max-w-[14rem]">
                    {inv.party_name}
                  </span>
                  <span className="tabular-nums opacity-80">{inv.invoice_number}</span>
                  {inv.urgency === 'overdue' && (
                    <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Overdue
                    </span>
                  )}
                  {inv.urgency === 'due_soon' && (
                    <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Due soon
                    </span>
                  )}
                  {inv.payment_status === 'partial' && (
                    <span className="rounded-full bg-slate-500/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Partial
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 tabular-nums shrink-0">
                  <span className="font-semibold">
                    ₹{Number(inv.balance_due).toLocaleString('en-IN')}
                  </span>
                  <span className="opacity-70">
                    {inv.payment_due_date
                      ? formatDisplayDate(inv.payment_due_date)
                      : 'No due date'}
                  </span>
                </div>
              </li>
            ))}
            {totalCount > preview.length && (
              <li className={`text-xs font-medium opacity-80 ${styles.sub}`}>
                +{totalCount - preview.length} more invoice{totalCount - preview.length === 1 ? '' : 's'}
              </li>
            )}
          </ul>

          <div className="mt-3">
            <Link
              to="/sales?payment=pending"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline ${styles.link}`}
            >
              View all receivables
              <Wallet className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Supplier payables — violet theme to distinguish from customer receivables (sky/rose). */
function PayableAlertBanner({ count, totalDue, tone, preview, totalCount, onDismiss }) {
  const styles = {
    danger: {
      wrap: 'border-violet-400/70 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-violet-50 dark:border-violet-500/40 dark:from-violet-950/50 dark:via-fuchsia-950/40 dark:to-violet-950/50',
      iconWrap: 'bg-violet-500/15 text-violet-800 ring-violet-500/30 dark:bg-violet-400/10 dark:text-violet-300',
      title: 'text-violet-950 dark:text-violet-100',
      sub: 'text-violet-900/80 dark:text-violet-200/80',
      dismiss:
        'text-violet-800/70 hover:bg-violet-200/50 hover:text-violet-950 dark:text-violet-200/70 dark:hover:bg-violet-900/50 dark:hover:text-violet-50',
      link: 'text-violet-900 dark:text-violet-200',
    },
    warning: {
      wrap: 'border-violet-300/70 bg-gradient-to-r from-violet-50 via-purple-50 to-amber-50/40 dark:border-violet-500/40 dark:from-violet-950/50 dark:via-purple-950/40 dark:to-amber-950/30',
      iconWrap: 'bg-violet-500/15 text-violet-800 ring-violet-500/30 dark:bg-violet-400/10 dark:text-violet-300',
      title: 'text-violet-950 dark:text-violet-100',
      sub: 'text-violet-900/80 dark:text-violet-200/80',
      dismiss:
        'text-violet-800/70 hover:bg-violet-200/50 hover:text-violet-950 dark:text-violet-200/70 dark:hover:bg-violet-900/50 dark:hover:text-violet-50',
      link: 'text-violet-900 dark:text-violet-200',
    },
    info: {
      wrap: 'border-violet-300/60 bg-gradient-to-r from-violet-50 via-indigo-50 to-slate-50 dark:border-violet-500/35 dark:from-violet-950/45 dark:via-indigo-950/40 dark:to-slate-950/50',
      iconWrap: 'bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:bg-violet-400/10 dark:text-violet-300',
      title: 'text-violet-950 dark:text-violet-100',
      sub: 'text-violet-900/80 dark:text-violet-200/80',
      dismiss:
        'text-violet-800/70 hover:bg-violet-200/50 hover:text-violet-950 dark:text-violet-200/70 dark:hover:bg-violet-900/50 dark:hover:text-violet-50',
      link: 'text-violet-900 dark:text-violet-200',
    },
  }[tone] || {
    wrap: 'border-violet-300/60 bg-violet-50',
    iconWrap: 'bg-violet-500/15 text-violet-700 ring-violet-500/30',
    title: 'text-violet-950',
    sub: 'text-violet-900/80',
    dismiss: 'text-violet-800/70 hover:bg-violet-200/50',
    link: 'text-violet-900',
  };

  const rowStyles = {
    overdue:
      'border-red-300/70 bg-red-50/90 text-red-950 dark:border-red-700/50 dark:bg-red-950/50 dark:text-red-100',
    due_soon:
      'border-amber-300/70 bg-amber-50/90 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/50 dark:text-amber-100',
    upcoming:
      'border-violet-200/80 bg-white/80 text-slate-800 dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-slate-100',
    none: 'border-violet-200/80 bg-white/80 text-slate-800 dark:border-violet-700/40 dark:bg-violet-950/30 dark:text-slate-100',
  };

  return (
    <div
      role="alert"
      className={`relative z-10 overflow-hidden rounded-2xl border px-4 py-4 sm:px-5 sm:py-4 shadow-sm ${styles.wrap}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.iconWrap}`}
        >
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-semibold ${styles.title}`}>
                {count} purchase{count === 1 ? '' : 's'} pending — ₹
                {Number(totalDue).toLocaleString('en-IN')} payable to suppliers
              </p>
              <p className={`mt-0.5 text-sm ${styles.sub}`}>
                Money you owe suppliers (payables). Overdue rows are highlighted in red.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className={`shrink-0 rounded-lg p-1.5 transition-colors ${styles.dismiss}`}
              aria-label="Dismiss payable alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {preview.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm ${rowStyles[row.urgency] || rowStyles.none}`}
              >
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="font-semibold truncate max-w-[10rem] sm:max-w-[14rem]">
                    {row.party_name}
                  </span>
                  <span className="tabular-nums opacity-80">{row.purchase_date}</span>
                  {row.urgency === 'overdue' && (
                    <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Overdue
                    </span>
                  )}
                  {row.urgency === 'due_soon' && (
                    <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Due soon
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 tabular-nums shrink-0">
                  <span className="font-semibold">
                    ₹{Number(row.balance_due).toLocaleString('en-IN')}
                  </span>
                  <span className="opacity-70">
                    {row.payment_due_date
                      ? formatDisplayDate(row.payment_due_date)
                      : 'No due date'}
                  </span>
                </div>
              </li>
            ))}
            {totalCount > preview.length && (
              <li className={`text-xs font-medium opacity-80 ${styles.sub}`}>
                +{totalCount - preview.length} more purchase
                {totalCount - preview.length === 1 ? '' : 's'}
              </li>
            )}
          </ul>

          <div className="mt-3">
            <Link
              to="/purchases"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline ${styles.link}`}
            >
              View all payables
              <ShoppingBag className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductMovementRow({ row }) {
  const max = Math.max(row.total_purchased, row.total_sold, 1);
  const purchasePct = (row.total_purchased / max) * 100;
  const soldPct = (row.total_sold / max) * 100;

  return (
    <tr>
      <td>
        <p className="font-semibold text-slate-900">{formatProductNameWithSize(row, 'paren')}</p>
        <p className="text-xs text-slate-500">{row.category}</p>
      </td>
      <td className="tabular-nums font-medium text-indigo-700">{row.total_purchased}</td>
      <td className="tabular-nums font-medium text-emerald-700">{row.total_sold}</td>
      <td className="tabular-nums font-bold text-slate-900">{row.stock_quantity}</td>
      <td>
        <div className="space-y-1.5 min-w-[120px]">
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
            <div
              className="bg-indigo-500/90 h-full transition-all"
              style={{ width: `${purchasePct}%` }}
              title="Purchased"
            />
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${soldPct}%` }} title="Sold" />
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Purchase / Sale</p>
        </div>
      </td>
    </tr>
  );
}

const statVariants = {
  sales: {
    border: 'border-emerald-200/50 dark:border-slate-700',
    iconWrap: 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-900/20',
  },
  purchases: {
    border: 'border-indigo-200/50 dark:border-slate-700',
    iconWrap: 'bg-gradient-to-br from-indigo-700 to-indigo-950 shadow-indigo-900/25',
  },
  products: {
    border: 'border-violet-200/40 dark:border-slate-700',
    iconWrap: 'bg-gradient-to-br from-violet-600 to-indigo-900 shadow-violet-900/20',
  },
  stock: {
    border: 'border-amber-200/60 dark:border-slate-700',
    iconWrap: 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-900/20',
  },
};

function StatCard({ title, value, subtitle, variant, icon: Icon }) {
  const style = statVariants[variant];

  return (
    <div
      className={`premium-stat-card group border bg-white dark:bg-slate-900 ${style.border}`}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="stat-card-title">{title}</p>
          <p className="stat-card-value mt-2 truncate">{value}</p>
          {subtitle && <p className="stat-card-subtitle mt-2">{subtitle}</p>}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${style.iconWrap} group-hover:scale-105 transition-transform duration-300`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
