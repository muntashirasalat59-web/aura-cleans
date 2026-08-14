import { FormField } from './FormField';
import SegmentedControl from './SegmentedControl';
import PaymentSettlementSummary from '../invoice/PaymentSettlementSummary';
import { defaultDueDate, paymentBreakdown, parseAmountReceived } from '../../utils/invoicePayment';
import { formatInr } from '../../utils/gstBreakdown';

const COLLECTION_OPTIONS = [
  { value: 'paid', label: 'Paid now' },
  { value: 'pending', label: 'Pending' },
];

export default function InvoicePaymentFields({ payment, onChange, invoiceTotal = 0 }) {
  const collection = payment.collection === 'pending' ? 'pending' : 'paid';
  const breakdown = paymentBreakdown(payment, invoiceTotal);
  const receivedNow = parseAmountReceived(payment);
  const exceedsTotal = receivedNow > breakdown.totalBilled + 0.001;

  function set(field, value) {
    onChange({ ...payment, [field]: value });
  }

  function setCollection(next) {
    if (next === 'pending') {
      onChange({
        ...payment,
        collection: 'pending',
        due_date: payment.due_date || defaultDueDate(3),
        amount_paid:
          payment.amount_paid === '' || payment.amount_paid == null ? '0' : payment.amount_paid,
      });
      return;
    }
    onChange({
      ...payment,
      collection: 'paid',
      due_date: '',
      amount_paid: '',
    });
  }

  return (
    <div className="surface-inset p-4 sm:p-5 mb-8">
      <div className="mb-5">
        <p className="field-label mb-2">Payment status</p>
        <SegmentedControl
          value={collection}
          onChange={setCollection}
          options={COLLECTION_OPTIONS}
        />
        <p className="field-hint mt-2">
          {collection === 'paid'
            ? 'Full amount marked as received — no due date needed.'
            : 'Party will pay later — set a due date. Enter any amount received now (advance / partial).'}
        </p>
      </div>

      {collection === 'pending' && (
        <>
          <div className="form-section-grid mb-5">
            <FormField
              label="Due date"
              required={breakdown.status !== 'paid'}
              hint="When the party promised to settle the balance."
            >
              <input
                type="date"
                className="input input-premium"
                value={payment.due_date || ''}
                onChange={(e) => set('due_date', e.target.value)}
                required={breakdown.status !== 'paid'}
              />
            </FormField>
            <FormField
              label="Amount Received Now (₹)"
              hint="Optional. Leave 0 if nothing has been collected yet."
              warning={
                exceedsTotal
                  ? `Cannot exceed Total Billed (${formatInr(breakdown.totalBilled)}).`
                  : undefined
              }
            >
              <input
                type="number"
                min="0"
                step="0.01"
                max={invoiceTotal > 0 ? invoiceTotal : undefined}
                inputMode="decimal"
                className="input input-premium tabular-nums"
                placeholder="0"
                value={payment.amount_paid ?? ''}
                onChange={(e) => set('amount_paid', e.target.value)}
              />
            </FormField>
          </div>

          <div className="form-summary-card mb-5 max-w-md">
            <p className="form-summary-label mb-3">Settlement</p>
            <PaymentSettlementSummary
              totalBilled={breakdown.totalBilled}
              amountReceived={breakdown.amountReceived}
              balanceDue={breakdown.balanceDue}
            />
            {breakdown.isPartial && (
              <p className="field-hint mt-3">
                Invoice will be saved as Partial — dashboard outstanding counts only the balance due.
              </p>
            )}
            {breakdown.status === 'paid' && receivedNow > 0 && (
              <p className="field-hint mt-3">
                Amount received equals Total Billed — invoice will be marked Paid.
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
        Optional bank / UPI details — shown on PDF and print when filled in.
      </p>
      <div className="form-grid">
        <FormField label="Bank name">
          <input
            type="text"
            className="input input-premium"
            placeholder="e.g. HDFC Bank"
            value={payment.bank_name}
            onChange={(e) => set('bank_name', e.target.value)}
          />
        </FormField>
        <FormField label="Account number">
          <input
            type="text"
            className="input input-premium font-mono text-sm"
            placeholder="Account number"
            value={payment.account_number}
            onChange={(e) => set('account_number', e.target.value)}
          />
        </FormField>
        <FormField label="UPI ID">
          <input
            type="text"
            className="input input-premium font-mono text-sm"
            placeholder="name@upi"
            value={payment.upi}
            onChange={(e) => set('upi', e.target.value)}
          />
        </FormField>
        <FormField label="Payment terms" className="md:col-span-2 lg:col-span-3">
          <textarea
            className="input input-premium min-h-[72px] resize-y"
            placeholder="e.g. Payment due within 15 days of invoice date."
            value={payment.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
            rows={2}
          />
        </FormField>
      </div>
    </div>
  );
}
