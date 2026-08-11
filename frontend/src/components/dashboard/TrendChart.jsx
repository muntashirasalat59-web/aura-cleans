import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
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
    <div className="rounded-[var(--aura-radius-dropdown)] border border-aura-border bg-aura-card px-4 py-3 text-[length:var(--aura-type-body)] shadow-floating">
      <p className="mb-2 font-semibold text-aura-text">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center justify-between gap-6" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-semibold tabular-nums">
            ₹{Number(entry.value).toLocaleString('en-IN')}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data, range, onRangeChange }) {
  const { tokens } = useTheme();
  const ranges = [
    { id: '7', label: 'Last 7 days' },
    { id: '30', label: 'Last 30 days' },
    { id: 'month', label: 'This month' },
  ];

  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalPurchases = data.reduce((s, d) => s + d.purchases, 0);

  return (
    <div className="rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--aura-radius-button)] bg-aura-accent text-white shadow-soft">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[length:var(--aura-type-h5)] font-semibold tracking-tight text-aura-text">
              Sales vs purchases trend
            </h3>
            <p className="mt-1 text-[length:var(--aura-type-body)] text-aura-text-secondary">
              Date-wise revenue and procurement (₹)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
              className={`chart-range-pill ${range === r.id ? 'chart-range-pill-active' : 'chart-range-pill-inactive'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 text-[length:var(--aura-type-body)]">
        <div className="flex items-center gap-2 rounded-[var(--aura-radius-button)] border border-aura-border bg-[color-mix(in_srgb,var(--aura-primary)_10%,var(--aura-card))] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-aura-primary" />
          <span className="text-aura-text-secondary">Sales</span>
          <span className="font-bold tabular-nums text-aura-primary">
            ₹{totalSales.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-[var(--aura-radius-button)] border border-aura-border bg-[color-mix(in_srgb,var(--aura-warning)_10%,var(--aura-card))] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-aura-warning" />
          <span className="text-aura-text-secondary">Purchases</span>
          <span className="font-bold tabular-nums text-aura-warning">
            ₹{totalPurchases.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <div className="h-80 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.95} />
                <stop offset="100%" stopColor={tokens.primaryHover} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="purchaseBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.warning} stopOpacity={0.9} />
                <stop offset="100%" stopColor={tokens.warning} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.border} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: tokens.textSecondary, fontSize: 12 }}
              axisLine={{ stroke: tokens.border }}
              tickLine={false}
              interval={data.length > 14 ? Math.floor(data.length / 7) : 0}
            />
            <YAxis
              tickFormatter={formatRupee}
              tick={{ fill: tokens.textSecondary, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16, fontSize: 13 }}
              formatter={(value) => <span className="text-aura-text-secondary">{value}</span>}
            />
            <Bar dataKey="sales" name="Sales" fill="url(#salesBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="purchases" name="Purchases" fill="url(#purchaseBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
