import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

function formatAmount(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function DeletePartyModal({
  open,
  partyName,
  invoices = [],
  purchases = [],
  loading = false,
  confirming = false,
  onClose,
  onConfirmCascade,
}) {
  if (!open) return null;

  const activeInvoices = invoices.filter((row) => !row.is_deleted);
  const softDeletedInvoices = invoices.filter((row) => row.is_deleted);
  const hasLinks = invoices.length > 0 || purchases.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={confirming ? undefined : onClose}
        disabled={confirming}
      />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/40 animate-scale-in flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-party-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 id="delete-party-title" className="text-lg font-semibold tracking-tight text-white">
                Delete party
              </h3>
              {partyName && (
                <p className="mt-0.5 text-sm text-slate-400 truncate">{partyName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
            onClick={onClose}
            aria-label="Close"
            disabled={confirming}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading linked records…</p>
          ) : !hasLinks ? (
            <p className="text-sm leading-relaxed text-slate-300">
              No invoices or purchases are linked. This party can be deleted permanently.
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-300">
                This party has linked records. Deleting will permanently remove them and restore
                stock for active invoices. This cannot be undone.
              </p>

              {activeInvoices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Linked invoices ({activeInvoices.length})
                  </p>
                  <ul className="rounded-xl border border-slate-700/80 divide-y divide-slate-800 overflow-hidden">
                    {activeInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{inv.invoice_number}</p>
                          <p className="text-xs text-slate-500">{inv.invoice_date || '—'}</p>
                        </div>
                        <p className="tabular-nums font-semibold text-emerald-400 shrink-0">
                          {formatAmount(inv.total_amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {softDeletedInvoices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Soft-deleted invoices ({softDeletedInvoices.length})
                  </p>
                  <ul className="rounded-xl border border-slate-700/80 divide-y divide-slate-800 overflow-hidden opacity-80">
                    {softDeletedInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-300 truncate">{inv.invoice_number}</p>
                          <p className="text-xs text-slate-500">{inv.invoice_date || '—'}</p>
                        </div>
                        <p className="tabular-nums text-slate-400 shrink-0">
                          {formatAmount(inv.total_amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {purchases.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Linked purchases ({purchases.length})
                  </p>
                  <ul className="rounded-xl border border-slate-700/80 divide-y divide-slate-800 overflow-hidden">
                    {purchases.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {row.notes ? `Purchase — ${row.notes}` : `Purchase #${row.id}`}
                          </p>
                          <p className="text-xs text-slate-500">{row.purchase_date || '—'}</p>
                        </div>
                        <p className="tabular-nums font-semibold text-indigo-300 shrink-0">
                          {formatAmount(row.total_amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 px-5 py-4 shrink-0">
          <button
            type="button"
            className="btn btn-secondary btn-lg rounded-xl"
            onClick={onClose}
            disabled={confirming || loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-lg rounded-xl"
            onClick={onConfirmCascade}
            disabled={confirming || loading}
          >
            <Trash2 className="h-4 w-4" />
            {confirming
              ? 'Deleting…'
              : hasLinks
                ? 'Delete all linked records & party'
                : 'Delete party'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
