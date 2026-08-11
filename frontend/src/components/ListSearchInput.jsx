import { Search, X } from 'lucide-react';

/** Case-insensitive partial match across one or more string fields. */
export function matchesListSearch(query, ...fields) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => String(field || '').toLowerCase().includes(q));
}

/**
 * Compact in-page list search — sits in table-wrap-header rows.
 */
export default function ListSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  'aria-label': ariaLabel,
}) {
  return (
    <div className={`relative min-w-[10rem] max-w-xs flex-1 sm:flex-none sm:w-56 ${className}`}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-aura-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoComplete="off"
        className="input input-premium w-full py-1.5 pl-8 pr-8 text-sm"
      />
      {value ? (
        <button
          type="button"
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-aura-muted hover:bg-aura-elevated hover:text-aura-text"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
