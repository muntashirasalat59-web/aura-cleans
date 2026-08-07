import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { FormField } from '../forms/FormField';

export const INVOICE_DELETE_REASONS = [
  { value: 'wrong_entry', label: 'Wrong entry / Mistake' },
  { value: 'customer_cancelled', label: 'Customer cancelled order' },
  { value: 'duplicate', label: 'Duplicate invoice' },
  { value: 'incorrect_items', label: 'Incorrect items/pricing' },
  { value: 'other', label: 'Other' },
];

const OTHER_MIN_LENGTH = 3;

export function buildInvoiceDeleteReason(reasonCode, customReason) {
  if (reasonCode === 'other') {
    return customReason.trim();
  }
  return INVOICE_DELETE_REASONS.find((option) => option.value === reasonCode)?.label || '';
}

export function isInvoiceDeleteReasonValid(reasonCode, customReason) {
  if (!reasonCode) return false;
  if (reasonCode === 'other') {
    return customReason.trim().length >= OTHER_MIN_LENGTH;
  }
  return true;
}

export default function DeleteInvoiceModal({
  open,
  invoiceNumber,
  onClose,
  onConfirm,
  confirming = false,
}) {
  const [reasonCode, setReasonCode] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (open) {
      setReasonCode('');
      setCustomReason('');
    }
  }, [open, invoiceNumber]);

  if (!open) return null;

  const showCustomReason = reasonCode === 'other';
  const canConfirm = isInvoiceDeleteReasonValid(reasonCode, customReason) && !confirming;

  function handleClose() {
    if (confirming) return;
    onClose();
  }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(buildInvoiceDeleteReason(reasonCode, customReason));
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-md premium-glass-card p-6 shadow-2xl border border-red-200/60 animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-invoice-title"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 id="delete-invoice-title" className="text-lg font-bold text-slate-900">
              Delete invoice
            </h3>
            {invoiceNumber && (
              <p className="text-sm text-slate-500 mt-0.5 font-mono">{invoiceNumber}</p>
            )}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={handleClose}
            aria-label="Close"
            disabled={confirming}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <p>
            This will remove the invoice from active records and restore stock quantities. This
            action will be logged.
          </p>
        </div>

        <div className="space-y-4">
          <FormField label="Reason for deletion" required>
            <select
              className="input input-premium"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              disabled={confirming}
            >
              <option value="">Select a reason…</option>
              {INVOICE_DELETE_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {showCustomReason && (
            <FormField label="Custom reason" required>
              <textarea
                className="input input-premium min-h-[88px] resize-y"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe why this invoice is being deleted"
                disabled={confirming}
                rows={3}
              />
              {customReason.trim().length > 0 && customReason.trim().length < OTHER_MIN_LENGTH && (
                <p className="mt-1 text-xs text-slate-500">
                  Please enter at least {OTHER_MIN_LENGTH} characters.
                </p>
              )}
            </FormField>
          )}

          <div className="form-actions pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-danger btn-lg"
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                {confirming ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary btn-lg"
                disabled={confirming}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
