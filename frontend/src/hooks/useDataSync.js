import { useEffect, useRef } from 'react';
import { subscribeDataSync } from '../lib/dataSync';

/**
 * Re-run `onSync` when relevant tables change (realtime or local notifyDataSync).
 * @param {string|string[]} tables - tables to watch, or '*' for all
 * @param {() => void} onSync - refetch handler (silent refresh recommended)
 */
export function useDataSync(tables, onSync) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const watchRef = useRef(
    Array.isArray(tables) ? tables : tables === '*' ? ['*'] : [tables]
  );

  useEffect(() => {
    const watch = watchRef.current;

    function matches(changedTable) {
      if (watch.includes('*') || watch.includes('all')) return true;
      if (watch.includes(changedTable)) return true;
      if (changedTable === 'sale_items' && watch.includes('sales')) return true;
      if (changedTable === 'purchase_items' && watch.includes('purchases')) return true;
      return false;
    }

    return subscribeDataSync((changedTable) => {
      if (matches(changedTable)) {
        onSyncRef.current(changedTable);
      }
    });
  }, []);
}
