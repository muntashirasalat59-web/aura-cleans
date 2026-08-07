import { FormField } from './FormField';
import SegmentedControl from './SegmentedControl';
import { defaultDueDate } from '../../utils/invoicePayment';

const COLLECTION_OPTIONS = [
  { value: 'paid', label: 'Paid now' },
  { value: 'pending', label: 'Pending' },
];

/** Paid now / Pending + due date for supplier payables (no bank fields). */
export default function PurchasePaymentFields({ payment, onChange }) {
  const collection = payment.collection === 'pending' ? 'pending' : 'paid';

  function setCollection(next) {
    if (next === 'pending') {
      onChange({
        ...payment,
        collection: 'pending',
        due_date: payment.due_date || defaultDueDate(3),
      });
      return;
    }
    onChange({
      ...payment,
      collection: 'paid',
      due_date: '',
    });
  }

  return (
    <div className="surface-inset p-4 sm:p-5 mb-8">
      <div className="mb-2">
        <p className="field-label mb-2">Payment status</p>
        <SegmentedControl
          value={collection}
          onChange={setCollection}
          options={COLLECTION_OPTIONS}
        />
        <p className="field-hint mt-2">
          {collection === 'paid'
            ? 'Full amount paid to supplier now — no due date needed.'
            : 'Pay the supplier later — set a due date to track payables.'}
        </p>
      </div>

      {collection === 'pending' && (
        <div className="form-section-grid mt-5">
          <FormField
            label="Due date"
            required
            hint="When you need to pay this supplier."
          >
            <input
              type="date"
              className="input input-premium"
              value={payment.due_date || ''}
              onChange={(e) => onChange({ ...payment, due_date: e.target.value })}
              required
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
