/** Notify listeners when database rows change (app actions or Supabase realtime). */
const listeners = new Set();

export function subscribeDataSync(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function notifyDataSync(table = 'all') {
  listeners.forEach((fn) => {
    try {
      fn(table);
    } catch (err) {
      console.warn('[dataSync] listener error', err);
    }
  });
}

export function removeById(list, id) {
  return (list || []).filter((row) => String(row.id) !== String(id));
}
