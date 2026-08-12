import { useState, useEffect, useMemo, useCallback } from 'react';
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
  PlusCircle,
  UserPlus,
  FileText,
  Zap,
  Eye,
  EyeOff,
  LayoutGrid,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { dashboardAPI, settingsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import TrendChart from '../components/dashboard/TrendChart';
import { formatProductNameWithSize } from '../utils/productDisplay';
import { formatDisplayDate } from '../utils/invoicePayment';
import { LOW_STOCK_THRESHOLD, STOCK_ALERT_DISMISS_KEY } from '../config/stock';
import { PAYMENT_ALERT_DISMISS_KEY, PAYABLE_ALERT_DISMISS_KEY } from '../config/payments';
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  DASHBOARD_ROW_HEIGHT,
  DASHBOARD_WIDGETS,
  cloneDefaultLayouts,
  parseSavedLayout,
  buildLayoutPayload,
  removeWidgetFromLayouts,
  addWidgetToLayouts,
} from '../config/dashboardLayout';

const ResponsiveGridLayout = WidthProvider(Responsive);

function WidgetShell({ id, editMode, onToggleHidden, children, className = '' }) {
  return (
    <div
      className={`dashboard-widget relative flex h-full min-h-0 flex-col overflow-hidden ${
        editMode ? 'dashboard-widget--edit' : ''
      } ${className}`}
    >
      {editMode && (
        <div className="dashboard-widget-actions absolute right-2 top-2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleHidden(id)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--aura-radius-button)] border border-aura-border bg-aura-card text-aura-text shadow-soft transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--aura-primary)_12%,transparent)]"
            title="Hide widget"
            aria-label="Hide widget"
          >
            <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
      <div className="dashboard-widget-body min-h-0 flex-1">{children}</div>
    </div>
  );
}

function formatInr(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function ChangeBadge({ pct }) {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  // Hide flat/zero — only show when there is a real completed-period delta
  if (n === 0) return null;
  if (n > 0) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-aura-success">
        <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
        {n.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-aura-danger">
      <ArrowDownRight className="h-3 w-3" strokeWidth={2} />
      {Math.abs(n).toFixed(1)}%
    </span>
  );
}

/** Tiny SVG sparkline — only renders when real series data exists (no dummies). */
function MiniSparkline({ values, color = 'var(--aura-primary)' }) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const nums = values.map((v) => Number(v) || 0);
  if (!nums.some((n) => n > 0)) return null;

  const w = 56;
  const h = 18;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const points = nums
    .map((v, i) => {
      const x = (i / (nums.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="mt-1 block overflow-visible" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.85}
      />
    </svg>
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

function ProgressRing({ percent, label, subtitle, color = 'var(--aura-primary)', empty, size = 'md' }) {
  const circumference = 2 * Math.PI * 42;
  const clamped = Math.min(100, Math.max(0, Number(percent) || 0));
  const offset = empty ? circumference : circumference - (clamped / 100) * circumference;
  const box = size === 'sm' ? 'h-24 w-24' : 'h-32 w-32';

  return (
    <div className="flex flex-col items-center justify-center py-0">
      <div className={`relative ${box}`}>
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
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          {empty ? (
            <span className="text-[11px] font-semibold leading-snug text-aura-text">—</span>
          ) : (
            <>
              <span className="text-lg font-bold tabular-nums leading-none text-aura-text">
                {clamped}%
              </span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-aura-muted">
                {label}
              </span>
            </>
          )}
        </div>
      </div>
      {subtitle ? (
        <p className="mt-1.5 max-w-[160px] text-center text-[10px] leading-snug text-aura-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  changePct,
  to,
  iconTone = 'primary',
  sparkline,
}) {
  const iconWrap = {
    primary:
      'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-primary)_28%,transparent)] to-[color-mix(in_srgb,var(--aura-primary)_8%,transparent)] text-aura-primary',
    accent:
      'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-accent)_28%,transparent)] to-[color-mix(in_srgb,var(--aura-accent)_8%,transparent)] text-aura-accent',
    secondary:
      'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-secondary)_28%,transparent)] to-[color-mix(in_srgb,var(--aura-secondary)_8%,transparent)] text-aura-secondary',
    warning:
      'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-warning)_28%,transparent)] to-[color-mix(in_srgb,var(--aura-warning)_8%,transparent)] text-aura-warning',
    danger:
      'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-danger)_24%,transparent)] to-[color-mix(in_srgb,var(--aura-danger)_6%,transparent)] text-aura-danger',
  }[iconTone] ||
    'bg-gradient-to-br from-[color-mix(in_srgb,var(--aura-primary)_28%,transparent)] to-[color-mix(in_srgb,var(--aura-primary)_8%,transparent)] text-aura-primary';

  const sparkColor = {
    primary: 'var(--aura-primary)',
    accent: 'var(--aura-accent)',
    secondary: 'var(--aura-secondary)',
    warning: 'var(--aura-warning)',
    danger: 'var(--aura-danger)',
  }[iconTone] || 'var(--aura-primary)';

  const content = (
    <div className="group cursor-pointer rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card px-3 py-2.5 shadow-soft transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-medium">
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-aura-muted">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold tracking-tight tabular-nums leading-tight text-aura-text">
            {value}
          </p>
          <ChangeBadge pct={changePct} />
          <MiniSparkline values={sparkline} color={sparkColor} />
        </div>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] shadow-soft ${iconWrap}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-primary"
      >
        {content}
      </Link>
    );
  }
  return content;
}

function QuickAction({ to, label, icon: Icon, tone = 'primary' }) {
  const toneClass = {
    primary: 'bg-[color-mix(in_srgb,var(--aura-primary)_14%,transparent)] text-aura-primary',
    accent: 'bg-[color-mix(in_srgb,var(--aura-accent)_14%,transparent)] text-aura-accent',
    warning: 'bg-[color-mix(in_srgb,var(--aura-warning)_14%,transparent)] text-aura-warning',
    secondary: 'bg-[color-mix(in_srgb,var(--aura-secondary)_14%,transparent)] text-aura-secondary',
  }[tone];

  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-[var(--aura-radius-button)] border border-aura-border bg-aura-bg/40 px-2.5 py-2 transition-all duration-200 hover:border-aura-primary/30 hover:bg-[color-mix(in_srgb,var(--aura-primary)_8%,transparent)]"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] ${toneClass}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="truncate text-[12px] font-semibold text-aura-text">{label}</span>
    </Link>
  );
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
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState(() => cloneDefaultLayouts());
  const [hiddenWidgets, setHiddenWidgets] = useState([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState(null);

  useEffect(() => {
    loadStats();
    loadDashboardLayout();
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

  async function loadDashboardLayout() {
    try {
      const data = await settingsAPI.getDashboardLayout();
      const parsed = parseSavedLayout(data?.layout);
      setLayouts(parsed.layouts);
      setHiddenWidgets(parsed.hidden);
    } catch {
      setLayouts(cloneDefaultLayouts());
      setHiddenWidgets([]);
    } finally {
      setLayoutReady(true);
    }
  }

  const onLayoutsChange = useCallback((_currentLayout, allLayouts) => {
    if (!allLayouts) return;
    setLayouts((prev) => ({
      lg: allLayouts.lg || prev.lg,
      md: allLayouts.md || prev.md,
      sm: allLayouts.sm || prev.sm,
    }));
  }, []);

  const toggleWidgetHidden = useCallback((id) => {
    setHiddenWidgets((prev) => {
      const isHidden = prev.includes(id);
      if (isHidden) {
        setLayouts((layoutsPrev) => addWidgetToLayouts(layoutsPrev, id));
        return prev.filter((x) => x !== id);
      }
      setLayouts((layoutsPrev) => removeWidgetFromLayouts(layoutsPrev, id));
      return [...prev, id];
    });
  }, []);

  async function handleSaveLayout() {
    try {
      setLayoutBusy(true);
      setLayoutMessage(null);
      await settingsAPI.saveDashboardLayout(buildLayoutPayload(layouts, hiddenWidgets));
      setEditMode(false);
      setLayoutMessage('Layout saved');
    } catch (err) {
      setLayoutMessage(err.message || 'Failed to save layout');
    } finally {
      setLayoutBusy(false);
    }
  }

  async function handleResetLayout() {
    try {
      setLayoutBusy(true);
      setLayoutMessage(null);
      await settingsAPI.resetDashboardLayout();
      setLayouts(cloneDefaultLayouts());
      setHiddenWidgets([]);
      setEditMode(false);
      setLayoutMessage('Reset to default layout');
    } catch (err) {
      setLayoutMessage(err.message || 'Failed to reset layout');
    } finally {
      setLayoutBusy(false);
    }
  }

  function enterEditMode() {
    setLayoutMessage(null);
    setEditMode(true);
  }

  function exitEditModeWithoutSave() {
    setEditMode(false);
    loadDashboardLayout();
  }

  const chartData = useMemo(() => {
    if (!stats?.trends) return [];
    const ranged = stats.trends[trendRange];
    if (Array.isArray(ranged) && ranged.length > 0) return ranged;
    return stats.trends.last7Days || [];
  }, [stats, trendRange]);

  const salesSparkline = useMemo(() => {
    const series = stats?.trends?.daily || stats?.trends?.last7Days || [];
    if (!Array.isArray(series) || series.length < 2) return null;
    return series.map((d) => Number(d.sales) || 0);
  }, [stats?.trends]);

  const revenueSparkline = useMemo(() => {
    const series = stats?.trends?.monthly || [];
    if (!Array.isArray(series) || series.length < 2) return null;
    return series.map((d) => Number(d.sales) || 0);
  }, [stats?.trends]);

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

  if (loading || !layoutReady) {
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
    <div className="dashboard-shell space-y-3">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {editMode ? (
            <p className="text-[12px] font-medium text-aura-text-secondary">
              Edit mode — drag to reorder, resize from corners, eye to hide
            </p>
          ) : layoutMessage ? (
            <p className="text-[12px] text-aura-muted">{layoutMessage}</p>
          ) : (
            <span className="sr-only">Executive Dashboard</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!editMode ? (
            <button type="button" onClick={enterEditMode} className="btn btn-secondary !py-1.5 !text-[12px]">
              <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
              Customize
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSaveLayout}
                disabled={layoutBusy}
                className="btn btn-primary !py-1.5 !text-[12px]"
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                Save Layout
              </button>
              <button
                type="button"
                onClick={handleResetLayout}
                disabled={layoutBusy}
                className="btn btn-secondary !py-1.5 !text-[12px]"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                Reset to Default
              </button>
              <button
                type="button"
                onClick={exitEditModeWithoutSave}
                disabled={layoutBusy}
                className="btn btn-secondary !py-1.5 !text-[12px]"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {editMode && hiddenWidgets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--aura-radius-card)] border border-dashed border-aura-border bg-aura-card/60 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-aura-muted">
            Hidden
          </span>
          {hiddenWidgets.map((id) => {
            const meta = DASHBOARD_WIDGETS.find((w) => w.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleWidgetHidden(id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-aura-border bg-aura-bg px-2.5 py-1 text-[11px] font-medium text-aura-text transition-colors hover:border-aura-primary/40"
              >
                <Eye className="h-3 w-3 text-aura-primary" strokeWidth={2} />
                {meta?.label || id}
              </button>
            );
          })}
        </div>
      )}

      <ResponsiveGridLayout
        className={`dashboard-grid layout ${editMode ? 'dashboard-grid--edit' : ''}`}
        layouts={layouts}
        breakpoints={DASHBOARD_BREAKPOINTS}
        cols={DASHBOARD_COLS}
        rowHeight={DASHBOARD_ROW_HEIGHT}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        onLayoutChange={onLayoutsChange}
        isDraggable={editMode}
        isResizable={editMode}
        draggableCancel=".dashboard-widget-actions, a, button, input, select, textarea"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms
      >
        {!hiddenWidgets.includes('kpi') && (
          <div key="kpi">
            <WidgetShell id="kpi" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <div className="grid h-full grid-cols-2 content-start gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  title="Today's Sales"
                  value={formatInr(stats.todaysSales)}
                  icon={IndianRupee}
                  changePct={stats.todaysSalesChangePct}
                  iconTone="primary"
                  sparkline={salesSparkline}
                  to="/sales"
                />
                <StatCard
                  title="Monthly Revenue"
                  value={formatInr(stats.monthRevenue)}
                  icon={TrendingUp}
                  changePct={stats.monthRevenueChangePct}
                  iconTone="accent"
                  sparkline={revenueSparkline}
                  to="/sales"
                />
                <StatCard
                  title="Today's Orders"
                  value={Number(stats.invoiceCountToday ?? 0).toLocaleString('en-IN')}
                  icon={Receipt}
                  changePct={stats.invoiceCountTodayChangePct}
                  iconTone="secondary"
                  to="/sales"
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
                  to="/parties?status=active"
                />
                <StatCard
                  title="Outstanding Payments"
                  value={formatInr(outstanding)}
                  icon={Wallet}
                  to="/sales?payment=pending"
                  iconTone="danger"
                />
              </div>
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('revenue') && (
          <div key="revenue">
            <WidgetShell id="revenue" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <div className="h-full min-h-0">
                <TrendChart
                  data={chartData}
                  range={trendRange}
                  onRangeChange={setTrendRange}
                  compact
                />
              </div>
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('business') && (
          <div key="business">
            <WidgetShell id="business" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <section className="flex h-full min-h-0 flex-col overflow-auto rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-3 shadow-soft">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-secondary)_16%,transparent)] text-aura-secondary">
                    <Gauge className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold tracking-tight text-aura-text">
                      Business Summary
                    </h3>
                    <p className="truncate text-[10px] text-aura-text-secondary">Target & health</p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center justify-center gap-3">
                    {hasSalesTarget ? (
                      <ProgressRing
                        size="sm"
                        percent={salesTargetPercent}
                        label="Target"
                        subtitle={`${formatInr(monthRevenue)} / ${formatInr(monthlySalesTarget)}`}
                        color="var(--aura-primary)"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <ProgressRing size="sm" percent={0} label="Target" empty />
                        <Link
                          to="/settings/business"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-aura-primary hover:underline"
                        >
                          <Settings className="h-3 w-3" strokeWidth={2} />
                          Set target
                        </Link>
                      </div>
                    )}
                    <div className="relative h-24 w-24 shrink-0">
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">
                        {insufficient ? (
                          <span className="text-[10px] font-semibold text-aura-muted">N/A</span>
                        ) : (
                          <>
                            <span
                              className={`text-base font-bold tabular-nums leading-none ${healthTier.colorClass}`}
                            >
                              {healthScore}
                            </span>
                            <span className="text-[9px] font-medium uppercase tracking-wide text-aura-muted">
                              Health
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-aura-border pt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-aura-text-secondary">Gross Profit</span>
                      <span
                        className={`font-bold tabular-nums ${
                          grossProfit < 0 ? 'text-aura-danger' : 'text-aura-success'
                        }`}
                      >
                        {formatInr(grossProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-aura-text-secondary">Expenses</span>
                      <span className="font-bold tabular-nums text-aura-text">
                        {formatInr(expensesThisMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-aura-text-secondary">Net Profit</span>
                      <span
                        className={`font-bold tabular-nums ${
                          netProfit < 0 ? 'text-aura-danger' : 'text-aura-success'
                        }`}
                      >
                        {formatInr(netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-aura-text-secondary">Collection</span>
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
              </section>
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('quick') && (
          <div key="quick">
            <WidgetShell id="quick" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <section className="flex h-full min-h-0 flex-col overflow-auto rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-3 shadow-soft">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary">
                    <Zap className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold tracking-tight text-aura-text">
                      Quick Actions
                    </h3>
                    <p className="text-[10px] text-aura-text-secondary">Shortcuts</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <QuickAction to="/sales" label="New invoice" icon={FileText} tone="primary" />
                  <QuickAction to="/purchases" label="New purchase" icon={ShoppingBag} tone="warning" />
                  <QuickAction to="/products" label="Add product" icon={PlusCircle} tone="accent" />
                  <QuickAction to="/parties" label="Add party" icon={UserPlus} tone="secondary" />
                </div>
              </section>
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('inventory') && (
          <div key="inventory">
            <WidgetShell id="inventory" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
                <div className="flex items-center justify-between gap-2 border-b border-aura-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-warning)_16%,transparent)] text-aura-warning">
                      <Package className="h-3.5 w-3.5" strokeWidth={2} />
                    </div>
                    <h3 className="truncate text-[12px] font-semibold text-aura-text">
                      Inventory Overview
                    </h3>
                  </div>
                  <Link
                    to="/products"
                    className="shrink-0 text-[11px] font-semibold text-aura-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="dashboard-dense-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Stock</th>
                        <th>Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryOverview.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-6 text-center text-aura-muted">
                            No inventory data.
                          </td>
                        </tr>
                      ) : (
                        inventoryOverview.slice(0, 6).map((row) => (
                          <tr key={row.id}>
                            <td className="max-w-[7rem] truncate font-medium text-aura-text">
                              {formatProductNameWithSize(row, 'paren')}
                            </td>
                            <td className="tabular-nums text-aura-text">
                              {Number(row.stock_quantity ?? row.current_stock ?? 0).toLocaleString(
                                'en-IN'
                              )}
                            </td>
                            <td className="tabular-nums text-aura-text">
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
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('orders') && (
          <div key="orders">
            <WidgetShell id="orders" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
                <div className="flex items-center justify-between gap-2 border-b border-aura-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary">
                      <Receipt className="h-3.5 w-3.5" strokeWidth={2} />
                    </div>
                    <h3 className="truncate text-[12px] font-semibold text-aura-text">Recent Orders</h3>
                  </div>
                  <Link
                    to="/sales"
                    className="shrink-0 text-[11px] font-semibold text-aura-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="dashboard-dense-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Party</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-6 text-center text-aura-muted">
                            No recent orders.
                          </td>
                        </tr>
                      ) : (
                        recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td className="font-medium tabular-nums text-aura-text">
                              {order.invoice_number || '—'}
                            </td>
                            <td className="max-w-[6rem] truncate text-aura-text">
                              {order.party_name || '—'}
                            </td>
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
            </WidgetShell>
          </div>
        )}

        {!hiddenWidgets.includes('topselling') && (
          <div key="topselling">
            <WidgetShell id="topselling" editMode={editMode} onToggleHidden={toggleWidgetHidden}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft">
                <div className="flex items-center gap-2 border-b border-aura-border px-3 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-accent)_16%,transparent)] text-aura-accent">
                    <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                  <h3 className="truncate text-[12px] font-semibold text-aura-text">
                    Top Selling Products
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="dashboard-dense-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="py-6 text-center text-aura-muted">
                            No sales data yet.
                          </td>
                        </tr>
                      ) : (
                        topProducts.map((product) => (
                          <tr key={product.id}>
                            <td className="max-w-[8rem] truncate font-medium text-aura-text">
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
            </WidgetShell>
          </div>
        )}
      </ResponsiveGridLayout>
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
