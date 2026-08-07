/** Relative time like "2 hours ago", with exact date/time for older entries. */
export function formatRelativeTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);

  let relative;
  if (minutes < 1) relative = 'just now';
  else if (minutes < 60) relative = `${minutes} min ago`;
  else if (hours < 24) relative = `${hours} hour${hours === 1 ? '' : 's'} ago`;
  else if (days < 7) relative = `${days} day${days === 1 ? '' : 's'} ago`;
  else {
    relative = date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const exact = date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return { relative, exact };
}
