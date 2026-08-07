import { useEffect, useState } from 'react';
import {
  ClipboardList,
  PlusCircle,
  Pencil,
  Trash2,
  Banknote,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { activityLogAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import { FormField } from '../components/forms/FormField';
import { formatRelativeTime } from '../utils/relativeTime';
import { ACTIVITY_EXPORT_COLUMNS, mapActivityExportRow } from '../config/exportColumns';

const PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
  { value: 'mark_paid', label: 'Marked as paid' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'product', label: 'Product' },
  { value: 'party', label: 'Party' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sale', label: 'Sale / Invoice' },
  { value: 'expense', label: 'Expense' },
  { value: 'settings', label: 'Business settings' },
];

const ACTION_LABELS = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  mark_paid: 'marked as paid',
};

const ENTITY_LABELS = {
  product: 'Product',
  party: 'Party',
  purchase: 'Purchase',
  sale: 'Invoice',
  expense: 'Expense',
  settings: 'Settings',
};

function ActionIcon({ actionType }) {
  if (actionType === 'delete') {
    return <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />;
  }
  if (actionType === 'create') {
    return <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (actionType === 'mark_paid') {
    return <Banknote className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
  }
  return <Pencil className="h-4 w-4 text-slate-500 dark:text-slate-400" />;
}

const emptyFilters = () => ({
  user_id: '',
  action_type: '',
  entity_type: '',
  from: '',
  to: '',
});

export default function ActivityLog() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actors, setActors] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [error, setError] = useState('');

  useEffect(() => {
    activityLogAPI
      .getActors()
      .then(setActors)
      .catch(() => setActors([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const data = await activityLogAPI.list({
          ...applied,
          limit: PAGE_SIZE,
          offset,
        });
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Failed to load activity log');
        setItems([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [applied, offset]);

  function applyFilters(e) {
    e?.preventDefault?.();
    setOffset(0);
    setApplied({ ...filters });
  }

  function clearFilters() {
    const empty = emptyFilters();
    setFilters(empty);
    setApplied(empty);
    setOffset(0);
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  if (loading && items.length === 0 && !error) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Who created, updated, deleted, or marked payments — newest first."
        action={
          <ExportMenu
            filePrefix="activity_log"
            successLabel="Activity log"
            columns={ACTIVITY_EXPORT_COLUMNS}
            getRows={() => items.map(mapActivityExportRow)}
            disabled={loading}
          />
        }
      />

      <form
        onSubmit={applyFilters}
        className="surface-panel p-4 sm:p-5"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--app-heading)] dark:text-slate-200">
          <Filter className="h-4 w-4 text-[var(--app-accent)] dark:text-slate-300" />
          Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="User">
            <select
              className="input input-premium"
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
            >
              <option value="">All users</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Action">
            <select
              className="input input-premium"
              value={filters.action_type}
              onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Type">
            <select
              className="input input-premium"
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="From">
            <input
              type="date"
              className="input input-premium"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </FormField>
          <FormField label="To">
            <input
              type="date"
              className="input input-premium"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </FormField>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Apply filters
          </button>
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="status-banner status-banner-warning dark:border dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {error}
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--app-border)] bg-[var(--list-header-bg)] text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)] dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    No activity yet. Create or delete a record to see it here.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const time = formatRelativeTime(row.created_at);
                  const isDelete = row.action_type === 'delete';
                  return (
                    <tr
                      key={row.id}
                      className={
                        isDelete
                          ? 'bg-[var(--status-danger-bg)] dark:bg-red-950/20'
                          : 'hover:bg-[var(--app-accent-soft)] dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {time.relative}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500" title={time.exact}>
                          {time.exact}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {row.user_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            isDelete
                              ? 'text-[var(--status-danger-text)] dark:text-red-300'
                              : 'text-[var(--app-text)] dark:text-slate-200'
                          }`}
                        >
                          <ActionIcon actionType={row.action_type} />
                          {ACTION_LABELS[row.action_type] || row.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {ENTITY_LABELS[row.entity_type] || row.entity_type}
                        </span>
                        <span
                          className={`mt-0.5 block font-medium ${
                            isDelete
                              ? 'text-red-800 dark:text-red-200'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {row.entity_name || '—'}
                        </span>
                        {row.details?.reason && (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Reason: {row.details.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] px-4 py-3 dark:border-slate-800">
          <p className="text-sm text-[var(--app-muted)] dark:text-slate-400">
            {total === 0 ? '0 entries' : `${pageStart}–${pageEnd} of ${total}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary py-1.5 text-sm"
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              className="btn btn-secondary py-1.5 text-sm"
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
