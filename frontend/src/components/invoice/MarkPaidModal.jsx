import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, X } from 'lucide-react';
import { FormField } from '../forms/FormField';

const METHODS = ['Cash', 'Bank', 'UPI'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkPaidModal({
  open,
  invoiceNumber,
  documentLabel,
  partyName,
  amountDue,
  onClose,
  onConfirm,
  confirming = false,
}) {
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const label = documentLabel || invoiceNumber || 'this record';

  useEffect(() => {
    if (open) {
      setPaymentDate(todayIso());
      setPaymentMethod('Cash');
    }
  }, [open, invoiceNumber, documentLabel]);

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-paid-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Banknote className="h-5 w-5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 id="mark-paid-title" className="text-lg font-semibold tracking-tight text-white">
                Mark {label} as paid?
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {partyName ? `${partyName} · ` : ''}
                Due ₹{Number(amountDue || 0).toLocaleString('en-IN')}
              </p>
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

        <div className="space-y-4 px-5 py-4">
          <FormField label="Payment date" required>
            <input
              type="date"
              className="input input-premium"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Payment method" required>
            <select
              className="input input-premium"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 px-5 py-4">
          <button type="button" className="btn btn-secondary btn-lg rounded-xl" onClick={onClose} disabled={confirming}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg rounded-xl"
            disabled={confirming || !paymentDate}
            onClick={() => onConfirm({ payment_date: paymentDate, payment_method: paymentMethod })}
          >
            {confirming ? 'Saving…' : 'Confirm paid'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
