import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, Search, X } from 'lucide-react';
import { buildSearchIndex } from '../../config/erpNav';
import { useAuth } from '../../context/AuthContext';

const EXTRA = [
  { type: 'action', title: 'New invoice', path: '/sales', subtitle: 'Quick create' },
  { type: 'action', title: 'New purchase', path: '/purchases', subtitle: 'Quick create' },
  { type: 'action', title: 'AI chat assistant', path: '/ai', subtitle: 'Ask AURA AI' },
];

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const [query, setQuery] = useState('');
  const index = useMemo(
    () => [...buildSearchIndex({ role, isPlatformAdmin: Boolean(profile?.is_platform_admin) }), ...EXTRA],
    [role, profile?.is_platform_admin]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 12);
    return index.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q),
    );
  }, [query, index]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === 'Escape' && open) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(path) {
    navigate(path);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules, actions, customers…"
            className="flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] text-slate-500">
            <Command className="h-3 w-3" />K
          </kbd>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-500">No results</li>
          ) : (
            results.map((item) => (
              <li key={item.path + item.title}>
                <button
                  type="button"
                  onClick={() => go(item.path)}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
