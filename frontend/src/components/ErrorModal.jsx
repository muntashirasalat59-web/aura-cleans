import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ErrorModal({
  open,
  title = 'Unable to delete',
  message,
  onClose,
  actionLabel = 'Got it',
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/40 animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-modal-title"
        aria-describedby="error-modal-message"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3
                id="error-modal-title"
                className="text-lg font-semibold tracking-tight text-white"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p
            id="error-modal-message"
            className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap"
          >
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-5 py-4">
          <button type="button" className="btn btn-primary btn-lg rounded-xl" onClick={onClose}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
