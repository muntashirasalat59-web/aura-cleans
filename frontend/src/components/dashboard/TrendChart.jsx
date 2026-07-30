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
    <div className="rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xl text-sm dark:border-slate-600 dark:bg-slate-900/95">
      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{label}</p>
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
  const ranges = [
    { id: '7', label: 'Last 7 days' },
    { id: '30', label: 'Last 30 days' },
    { id: 'month', label: 'This month' },
  ];

  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalPurchases = data.reduce((s, d) => s + d.purchases, 0);

  return (
    <div className="premium-glass-card p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-950 to-indigo-800 text-amber-300 shadow-lg shadow-indigo-900/20">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Sales vs purchases trend</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">Date-wise revenue and procurement (₹)</p>
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

      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50/80 px-3 py-1.5 ring-1 ring-emerald-600/10">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Sales</span>
          <span className="font-bold text-emerald-700 tabular-nums">₹{totalSales.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50/80 px-3 py-1.5 ring-1 ring-indigo-600/10">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
          <span className="text-slate-600">Purchases</span>
          <span className="font-bold text-indigo-700 tabular-nums">₹{totalPurchases.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="h-[280px] sm:h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="purchaseBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#312e81" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              interval={data.length > 14 ? Math.floor(data.length / 7) : 0}
            />
            <YAxis
              tickFormatter={formatRupee}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 16, fontSize: 13 }}
              formatter={(value) => <span className="text-slate-600">{value}</span>}
            />
            <Bar dataKey="sales" name="Sales" fill="url(#salesBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="purchases" name="Purchases" fill="url(#purchaseBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
