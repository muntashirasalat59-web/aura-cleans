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
      <div className="mx-auto mt-16 max-w-lg rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 text-center shadow-soft">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-aura-warning" />
        <h2 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
          Could not load dashboard
        </h2>
        <p className="mt-2 text-[length:var(--aura-type-body)] text-aura-text-secondary">
          {loadError || 'Unknown error'}
        </p>
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
    <div className="dashboard-shell space-y-6">
      {/* First in DOM so it shows above the fold on login / dashboard load (no scroll). */}
      {showStockAlert && (
        <div
          role="alert"
          className="dashboard-alert-panel relative z-10 overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card px-5 py-4 shadow-soft"
        >
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-aura-text">
                    {stockAlertProducts.length} product
                    {stockAlertProducts.length === 1 ? '' : 's'} are running low on stock
                  </p>
                  <p className="mt-1 text-[length:var(--aura-type-body)] text-aura-text-secondary">
                    Stock at or below {LOW_STOCK_THRESHOLD} units — review and reorder soon.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissStockAlert}
                  className="shrink-0 rounded-[var(--aura-radius-button)] p-1.5 text-aura-muted transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--aura-warning)_12%,transparent)] hover:text-aura-text"
                  aria-label="Dismiss stock alert"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ul className="mt-3 flex flex-wrap gap-2">
                {stockAlertPreview.map((product) => (
                  <li
                    key={product.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-aura-border bg-aura-bg px-2.5 py-1 text-[length:var(--aura-type-caption)] font-medium text-aura-text"
                  >
                    <span className="truncate max-w-[10rem] sm:max-w-[14rem]">
                      {formatProductNameWithSize(product, 'paren')}
                    </span>
                    <span className="tabular-nums text-aura-warning">
                      ({Number(product.stock_quantity).toLocaleString('en-IN')})
                    </span>
                  </li>
                ))}
                {stockAlertProducts.length > stockAlertPreview.length && (
                  <li className="inline-flex items-center rounded-full px-2 py-1 text-[length:var(--aura-type-caption)] font-medium text-aura-muted">
                    +{stockAlertProducts.length - stockAlertPreview.length} more
                  </li>
                )}
              </ul>

              <div className="mt-3">
                <Link
                  to={`/products?stock=low&threshold=${LOW_STOCK_THRESHOLD}`}
                  className="inline-flex items-center gap-1.5 text-[length:var(--aura-type-body)] font-semibold text-aura-primary underline-offset-2 transition-colors duration-200 hover:text-aura-primary-hover hover:underline"
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

      <div className="dashboard-hero relative overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card px-5 py-5 shadow-medium">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 md:max-w-[52%] lg:max-w-[48%]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--aura-primary)_14%,transparent)] px-3 py-1 text-[length:var(--aura-type-caption)] font-medium text-aura-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AURA CLEAN · Executive dashboard
            </div>
            <h1 className="text-[length:var(--aura-type-h2)] font-semibold tracking-tight text-aura-text">
              Welcome back
            </h1>
            <p className="mt-2 max-w-xl text-[length:var(--aura-type-body)] text-aura-text-secondary">
              Sales, manufacturing, receivables, and hygiene SKU inventory — one premium command center.
            </p>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:flex-nowrap sm:items-end sm:gap-0 md:w-auto md:shrink-0">
            <div className="min-w-0 sm:shrink-0">
              <p className="whitespace-nowrap text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wider text-aura-muted">
                Net profit
              </p>
              <p
                className="mt-1 whitespace-nowrap text-[length:var(--aura-type-h5)] font-bold tabular-nums"
                style={{ color: netProfit < 0 ? 'var(--aura-danger)' : 'var(--aura-success)' }}
              >
                ₹{netProfit.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="min-w-0 border-t border-aura-border pt-4 sm:shrink-0 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0 sm:pr-1">
              <p className="whitespace-nowrap text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wider text-aura-muted">
                This month revenue
              </p>
              <p className="mt-1 whitespace-nowrap text-[length:var(--aura-type-h5)] font-bold tabular-nums text-aura-primary">
                ₹{(stats.monthRevenue ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="min-w-0 border-t border-aura-border pt-4 sm:shrink-0 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <p className="whitespace-nowrap text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wider text-aura-muted">
                Stock value
              </p>
              <p
                className="mt-1 whitespace-nowrap text-[length:var(--aura-type-h5)] font-bold tabular-nums"
                style={{
                  color: Number(stats.stockValue) < 0 ? 'var(--aura-danger)' : 'var(--aura-text)',
                }}
              >
                ₹{stats.stockValue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
          tone={paymentTone === 'danger' ? 'rose' : paymentTone === 'warning' ? 'amber' : 'emerald'}
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
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-aura-primary" />
          <h2 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
            Quick actions
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <QuickAction to="/sales" label="New sale" icon={TrendingUp} accent="emerald" />
          <QuickAction to="/purchases" label="New purchase" icon={ShoppingBag} accent="indigo" />
          <QuickAction to="/products" label="Add product" icon={Package} accent="violet" />
          <QuickAction to="/parties" label="Add party" icon={UserPlus} accent="amber" />
          <QuickAction to="/expenses" label="Add expense" icon={Banknote} accent="rose" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <TrendChart data={chartData} range={trendRange} onRangeChange={setTrendRange} />
        </div>
        <BusinessHealthWidget health={health} stats={stats} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft transition-shadow duration-200 hover:shadow-medium">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-accent text-white shadow-soft">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                Recent activity
              </h3>
              <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                Latest sales and purchases
              </p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <p className="py-4 text-[length:var(--aura-type-body)] text-aura-muted">No transactions yet.</p>
          ) : (
            <ul className="relative space-y-0">
              {recentActivity.map((item, index) => (
                <ActivityTimelineItem key={item.id} item={item} isLast={index === recentActivity.length - 1} />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft transition-shadow duration-200 hover:shadow-medium">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-primary text-white shadow-soft">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                Top selling products
              </h3>
              <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                By quantity sold & revenue
              </p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <p className="py-4 text-[length:var(--aura-type-body)] text-aura-muted">No sales data yet.</p>
          ) : (
            <ul className="space-y-4">
              {topProducts.map((product, rank) => (
                <li key={product.id} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-bg text-[length:var(--aura-type-body)] font-bold tabular-nums text-aura-text-secondary">
                    {rank + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-aura-text">
                        {formatProductNameWithSize(product, 'paren')}
                      </p>
                      <p className="shrink-0 text-[length:var(--aura-type-body)] font-bold tabular-nums text-aura-primary">
                        ₹{product.revenue.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="mt-1 text-[length:var(--aura-type-caption)] text-aura-muted">
                      {formatQuantityWithSize(product.quantity_sold, product)} sold
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-aura-bg">
                      <div
                        className="h-full rounded-full bg-aura-primary transition-all duration-200"
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

      <div className="overflow-hidden rounded-[var(--aura-radius-table)] border border-aura-border bg-aura-card shadow-soft">
        <div className="border-b border-aura-border px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-accent text-white shadow-soft">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                Purchase & sales by product
              </h3>
              <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                Units purchased, sold, and remaining stock per SKU
              </p>
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
                  <td colSpan="5" className="py-12 text-center text-aura-muted">
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

      <div className="overflow-hidden rounded-[var(--aura-radius-table)] border border-aura-border bg-aura-card shadow-soft">
        <div className="border-b border-aura-border px-6 py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-warning text-white shadow-soft">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                  Stock overview & reorder
                </h3>
                <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
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
                  <td colSpan="5" className="py-12 text-center text-aura-muted">
                    No inventory data available.
                  </td>
                </tr>
              ) : (
                insights.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-aura-text">
                      {formatProductNameWithSize(row, 'paren')}
                    </td>
                    <td>
                      <span
                        className={
                          row.stock_quantity <= (stats.lowStockThreshold ?? LOW_STOCK_THRESHOLD)
                            ? 'font-bold tabular-nums text-aura-warning'
                            : 'tabular-nums text-aura-text'
                        }
                      >
                        {formatQuantityWithSize(row.stock_quantity, row)}
                      </span>
                    </td>
                    <td className="tabular-nums text-aura-text">{row.total_sold}</td>
                    <td>
                      {row.needs_reorder ? (
                        <span className="badge badge-orange font-semibold">{row.status_label}</span>
                      ) : (
                        <span className="badge badge-green">{row.status_label}</span>
                      )}
                    </td>
                    <td className="font-medium tabular-nums text-aura-text">
                      {row.suggested_reorder_qty > 0 ? (
                        <span className="text-aura-warning">{row.suggested_reorder_qty} units</span>
                      ) : (
                        <span className="text-aura-muted">—</span>
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
  /* Pastel icon tiles — mint / sky / lavender / peach / rose */
  const iconTone = {
    emerald:
      'bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary',
    indigo:
      'bg-[color-mix(in_srgb,var(--aura-accent)_16%,transparent)] text-aura-accent',
    violet:
      'bg-[color-mix(in_srgb,var(--aura-secondary)_18%,transparent)] text-aura-secondary',
    amber:
      'bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning',
    rose:
      'bg-[color-mix(in_srgb,var(--aura-danger)_14%,transparent)] text-aura-danger',
  };

  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-3 rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-medium sm:p-5"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[var(--aura-radius-button)] shadow-soft transition-transform duration-200 group-hover:scale-[1.02] ${iconTone[accent] || iconTone.emerald}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-center text-[length:var(--aura-type-body)] font-semibold text-aura-text">
        {label}
      </span>
      <PlusCircle className="h-4 w-4 text-aura-muted transition-colors duration-200 group-hover:text-aura-primary" />
    </Link>
  );
}

function KpiChip({ title, value, subtitle, icon: Icon, tone }) {
  const toneMap = {
    emerald: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-primary)_10%,var(--aura-card))] text-aura-text',
    indigo: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-accent)_10%,var(--aura-card))] text-aura-text',
    amber: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))] text-aura-text',
    rose: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-danger)_10%,var(--aura-card))] text-aura-text',
    violet: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-secondary)_10%,var(--aura-card))] text-aura-text',
  };
  const iconMap = {
    emerald: 'text-aura-primary',
    indigo: 'text-aura-accent',
    amber: 'text-aura-warning',
    rose: 'text-aura-danger',
    violet: 'text-aura-secondary',
  };

  return (
    <div
      className={`h-full min-h-[88px] overflow-hidden rounded-[var(--aura-radius-card)] border px-4 py-4 shadow-soft ${toneMap[tone] || toneMap.indigo}`}
    >
      <div className="flex h-full items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
            {title}
          </p>
          <p className="mt-1 truncate text-[length:var(--aura-type-h4)] font-bold tabular-nums text-aura-text">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 truncate text-[length:var(--aura-type-caption)] text-aura-text-secondary">
              {subtitle}
            </p>
          )}
        </div>
        <Icon className={`h-5 w-5 shrink-0 ${iconMap[tone] || iconMap.indigo}`} />
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
        <span className="absolute bottom-0 left-4 top-8 w-px bg-aura-border" />
      )}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-aura-card ${
          isSale
            ? 'bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary'
            : 'bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning'
        }`}
      >
        {isSale ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-aura-text">{isSale ? 'Sale' : 'Purchase'}</p>
            <p className="max-w-[200px] truncate text-[length:var(--aura-type-body)] text-aura-text-secondary sm:max-w-none">
              {item.title}
            </p>
            {item.party_name && (
              <p className="mt-1 truncate text-[length:var(--aura-type-caption)] text-aura-muted">
                {item.party_name}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p
              className={`text-[length:var(--aura-type-body)] font-bold tabular-nums ${
                isSale ? 'text-aura-primary' : 'text-aura-warning'
              }`}
            >
              {isSale ? '+' : '−'}₹{item.amount.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-[length:var(--aura-type-caption)] text-aura-muted">{dateLabel}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

function healthScoreTier(score) {
  if (score >= 80) {
    return { label: 'Excellent', colorClass: 'text-aura-success' };
  }
  if (score >= 50) {
    return { label: 'Stable', colorClass: 'text-aura-warning' };
  }
  return { label: 'Needs attention', colorClass: 'text-aura-danger' };
}

function BusinessHealthWidget({ health, stats }) {
  const insufficient = Boolean(health.insufficientData);
  const score = insufficient ? 0 : Number(health.healthScore ?? 0);
  const margin = health.profitMarginPercent ?? 0;
  const monthProfit = health.monthNetProfit ?? stats.monthNetProfit ?? 0;
  const collectionRate = health.collectionRatePercent;
  const hint = health.hint;
  const tier = healthScoreTier(score);

  const circumference = 2 * Math.PI * 42;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = insufficient
    ? circumference
    : circumference - (clamped / 100) * circumference;

  return (
    <div className="flex h-full flex-col rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-secondary)_16%,transparent)] text-aura-secondary shadow-soft">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
            Business health
          </h3>
          <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
            {insufficient ? 'Waiting on more sales history' : 'Collections, stock & trend'}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div className="relative h-40 w-40">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            {/* Track */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--aura-border)"
              strokeWidth="8"
            />
            {/* Score arc — always emerald fill */}
            {!insufficient && (
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--aura-primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.2s ease' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
            {insufficient ? (
              <>
                <span className="text-[length:var(--aura-type-body)] font-semibold leading-snug text-aura-text">
                  Not enough data
                </span>
                <span className="mt-1 text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wide text-aura-muted">
                  Yet
                </span>
              </>
            ) : (
              <>
                <span
                  className={`text-[length:var(--aura-type-h2)] font-bold tabular-nums ${tier.colorClass}`}
                >
                  {score}
                </span>
                <span className="text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wide text-aura-muted">
                  Score
                </span>
              </>
            )}
          </div>
        </div>
        <p
          className={`mt-4 text-[length:var(--aura-type-body)] font-semibold ${
            insufficient ? 'text-aura-text-secondary' : tier.colorClass
          }`}
        >
          {insufficient ? health.healthLabel || 'Not enough data yet' : tier.label}
        </p>
        {hint ? (
          <p className="mt-1 max-w-[220px] text-center text-[length:var(--aura-type-caption)] text-aura-muted">
            {hint}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 border-t border-aura-border pt-4">
        <div className="flex justify-between text-[length:var(--aura-type-body)]">
          <span className="text-aura-text-secondary">Profit this month</span>
          <span
            className={`font-bold tabular-nums ${
              monthProfit < 0 ? 'text-aura-danger' : 'text-aura-success'
            }`}
          >
            ₹{Number(monthProfit).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex justify-between text-[length:var(--aura-type-body)]">
          <span className="text-aura-text-secondary">Collection rate</span>
          <span
            className={`font-bold tabular-nums ${
              collectionRate == null
                ? 'text-aura-muted'
                : collectionRate > 0
                  ? 'text-aura-success'
                  : 'text-aura-danger'
            }`}
          >
            {collectionRate != null ? `${collectionRate}%` : '—'}
          </span>
        </div>
        {!insufficient && (
          <div className="flex justify-between gap-3 text-[length:var(--aura-type-caption)]">
            <span className={margin < 0 ? 'text-aura-danger' : 'text-aura-success'}>
              Margin {margin}%
            </span>
            <span className="text-right font-medium text-aura-warning">
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
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-danger)_8%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-danger)_14%,transparent)] text-aura-danger',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-danger)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-danger',
    },
    warning: {
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_8%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-warning)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-warning',
    },
    info: {
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-primary)_8%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-primary)_14%,transparent)] text-aura-primary',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-primary)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-primary',
    },
  }[tone] || {
    wrap: 'border-aura-border bg-aura-card',
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-primary)_14%,transparent)] text-aura-primary',
    title: 'text-aura-text',
    sub: 'text-aura-text-secondary',
    dismiss: 'text-aura-muted hover:bg-aura-bg hover:text-aura-text',
    link: 'text-aura-primary',
  };

  const rowStyles = {
    overdue:
      'border-aura-border bg-[color-mix(in_srgb,var(--aura-danger)_10%,var(--aura-card))] text-aura-text',
    due_soon:
      'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))] text-aura-text',
    upcoming: 'border-aura-border bg-aura-card text-aura-text',
    none: 'border-aura-border bg-aura-card text-aura-text',
  };

  return (
    <div
      role="alert"
      className={`relative z-10 overflow-hidden rounded-[var(--aura-radius-card)] border px-4 py-4 shadow-soft sm:px-5 ${styles.wrap}`}
    >
      <div className="flex gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] ${styles.iconWrap}`}
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
              <p className={`mt-1 text-[length:var(--aura-type-body)] ${styles.sub}`}>
                Collect outstanding balances. Overdue rows are highlighted in red.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className={`shrink-0 rounded-[var(--aura-radius-button)] p-2 transition-colors duration-200 ${styles.dismiss}`}
              aria-label="Dismiss payment alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {preview.map((inv) => (
              <li
                key={inv.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--aura-radius-button)] border px-3 py-2 text-[length:var(--aura-type-caption)] sm:text-[length:var(--aura-type-body)] ${rowStyles[inv.urgency] || rowStyles.none}`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="max-w-[10rem] truncate font-semibold sm:max-w-[14rem]">
                    {inv.party_name}
                  </span>
                  <span className="tabular-nums text-aura-muted">{inv.invoice_number}</span>
                  {inv.urgency === 'overdue' && (
                    <span className="rounded-full bg-aura-danger px-2 py-1 text-[length:var(--aura-type-caption)] font-bold uppercase tracking-wide text-white">
                      Overdue
                    </span>
                  )}
                  {inv.urgency === 'due_soon' && (
                    <span className="rounded-full bg-aura-warning px-2 py-1 text-[length:var(--aura-type-caption)] font-bold uppercase tracking-wide text-white">
                      Due soon
                    </span>
                  )}
                  {inv.payment_status === 'partial' && (
                    <span className="rounded-full bg-aura-muted px-2 py-1 text-[length:var(--aura-type-caption)] font-bold uppercase tracking-wide text-white">
                      Partial
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="font-semibold">
                    ₹{Number(inv.balance_due).toLocaleString('en-IN')}
                  </span>
                  <span className="text-aura-muted">
                    {inv.payment_due_date
                      ? formatDisplayDate(inv.payment_due_date)
                      : 'No due date'}
                  </span>
                </div>
              </li>
            ))}
            {totalCount > preview.length && (
              <li className={`text-[length:var(--aura-type-caption)] font-medium ${styles.sub}`}>
                +{totalCount - preview.length} more invoice{totalCount - preview.length === 1 ? '' : 's'}
              </li>
            )}
          </ul>

          <div className="mt-3">
            <Link
              to="/sales?payment=pending"
              className={`inline-flex items-center gap-1.5 text-[length:var(--aura-type-body)] font-semibold underline-offset-2 transition-colors duration-200 hover:underline ${styles.link}`}
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

/** Supplier payables — amber tint (receivables use green). */
function PayableAlertBanner({ count, totalDue, tone, preview, totalCount, onDismiss }) {
  const styles = {
    danger: {
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-danger)_8%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-danger)_14%,transparent)] text-aura-danger',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-danger)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-danger',
    },
    warning: {
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-warning)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-warning',
    },
    info: {
      wrap: 'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_8%,var(--aura-card))]',
      iconWrap: 'bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning',
      title: 'text-aura-text',
      sub: 'text-aura-text-secondary',
      dismiss: 'text-aura-muted hover:bg-[color-mix(in_srgb,var(--aura-warning)_12%,transparent)] hover:text-aura-text',
      link: 'text-aura-warning',
    },
  }[tone] || {
    wrap: 'border-aura-border bg-aura-card',
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning',
    title: 'text-aura-text',
    sub: 'text-aura-text-secondary',
    dismiss: 'text-aura-muted hover:bg-aura-bg hover:text-aura-text',
    link: 'text-aura-warning',
  };

  const rowStyles = {
    overdue:
      'border-aura-border bg-[color-mix(in_srgb,var(--aura-danger)_10%,var(--aura-card))] text-aura-text',
    due_soon:
      'border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))] text-aura-text',
    upcoming: 'border-aura-border bg-aura-card text-aura-text',
    none: 'border-aura-border bg-aura-card text-aura-text',
  };

  return (
    <div
      role="alert"
      className={`relative z-10 overflow-hidden rounded-[var(--aura-radius-card)] border px-4 py-4 shadow-soft sm:px-5 ${styles.wrap}`}
    >
      <div className="flex gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] ${styles.iconWrap}`}
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
              <p className={`mt-1 text-[length:var(--aura-type-body)] ${styles.sub}`}>
                Money you owe suppliers (payables). Overdue rows are highlighted in red.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className={`shrink-0 rounded-[var(--aura-radius-button)] p-2 transition-colors duration-200 ${styles.dismiss}`}
              aria-label="Dismiss payable alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {preview.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--aura-radius-button)] border px-3 py-2 text-[length:var(--aura-type-caption)] sm:text-[length:var(--aura-type-body)] ${rowStyles[row.urgency] || rowStyles.none}`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="max-w-[10rem] truncate font-semibold sm:max-w-[14rem]">
                    {row.party_name}
                  </span>
                  <span className="tabular-nums text-aura-muted">{row.purchase_date}</span>
                  {row.urgency === 'overdue' && (
                    <span className="rounded-full bg-aura-danger px-2 py-1 text-[length:var(--aura-type-caption)] font-bold uppercase tracking-wide text-white">
                      Overdue
                    </span>
                  )}
                  {row.urgency === 'due_soon' && (
                    <span className="rounded-full bg-aura-warning px-2 py-1 text-[length:var(--aura-type-caption)] font-bold uppercase tracking-wide text-white">
                      Due soon
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="font-semibold">
                    ₹{Number(row.balance_due).toLocaleString('en-IN')}
                  </span>
                  <span className="text-aura-muted">
                    {row.payment_due_date
                      ? formatDisplayDate(row.payment_due_date)
                      : 'No due date'}
                  </span>
                </div>
              </li>
            ))}
            {totalCount > preview.length && (
              <li className={`text-[length:var(--aura-type-caption)] font-medium ${styles.sub}`}>
                +{totalCount - preview.length} more purchase
                {totalCount - preview.length === 1 ? '' : 's'}
              </li>
            )}
          </ul>

          <div className="mt-3">
            <Link
              to="/purchases"
              className={`inline-flex items-center gap-1.5 text-[length:var(--aura-type-body)] font-semibold underline-offset-2 transition-colors duration-200 hover:underline ${styles.link}`}
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
        <p className="font-semibold text-aura-text">{formatProductNameWithSize(row, 'paren')}</p>
        <p className="text-[length:var(--aura-type-caption)] text-aura-muted">{row.category}</p>
      </td>
      <td className="font-medium tabular-nums text-aura-warning">{row.total_purchased}</td>
      <td className="font-medium tabular-nums text-aura-primary">{row.total_sold}</td>
      <td className="font-bold tabular-nums text-aura-text">{row.stock_quantity}</td>
      <td>
        <div className="min-w-[120px] space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-aura-bg">
            <div
              className="h-full bg-aura-warning transition-all duration-200"
              style={{ width: `${purchasePct}%` }}
              title="Purchased"
            />
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-aura-bg">
            <div
              className="h-full bg-aura-primary transition-all duration-200"
              style={{ width: `${soldPct}%` }}
              title="Sold"
            />
          </div>
          <p className="text-[length:var(--aura-type-caption)] uppercase tracking-wide text-aura-muted">
            Purchase / Sale
          </p>
        </div>
      </td>
    </tr>
  );
}

const statVariants = {
  sales: {
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary',
  },
  purchases: {
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-accent)_16%,transparent)] text-aura-accent',
  },
  products: {
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-secondary)_16%,transparent)] text-aura-secondary',
  },
  stock: {
    iconWrap: 'bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning',
  },
};

function StatCard({ title, value, subtitle, variant, icon: Icon }) {
  const style = statVariants[variant];

  return (
    <div className="group rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft transition-all duration-lift ease-lift hover:-translate-y-0.5 hover:shadow-medium">
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
            {title}
          </p>
          <p className="mt-2 truncate text-[length:var(--aura-type-h3)] font-bold tracking-tight tabular-nums text-aura-text">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 text-[length:var(--aura-type-body)] text-aura-text-secondary">{subtitle}</p>
          )}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] shadow-soft transition-transform duration-lift ease-lift group-hover:scale-[1.02] ${style.iconWrap}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
