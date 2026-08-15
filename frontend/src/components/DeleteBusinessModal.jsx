import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteBusinessModal({
  open,
  name,
  email,
  isBusiness = true,
  confirming = false,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

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
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/40 animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-business-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400 ring-1 ring-red-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 id="delete-business-title" className="text-lg font-semibold tracking-tight text-white">
                {isBusiness ? 'Delete business permanently' : 'Remove user'}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-400">
                {name}
                {email ? ` · ${email}` : ''}
              </p>
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

        <div className="space-y-3 px-5 py-4">
          {isBusiness ? (
            <>
              <p className="text-sm leading-relaxed text-slate-300">
                This will permanently delete this business, its owner login, and <strong className="text-white">all of its data</strong>
                — employees, products, parties, sales, purchases, expenses, support messages, and settings.
              </p>
              <p className="text-sm leading-relaxed text-red-300">
                This cannot be undone. Their invoices and stock history will be gone.
              </p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">
              Remove <strong className="text-white">{name}</strong> from this business? They will no longer
              be able to sign in.
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            className="btn btn-secondary btn-lg rounded-xl"
            onClick={onClose}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger btn-lg rounded-xl"
            onClick={onConfirm}
            disabled={confirming}
          >
            <Trash2 className="h-4 w-4" />
            {confirming ? 'Deleting…' : isBusiness ? 'Delete all data' : 'Remove user'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
