import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

function formatRupee(value) {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}k`;
  }
  return `₹${value}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card px-3 py-2 text-[11px] shadow-floating">
      <p className="mb-1 font-semibold text-aura-text">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="flex items-center justify-between gap-4"
          style={{ color: entry.color }}
        >
          <span>{entry.name}</span>
          <span className="font-semibold tabular-nums">
            ₹{Number(entry.value).toLocaleString('en-IN')}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data, range, onRangeChange, compact = false }) {
  const { tokens } = useTheme();
  const ranges = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  const totalSales = (data || []).reduce((s, d) => s + (Number(d.sales) || 0), 0);
  const totalPurchases = (data || []).reduce((s, d) => s + (Number(d.purchases) || 0), 0);
  const chartHeight = compact ? 220 : 320;

  return (
    <div
      className={`h-full rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card shadow-soft transition-all duration-lift ease-lift hover:shadow-medium ${
        compact ? 'p-3' : 'p-6'
      }`}
    >
      <div
        className={`flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between ${
          compact ? 'mb-2' : 'mb-6'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`flex shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary ${
              compact ? 'h-8 w-8' : 'h-11 w-11'
            }`}
          >
            <TrendingUp className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3
              className={`font-semibold tracking-tight text-aura-text ${
                compact ? 'text-[13px]' : 'text-[length:var(--aura-type-h5)]'
              }`}
            >
              Revenue Overview
            </h3>
            {!compact && (
              <p className="mt-0.5 text-[length:var(--aura-type-body)] text-aura-text-secondary">
                Sales revenue trend with purchases for context
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
              className={`chart-range-pill ${compact ? '!px-2.5 !py-1 text-[10px]' : ''} ${
                range === r.id ? 'chart-range-pill-active' : 'chart-range-pill-inactive'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex flex-wrap gap-2 text-[11px] ${compact ? 'mb-2' : 'mb-6'}`}>
        <div className="flex items-center gap-1.5 rounded-[var(--aura-radius-button)] border border-aura-border bg-[color-mix(in_srgb,var(--aura-primary)_10%,var(--aura-card))] px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-aura-primary" />
          <span className="text-aura-text-secondary">Sales</span>
          <span className="font-bold tabular-nums text-aura-primary">
            ₹{totalSales.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-[var(--aura-radius-button)] border border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))] px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-aura-warning" />
          <span className="text-aura-text-secondary">Purchases</span>
          <span className="font-bold tabular-nums text-aura-warning">
            ₹{totalPurchases.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <div className="w-full min-w-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data || []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={tokens.primary} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="purchaseArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.warning} stopOpacity={0.22} />
                <stop offset="100%" stopColor={tokens.warning} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: tokens.textSecondary, fontSize: compact ? 10 : 12 }}
              axisLine={{ stroke: tokens.border }}
              tickLine={false}
              interval={(data || []).length > 14 ? Math.floor((data || []).length / 7) : 0}
            />
            <YAxis
              tickFormatter={formatRupee}
              tick={{ fill: tokens.textSecondary, fontSize: compact ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
              width={compact ? 40 : 52}
            />
            <Tooltip content={<ChartTooltip />} />
            {!compact && (
              <Legend
                wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                formatter={(value) => <span className="text-aura-text-secondary">{value}</span>}
              />
            )}
            <Area
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke={tokens.primary}
              strokeWidth={2}
              fill="url(#salesArea)"
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="purchases"
              name="Purchases"
              stroke={tokens.warning}
              strokeWidth={1.75}
              fill="url(#purchaseArea)"
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
