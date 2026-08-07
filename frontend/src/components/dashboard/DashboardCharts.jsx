import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactRupee } from '../../utils/formatCurrency';

function ChartShell({ title, subtitle, children }) {
  return (
    <div className="premium-glass-card p-5 sm:p-6">
      <div className="mb-5">
        <h3 className="type-widget-title">{title}</h3>
        {subtitle && <p className="type-body-muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-slate-900 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="tabular-nums text-slate-600">
          {entry.name}: {formatCompactRupee(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function TrendPrimaryChart({ data }) {
  const chartData = data?.length ? data : [{ label: '—', sales: 0 }];

  return (
    <ChartShell title="Trend — primary metric" subtitle="Sales revenue over time">
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={formatCompactRupee}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<MiniTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#salesArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function ComparisonSecondaryChart({ data }) {
  const chartData = data?.length ? data : [{ label: '—', sales: 0, purchases: 0 }];

  return (
    <ChartShell title="Comparison — secondary" subtitle="Sales vs purchases">
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={formatCompactRupee}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<MiniTooltip />} />
            <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="purchases" name="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
