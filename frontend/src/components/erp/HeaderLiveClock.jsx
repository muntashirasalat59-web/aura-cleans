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
      className="header-live-clock flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--aura-radius-button)] bg-[color:var(--aura-shell-quick-add)] px-3 text-white shadow-soft"
      aria-live="polite"
      aria-label={`Live date and time: ${dateLine}, ${timeLine}`}
      title={`${dateLine} · ${timeLine} IST`}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <p className="text-[length:var(--aura-type-body)] font-bold tabular-nums xl:hidden">{timeLine}</p>
      <div className="hidden shrink-0 leading-tight xl:block">
        <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wide text-white/80">
          {dateLine}
        </p>
        <p className="text-[length:var(--aura-type-body)] font-bold tabular-nums">{timeLine}</p>
      </div>
      <span className="hidden shrink-0 text-[length:var(--aura-type-caption)] font-medium text-white/80 2xl:inline">
        IST
      </span>
    </div>
  );
}
