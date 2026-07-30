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
} from 'lucide-react';
import { dashboardAPI } from '../api';
import LoadingState from '../components/LoadingState';
import TrendChart from '../components/dashboard/TrendChart';
import { formatProductNameWithSize, formatQuantityWithSize } from '../utils/productDisplay';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [trendRange, setTrendRange] = useState('7');

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

  const topMaxQty = Math.max(...topProducts.map((p) => p.quantity_sold), 1);

  return (
    <div className="dashboard-shell space-y-8 sm:space-y-10">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200/40 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 sm:px-8 sm:py-10 text-white shadow-[0_20px_50px_rgba(15,23,42,0.25)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_50%)]" />
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
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
          <div className="flex flex-wrap gap-6 sm:gap-8 text-sm">
            <div>
              <p className="text-amber-200/80 text-xs uppercase tracking-wider font-medium">Net profit</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1">
                ₹{(stats.netProfit ?? stats.totalSales - stats.totalPurchases).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="h-12 w-px bg-white/15 hidden sm:block" />
            <div>
              <p className="text-amber-200/80 text-xs uppercase tracking-wider font-medium">This month</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-emerald-300">
                ₹{(stats.monthRevenue ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="h-12 w-px bg-white/15 hidden sm:block" />
            <div>
              <p className="text-amber-200/80 text-xs uppercase tracking-wider font-medium">Stock value</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-amber-100">
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
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
          title="Net profit"
          value={`₹${(stats.netProfit ?? 0).toLocaleString('en-IN')}`}
          subtitle="Sales − purchases − expenses"
          icon={Scale}
          tone="emerald"
        />
        <KpiChip
          title="Pending payments"
          value={`₹${(stats.pendingPayments ?? 0).toLocaleString('en-IN')}`}
          subtitle={
            stats.pendingPartiesCount > 0
              ? `${stats.pendingPartiesCount} parties due`
              : 'All clear'
          }
          icon={Wallet}
          tone="amber"
        />
        <KpiChip
          title="Low stock items"
          value={stats.lowStockCount ?? 0}
          subtitle={`Below ${stats.lowStockThreshold ?? 10} units`}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SideWidget title="Today's tasks" icon={CalendarDays}>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <input type="checkbox" className="mt-1 rounded" defaultChecked /> Approve PR-4410 (raw material)
            </li>
            <li className="flex gap-2">
              <input type="checkbox" className="mt-1 rounded" /> Dispatch SO-66102 — Mumbai
            </li>
            <li className="flex gap-2">
              <input type="checkbox" className="mt-1 rounded" /> GSTR-1 review for July
            </li>
          </ul>
        </SideWidget>
        <SideWidget title="Calendar" icon={CalendarDays}>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">29</p>
          <p className="text-sm text-slate-500">July 2026 · 3 meetings</p>
          <p className="text-xs text-brand-700 dark:text-brand-300 mt-3">14:00 — Dealer review (West)</p>
        </SideWidget>
        <SideWidget title="Weather — Mumbai" icon={Activity}>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">28°C</p>
          <p className="text-sm text-slate-500">Humid · Good for dispatch planning</p>
        </SideWidget>
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
                  Below {stats.lowStockThreshold ?? 10} units triggers reorder suggestion
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
                          row.stock_quantity < (stats.lowStockThreshold ?? 10)
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
    <div className={`rounded-xl border px-4 py-3 sm:py-4 backdrop-blur-sm ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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
  const score = health.healthScore ?? 50;
  const margin = health.profitMarginPercent ?? 0;
  const status = health.healthStatus ?? 'moderate';
  const label = health.healthLabel ?? 'Moderate';

  const ringColor =
    status === 'strong'
      ? 'stroke-emerald-500'
      : status === 'attention'
        ? 'stroke-amber-500'
        : 'stroke-indigo-500';

  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="premium-glass-card p-6 sm:p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-900 text-amber-200 shadow-md">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Business health</h3>
          <p className="text-sm text-slate-500">Margin & operational signals</p>
        </div>
      </div>

      <div className="flex flex-col items-center flex-1 justify-center py-2">
        <div className="relative w-36 h-36 sm:w-40 sm:h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums text-slate-900">{score}</span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score</span>
          </div>
        </div>
        <p
          className={`mt-4 text-sm font-semibold ${
            status === 'strong'
              ? 'text-emerald-700'
              : status === 'attention'
                ? 'text-amber-700'
                : 'text-indigo-700'
          }`}
        >
          {label}
        </p>
      </div>

      <div className="space-y-3 mt-4 pt-4 border-t border-slate-100">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Profit margin</span>
          <span className="font-bold tabular-nums text-slate-900">{margin}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              margin >= 25 ? 'bg-emerald-500' : margin >= 10 ? 'bg-amber-500' : 'bg-rose-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>Net ₹{(health.netProfit ?? 0).toLocaleString('en-IN')}</span>
          <span>
            {stats.lowStockCount ?? 0} low stock · ₹{(stats.pendingPayments ?? 0).toLocaleString('en-IN')} due
          </span>
        </div>
      </div>
    </div>
  );
}

function SideWidget({ title, icon: Icon, children }) {
  return (
    <div className="premium-glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {children}
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
    mesh: 'from-emerald-500/15 via-white/90 to-amber-50/30',
    border: 'border-emerald-200/50',
    iconWrap: 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-900/20',
    glow: 'bg-emerald-400/20',
    accent: 'from-emerald-400 to-emerald-600',
  },
  purchases: {
    mesh: 'from-indigo-600/15 via-white/90 to-slate-50/50',
    border: 'border-indigo-200/50',
    iconWrap: 'bg-gradient-to-br from-indigo-700 to-indigo-950 shadow-indigo-900/25',
    glow: 'bg-indigo-400/15',
    accent: 'from-indigo-400 to-indigo-700',
  },
  products: {
    mesh: 'from-violet-500/10 via-white/90 to-indigo-50/20',
    border: 'border-violet-200/40',
    iconWrap: 'bg-gradient-to-br from-violet-600 to-indigo-900 shadow-violet-900/20',
    glow: 'bg-violet-400/15',
    accent: 'from-violet-400 to-indigo-600',
  },
  stock: {
    mesh: 'from-amber-400/20 via-white/90 to-amber-50/40',
    border: 'border-amber-200/60',
    iconWrap: 'bg-gradient-to-br from-amber-500 to-amber-700 shadow-amber-900/20',
    glow: 'bg-amber-400/25',
    accent: 'from-amber-400 to-amber-600',
  },
};

function StatCard({ title, value, subtitle, variant, icon: Icon }) {
  const style = statVariants[variant];

  return (
    <div
      className={`premium-stat-card group border ${style.border} bg-gradient-to-br ${style.mesh} backdrop-blur-xl`}
    >
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl ${style.glow} opacity-80 group-hover:opacity-100 transition-opacity`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 tabular-nums truncate">
            {value}
          </p>
          {subtitle && <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${style.iconWrap} group-hover:scale-105 transition-transform duration-300`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div
        className={`mt-5 h-1 w-16 rounded-full bg-gradient-to-r ${style.accent} opacity-80 group-hover:w-24 transition-all duration-300`}
      />
    </div>
  );
}
