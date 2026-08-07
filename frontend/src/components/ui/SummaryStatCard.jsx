/** Clean stat card — matches original Owner Dashboard reference design. */
export default function SummaryStatCard({ title, value, subtitle, className = '' }) {
  return (
    <div className={`app-summary-card card p-5 sm:p-6 ${className}`}>
      <p className="app-stat-label">{title}</p>
      <p className="app-stat-value mt-2 truncate">{value}</p>
      {subtitle && <p className="app-stat-subtitle mt-1.5">{subtitle}</p>}
    </div>
  );
}
