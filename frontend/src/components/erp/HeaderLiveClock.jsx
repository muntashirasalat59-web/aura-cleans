import { Clock } from 'lucide-react';
import { useLiveClock } from '../../hooks/useLiveClock';

/** Compact live date & time for the app header (IST). */
export default function HeaderLiveClock() {
  const now = useLiveClock();

  const dateLine = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timeLine = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="header-live-clock flex shrink-0 items-center gap-2 rounded-xl border border-slate-900/10 dark:border-slate-700 bg-[#F7F8FA] dark:bg-slate-800/70 px-2.5 py-1.5 whitespace-nowrap"
      aria-live="polite"
      aria-label={`Live date and time: ${dateLine}, ${timeLine}`}
      title={`${dateLine} · ${timeLine} IST`}
    >
      <Clock className="h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
      {/* Compact: time only on mid widths; full date+time when space allows */}
      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white xl:hidden">
        {timeLine}
      </p>
      <div className="hidden xl:block leading-tight shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {dateLine}
        </p>
        <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{timeLine}</p>
      </div>
      <span className="hidden 2xl:inline text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
        IST
      </span>
    </div>
  );
}
