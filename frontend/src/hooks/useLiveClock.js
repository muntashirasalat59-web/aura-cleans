import { useEffect, useState } from 'react';

/** Updates every second — for live date/time display. */
export function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}
