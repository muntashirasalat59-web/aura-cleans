import { Plus, Tag, Trash2 } from 'lucide-react';
import FormShell from './FormShell';
import { FormField, inputClassName } from './FormField';
import FormActions from './FormActions';
import { formatProductOptionLabel } from '../../utils/productDisplay';
import { formatInrAmount } from '../../utils/invoiceLineItems';
import { sanitizeDecimalInput } from '../../utils/formValidation';
import { emptyComboLine, comboRetailTotal } from '../../utils/offers';
import { money } from '../../utils/preBookings';
import { hasRetailPrice, listedRetailPrice } from '../../utils/productPricing';

export default function OfferForm({
  mode = 'create',
  form,
  onChange,
  products,
  onSubmit,
  onCancel,
  error = '',
  saving = false,
}) {
  const editing = mode === 'edit';
  const rows = form.items?.length ? form.items : [emptyComboLine()];
  const retailTotal = comboRetailTotal(rows, products);
  const comboPrice = Number(form.combo_price) || 0;
  const vsRetail = money(comboPrice - retailTotal);
  const isLossVsRetail = comboPrice > 0 && retailTotal > 0 && vsRetail < 0;

  function setField(patch) {
    onChange({ ...form, ...patch });
  }

  function setRows(next) {
    setField({ items: next });
  }

  function addRow() {
    setRows([...rows, emptyComboLine()]);
  }

  function removeRow(index) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateRow(index, field, value) {
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="form-panel">
      <FormShell
        icon={Tag}
        title={editing ? 'Edit offer' : 'New combo offer'}
        subtitle="A fixed package: pick the products and quantities, then set the final combo price the customer pays."
      >
        <form onSubmit={onSubmit}>
          <div className="form-grid mb-6">
            <FormField label="Offer name" required className="md:col-span-2">
              <input
                className={inputClassName()}
                value={form.offer_name}
                onChange={(e) => setField({ offer_name: e.target.value })}
                placeholder="e.g. ₹349 Combo"
                required
              />
            </FormField>
            <FormField label="Combo price (₹)" required hint="Final total the customer pays for this whole pack">
              <input
                type="text"
                inputMode="decimal"
                className={inputClassName()}
                value={form.combo_price}
                onChange={(e) => setField({ combo_price: sanitizeDecimalInput(e.target.value) })}
                placeholder="349"
                required
              />
            </FormField>
            <FormField label="Valid from">
              <input
                type="date"
                className="input input-premium"
                value={form.valid_from}
                onChange={(e) => setField({ valid_from: e.target.value })}
              />
            </FormField>
            <FormField label="Valid to">
              <input
                type="date"
                className="input input-premium"
                value={form.valid_to}
                onChange={(e) => setField({ valid_to: e.target.value })}
              />
            </FormField>
          </div>

          <p className="form-section-label">Combo items</p>
          <p className="text-xs text-slate-500 mb-3">
            Fixed products and quantities in this pack. Selecting this offer on a pre-booking will
            auto-fill these lines.
          </p>

          <div className="invoice-form-table-scroll mb-4">
            <table className="line-items-table">
              <thead>
                <tr>
                  <th className="col-sn text-center">#</th>
                  <th className="col-item">Product</th>
                  <th className="col-qty text-right">Qty</th>
                  <th className="col-rate text-right whitespace-nowrap">Retail</th>
                  <th className="col-amount text-right whitespace-nowrap">Line total</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => {
                  const product = item.product_id
                    ? products.find((p) => String(p.id) === String(item.product_id))
                    : null;
                  const qty = Number(item.quantity) || 0;
                  const missingRetail = Boolean(product && !hasRetailPrice(product));
                  const unit = listedRetailPrice(product);
                  const line = product && !missingRetail ? money(unit * qty) : null;
                  return (
                    <tr key={index}>
                      <td className="col-sn text-center tabular-nums text-slate-500 font-medium">
                        {index + 1}
                      </td>
                      <td className="col-item">
                        <select
                          className={`line-item-row-input ${missingRetail ? 'input-error' : ''}`}
                          value={item.product_id}
                          onChange={(e) => updateRow(index, 'product_id', e.target.value)}
                          title={product ? formatProductOptionLabel(product) : 'Select product'}
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {formatProductOptionLabel(p, { stock: p.stock_quantity })}
                            </option>
                          ))}
                        </select>
                        {missingRetail ? (
                          <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                            Set a retail price for this product first
                          </p>
                        ) : null}
                      </td>
                      <td className="col-qty">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          className="line-item-qty-input"
                          value={item.quantity}
                          onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="col-rate">
                        <span
                          className={`line-item-cell-amount ${
                            missingRetail ? 'text-red-600 dark:text-red-400' : ''
                          }`}
                        >
                          {product ? (missingRetail ? '—' : formatInrAmount(unit)) : '—'}
                        </span>
                      </td>
                      <td className="col-amount">
                        <span className="line-item-cell-amount">
                          {line != null ? formatInrAmount(line) : '—'}
                        </span>
                      </td>
                      <td className="col-actions">
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="btn-icon text-red-500 hover:bg-red-50"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addRow} className="link-action text-sm mb-6">
            <Plus className="h-4 w-4" />
            Add product to combo
          </button>

          <div
            className={`invoice-summary-box lg:ml-auto min-w-[280px] mb-6 ${
              isLossVsRetail ? 'border-red-300 dark:border-red-800' : ''
            }`}
          >
            <p className="form-section-label mb-3">Live preview</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Normal retail total</span>
                <span className="tabular-nums font-medium">{formatInrAmount(retailTotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Combo price</span>
                <span className="tabular-nums font-semibold">{formatInrAmount(comboPrice)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-500">vs retail</span>
                <span
                  className={`tabular-nums font-semibold ${
                    vsRetail < 0
                      ? 'text-red-600 dark:text-red-400'
                      : vsRetail > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : ''
                  }`}
                >
                  {vsRetail > 0 ? '+' : ''}
                  {formatInrAmount(vsRetail)}
                </span>
              </div>
            </div>
            {isLossVsRetail ? (
              <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                This combo sells below the normal retail total. Discount vs retail is{' '}
                {formatInrAmount(Math.abs(vsRetail))} per pack.
              </p>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mb-4 text-sm font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <FormActions
            submitLabel={editing ? 'Update offer' : 'Save offer'}
            onCancel={onCancel}
            submitDisabled={saving}
          />
        </form>
      </FormShell>
    </div>
  );
}
