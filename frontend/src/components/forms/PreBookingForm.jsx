import { CalendarClock } from 'lucide-react';
import FormShell from './FormShell';
import { FormField } from './FormField';
import FormActions from './FormActions';
import PartySelectField from './PartySelectField';
import ProductLineItemsEditor from './ProductLineItemsEditor';
import { SALES_PARTY_TYPES, SALES_QUICK_ADD_TYPES } from '../../utils/partyTypes';

export default function PreBookingForm({
  mode = 'create',
  form,
  onChange,
  parties,
  products,
  onPartyCreated,
  onSubmit,
  onCancel,
  error = '',
  saving = false,
}) {
  const editing = mode === 'edit';

  function setField(patch) {
    onChange({ ...form, ...patch });
  }

  return (
    <div className="form-panel">
      <FormShell
        icon={CalendarClock}
        title={editing ? 'Edit pre-booking' : 'New pre-booking'}
        subtitle={
          editing
            ? 'Update the customer, delivery date, or products. Totals recalculate as you type.'
            : 'One customer and delivery date, with as many products as they ordered.'
        }
      >
        <form onSubmit={onSubmit}>
          <div className="form-grid mb-6">
            <PartySelectField
              label="Party"
              required
              className="md:col-span-2"
              value={form.party_id}
              onChange={(partyId) => setField({ party_id: partyId })}
              parties={parties}
              onPartyCreated={onPartyCreated}
              defaultTypes={SALES_PARTY_TYPES}
              showAllLabel="Show all party types (including manufacturers)"
              quickAddLabel="New Customer"
              quickAddTitle="New customer"
              quickAddDefaultType="retailer"
              quickAddAllowedTypes={SALES_QUICK_ADD_TYPES}
              placeholder="Search customer…"
            />
            <FormField label="Delivery date" required>
              <input
                type="date"
                className="input input-premium"
                value={form.delivery_date}
                onChange={(e) => setField({ delivery_date: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Notes (optional)" className="md:col-span-2 lg:col-span-3">
              <textarea
                className="input input-premium min-h-[88px] resize-y"
                rows={2}
                value={form.notes}
                onChange={(e) => setField({ notes: e.target.value })}
                placeholder="Colour, size, reminder for the warehouse…"
              />
            </FormField>
          </div>

          <p className="form-section-label">Line items</p>
          <p className="text-xs text-slate-500 mb-3">
            Catalog price fills Rate. GST % defaults to 18 and can be changed per product. Amount
            includes GST.
          </p>
          <ProductLineItemsEditor
            items={form.items}
            products={products}
            onChange={(items) => setField({ items })}
            addLabel="Add another product"
          />

          {error ? (
            <p role="alert" className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <FormActions
            submitLabel={editing ? 'Update pre-booking' : 'Save pre-booking'}
            onCancel={onCancel}
            submitDisabled={saving}
          />
        </form>
      </FormShell>
    </div>
  );
}
