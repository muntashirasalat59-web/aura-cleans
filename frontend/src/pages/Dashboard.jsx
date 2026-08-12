import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  IndianRupee,
  Wallet,
  AlertTriangle,
  Users,
  Receipt,
  ShoppingBag,
  Gauge,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
} from 'lucide-react';
import { dashboardAPI } from '../api';
import LoadingState from '../components/LoadingState';
import TrendChart from '../components/dashboard/TrendChart';
import { formatProductNameWithSize } from '../utils/productDisplay';
import { formatDisplayDate } from '../utils/invoicePayment';
import { LOW_STOCK_THRESHOLD, STOCK_ALERT_DISMISS_KEY } from '../config/stock';
import { PAYMENT_ALERT_DISMISS_KEY, PAYABLE_ALERT_DISMISS_KEY } from '../config/payments';

function formatInr(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function ChangeBadge({ pct }) {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  if (n > 0) {
    return (
      <span className="mt-2 inline-flex items-center gap-1 text-[length:var(--aura-type-caption)] font-semibold text-aura-success">
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        {n.toFixed(1)}%
      </span>
    );
  }
  if (n < 0) {
    return (
      <span className="mt-2 inline-flex items-center gap-1 text-[length:var(--aura-type-caption)] font-semibold text-aura-danger">
        <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2} />
        {Math.abs(n).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="mt-2 inline-flex items-center gap-1 text-[length:var(--aura-type-caption)] font-semibold text-aura-muted">
      0%
    </span>
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

function ProgressRing({ percent, label, subtitle, color = 'var(--aura-primary)', empty }) {
  const circumference = 2 * Math.PI * 42;
  const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
  const offset = empty ? circumference : circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--aura-border)"
            strokeWidth="8"
          />
          {!empty && (
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.2s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {empty ? (
            <span className="text-[length:var(--aura-type-body)] font-semibold leading-snug text-aura-text">
              —
            </span>
          ) : (
            <>
              <span className="text-[length:var(--aura-type-h2)] font-bold tabular-nums text-aura-text">
                {clamped}%
              </span>
              <span className="text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wide text-aura-muted">
                {label}
              </span>
            </>
          )}
        </div>
      </div>
      {subtitle ? (
        <p className="mt-3 max-w-[220px] text-center text-[length:var(--aura-type-caption)] text-aura-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, changePct, to, iconTone = 'primary' }) {
  const iconWrap = {
    primary: 'bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary',
    accent: 'bg-[color-mix(in_srgb,var(--aura-accent)_16%,transparent)] text-aura-accent',
    secondary: 'bg-[color-mix(in_srgb,var(--aura-secondary)_16%,transparent)] text-aura-secondary',
    warning: 'bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning',
    danger: 'bg-[color-mix(in_srgb,var(--aura-danger)_14%,transparent)] text-aura-danger',
  }[iconTone] || 'bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary';

  const content = (
    <div className="group rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-5 shadow-soft transition-all duration-lift ease-lift hover:-translate-y-0.5 hover:shadow-medium">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
            {title}
          </p>
          <p className="mt-2 truncate text-[length:var(--aura-type-h4)] font-bold tracking-tight tabular-nums text-aura-text">
            {value}
          </p>
          <ChangeBadge pct={changePct} />
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] shadow-soft transition-transform duration-lift ease-lift group-hover:scale-[1.02] ${iconWrap}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-primary">
        {content}
      </Link>
    );
  }
  return content;
}

function paymentStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return 'badge badge-green';
  if (s === 'partial') return 'badge badge-gold';
  return 'badge badge-orange';
}

function inventoryStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'good') return 'badge badge-green';
  if (s === 'critical') return 'badge badge-danger';
  // low / Low Stock
  return 'badge badge-orange';
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [trendRange, setTrendRange] = useState('daily');
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
    const ranged = stats.trends[trendRange];
    if (Array.isArray(ranged) && ranged.length > 0) return ranged;
    return stats.trends.last7Days || [];
  }, [stats, trendRange]);

  // Must stay above early returns — Rules of Hooks.
  const stockAlertProducts = useMemo(() => {
    return (stats?.productInsights || [])
      .filter((p) => Number(p.stock_quantity) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity));
  }, [stats?.productInsights]);

  const pendingInvoices = useMemo(() => stats?.pendingInvoices || [], [stats?.pendingInvoices]);
  const pendingPurchases = useMemo(() => stats?.pendingPurchases || [], [stats?.pendingPurchases]);

  const recentOrders = useMemo(() => {
    const list = stats?.recentOrders || stats?.recentSales || [];
    return list.slice(0, 5);
  }, [stats?.recentOrders, stats?.recentSales]);

  const topProducts = useMemo(
    () => stats?.topSellingProducts || [],
    [stats?.topSellingProducts]
  );

  const inventoryOverview = useMemo(
    () => stats?.inventoryOverview || [],
    [stats?.inventoryOverview]
  );

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

  const health = stats.businessHealth || {};
  const monthlySalesTarget =
    Number(health.monthlySalesTarget ?? stats.monthlySalesTarget ?? 0) || 0;
  const salesTargetPercent =
    health.salesTargetPercent != null
      ? health.salesTargetPercent
      : stats.salesTargetPercent;
  const hasSalesTarget =
    salesTargetPercent != null && monthlySalesTarget > 0;
  const monthRevenue = Number(health.monthRevenue ?? stats.monthRevenue ?? 0);
  const grossProfit = Number(
    health.grossProfit ?? health.monthGrossProfit ?? stats.monthGrossProfit ?? 0
  );
  const expensesThisMonth = Number(
    health.expensesThisMonth ?? stats.expensesThisMonth ?? 0
  );
  const netProfit = Number(
    health.netProfitMonth ?? health.monthNetProfit ?? stats.monthNetProfit ?? 0
  );
  const collectionRate = health.collectionRatePercent;
  const insufficient = Boolean(health.insufficientData);
  const healthScore = insufficient ? 0 : Number(health.healthScore ?? 0);
  const healthTier = healthScoreTier(healthScore);
  const outstanding = stats.outstandingAR ?? stats.pendingPayments ?? 0;

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

  const healthCircumference = 2 * Math.PI * 42;
  const healthClamped = Math.min(100, Math.max(0, healthScore));
  const healthOffset = insufficient
    ? healthCircumference
    : healthCircumference - (healthClamped / 100) * healthCircumference;

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

      {/* SECTION 1 — Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Today's Sales"
          value={formatInr(stats.todaysSales)}
          icon={IndianRupee}
          changePct={stats.todaysSalesChangePct}
          iconTone="primary"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatInr(stats.monthRevenue)}
          icon={TrendingUp}
          changePct={stats.monthRevenueChangePct}
          iconTone="accent"
        />
        <StatCard
          title="Today's Orders"
          value={Number(stats.invoiceCountToday ?? 0).toLocaleString('en-IN')}
          icon={Receipt}
          changePct={stats.invoiceCountTodayChangePct}
          iconTone="secondary"
        />
        <StatCard
          title="Low Stock Items"
          value={Number(stats.lowStockCount ?? 0).toLocaleString('en-IN')}
          icon={Package}
          to="/products?stock=low"
          iconTone="warning"
        />
        <StatCard
          title="Active Customers"
          value={Number(stats.activeCustomers ?? 0).toLocaleString('en-IN')}
          icon={Users}
          iconTone="primary"
        />
        <StatCard
          title="Outstanding Payments"
          value={formatInr(outstanding)}
          icon={Wallet}
          to="/sales?payment=pending"
          iconTone="danger"
        />
      </div>

      {/* SECTION 2 — Trend chart */}
      <TrendChart data={chartData} range={trendRange} onRangeChange={setTrendRange} />

      {/* SECTION 3 — Business Summary */}
      <section className="rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-secondary)_16%,transparent)] text-aura-secondary shadow-soft">
            <Gauge className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
              Business Summary
            </h3>
            <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
              Sales target, health score & monthly financials
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-center">
            {hasSalesTarget ? (
              <ProgressRing
                percent={salesTargetPercent}
                label="Sales Target"
                subtitle={`${formatInr(monthRevenue)} / ${formatInr(monthlySalesTarget)}`}
                color="var(--aura-primary)"
              />
            ) : (
              <div className="flex w-full flex-col items-center gap-4 py-4 text-center">
                <ProgressRing
                  percent={0}
                  label="Sales Target"
                  empty
                />
                <p className="max-w-xs text-[length:var(--aura-type-body)] text-aura-text-secondary">
                  Set Monthly Sales Target in Business Settings
                </p>
                <Link
                  to="/settings/business"
                  className="inline-flex items-center gap-1.5 text-[length:var(--aura-type-body)] font-semibold text-aura-primary underline-offset-2 transition-colors duration-200 hover:text-aura-primary-hover hover:underline"
                >
                  <Settings className="h-4 w-4" strokeWidth={2} />
                  Open Business Settings
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="var(--aura-border)"
                    strokeWidth="8"
                  />
                  {!insufficient && (
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="var(--aura-primary)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={healthCircumference}
                      strokeDashoffset={healthOffset}
                      style={{ transition: 'stroke-dashoffset 0.2s ease' }}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                  {insufficient ? (
                    <span className="text-[length:var(--aura-type-caption)] font-semibold text-aura-muted">
                      N/A
                    </span>
                  ) : (
                    <>
                      <span
                        className={`text-[length:var(--aura-type-h4)] font-bold tabular-nums ${healthTier.colorClass}`}
                      >
                        {healthScore}
                      </span>
                      <span className="text-[length:var(--aura-type-caption)] font-medium uppercase tracking-wide text-aura-muted">
                        Score
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
                  Health score
                </p>
                <p
                  className={`mt-1 text-[length:var(--aura-type-h5)] font-semibold ${
                    insufficient ? 'text-aura-text-secondary' : healthTier.colorClass
                  }`}
                >
                  {insufficient
                    ? health.healthLabel || 'Not enough data yet'
                    : health.healthLabel || healthTier.label}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-aura-border pt-4">
              <div className="flex justify-between text-[length:var(--aura-type-body)]">
                <span className="text-aura-text-secondary">Gross Profit</span>
                <span
                  className={`font-bold tabular-nums ${
                    grossProfit < 0 ? 'text-aura-danger' : 'text-aura-success'
                  }`}
                >
                  {formatInr(grossProfit)}
                </span>
              </div>
              <div className="flex justify-between text-[length:var(--aura-type-body)]">
                <span className="text-aura-text-secondary">Expenses</span>
                <span className="font-bold tabular-nums text-aura-text">
                  {formatInr(expensesThisMonth)}
                </span>
              </div>
              <div className="flex justify-between text-[length:var(--aura-type-body)]">
                <span className="text-aura-text-secondary">Net Profit</span>
                <span
                  className={`font-bold tabular-nums ${
                    netProfit < 0 ? 'text-aura-danger' : 'text-aura-success'
                  }`}
                >
                  {formatInr(netProfit)}
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
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 + 5 — Recent Orders | Top Selling */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
          <div className="flex items-center justify-between gap-3 border-b border-aura-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary shadow-soft">
                <Receipt className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                  Recent Orders
                </h3>
                <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                  Latest invoices
                </p>
              </div>
            </div>
            <Link
              to="/sales"
              className="text-[length:var(--aura-type-body)] font-semibold text-aura-primary underline-offset-2 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Party Name</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-aura-muted">
                      No recent orders yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-semibold tabular-nums text-aura-text">
                        {order.invoice_number || '—'}
                      </td>
                      <td className="text-aura-text">{order.party_name || '—'}</td>
                      <td className="font-semibold tabular-nums text-aura-text">
                        {formatInr(order.total_amount ?? order.amount)}
                      </td>
                      <td>
                        <span className={paymentStatusBadge(order.payment_status)}>
                          {order.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
          <div className="flex items-center gap-3 border-b border-aura-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-accent)_16%,transparent)] text-aura-accent shadow-soft">
              <TrendingUp className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                Top Selling Products
              </h3>
              <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                By quantity sold & revenue
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty Sold</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-10 text-center text-aura-muted">
                      No sales data yet.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="font-semibold text-aura-text">
                        {formatProductNameWithSize(product, 'paren')}
                      </td>
                      <td className="tabular-nums text-aura-text">
                        {Number(product.quantity_sold ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="font-semibold tabular-nums text-aura-primary">
                        {formatInr(product.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 6 — Inventory Overview */}
      <div className="overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-aura-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning shadow-soft">
              <Package className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
                Inventory Overview
              </h3>
              <p className="text-[length:var(--aura-type-body)] text-aura-text-secondary">
                Stock levels and value by product
              </p>
            </div>
          </div>
          <Link
            to="/products"
            className="text-[length:var(--aura-type-body)] font-semibold text-aura-primary underline-offset-2 hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Stock</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventoryOverview.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-aura-muted">
                    No inventory data available.
                  </td>
                </tr>
              ) : (
                inventoryOverview.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-aura-text">
                      {formatProductNameWithSize(row, 'paren')}
                    </td>
                    <td className="tabular-nums text-aura-text">
                      {Number(row.stock_quantity ?? row.current_stock ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="font-semibold tabular-nums text-aura-text">
                      {formatInr(row.stock_value ?? row.stockValue)}
                    </td>
                    <td>
                      <span className={inventoryStatusBadge(row.status)}>
                        {row.status_label || row.status || 'Good'}
                      </span>
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
