import { Activity } from 'lucide-react';
import { useSharedLiveWeather } from '../../context/LiveWeatherContext';
import { useLiveClock } from '../../hooks/useLiveClock';

function SideWidget({ title, icon: Icon, children }) {
  return (
    <div className="premium-glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Dashboard weather card — reuses Layout's Open-Meteo fetch (no second API call). */
export default function LiveWeatherWidget() {
  const { weather, loading, error, city } = useSharedLiveWeather();
  const now = useLiveClock();

  const secondsSinceUpdate =
    weather?.updatedAt != null
      ? Math.floor((now.getTime() - weather.updatedAt.getTime()) / 1000)
      : null;

  return (
    <SideWidget title={`Weather — ${city || '—'}`} icon={Activity}>
      {loading && !weather ? (
        <p className="text-sm text-slate-500">Loading live weather…</p>
      ) : error && !weather ? (
        <p className="text-sm text-amber-700">{error}</p>
      ) : (
        <>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {weather.temp}°C
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {weather.label} · {weather.humidity}% humidity
          </p>
          <p className="text-xs text-slate-400 mt-2">{weather.hint}</p>
          <p className="text-[10px] text-slate-400 mt-2 tabular-nums">
            Live · refreshed {secondsSinceUpdate != null ? `${secondsSinceUpdate}s ago` : 'now'}
          </p>
        </>
      )}
    </SideWidget>
  );
}
