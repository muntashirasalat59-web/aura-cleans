import { Plus, Trash2 } from 'lucide-react';
import { formatProductOptionLabel } from '../../utils/productDisplay';
import { formatInrAmount } from '../../utils/invoiceLineItems';
import { lineSubtotal } from '../../utils/invoiceGst';

export function emptyProductLine() {
  return { product_id: '', quantity: '1', rate: '' };
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Same line-items-table UI as Create Invoice, without GST/HSN (pre-bookings / simple orders). */
export default function ProductLineItemsEditor({
  items = [],
  products = [],
  onChange,
  addLabel = 'Add another product',
  rateFrom = 'price',
  getOptionLabel,
}) {
  const rows = items.length > 0 ? items : [emptyProductLine()];

  function setRows(next) {
    onChange(next);
  }

  function addRow() {
    setRows([...rows, emptyProductLine()]);
  }

  function removeRow(index) {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  }

  function updateRow(index, field, value) {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    if (field === 'product_id') {
      const product = products.find((p) => String(p.id) === String(value));
      if (product) {
        const catalog = product[rateFrom] ?? product.price ?? 0;
        next[index] = { ...next[index], rate: String(catalog) };
      } else {
        next[index] = { ...next[index], rate: '' };
      }
    }
    setRows(next);
  }

  const total = rows.reduce((sum, row) => sum + lineSubtotal(row.quantity, row.rate), 0);

  return (
    <div>
      <div className="invoice-form-table-scroll mb-4">
        <table className="line-items-table">
          <thead>
            <tr>
              <th className="col-sn text-center">#</th>
              <th className="col-item">Product</th>
              <th className="col-qty text-right">Qty</th>
              <th className="col-rate text-right whitespace-nowrap">Rate (₹)</th>
              <th className="col-amount text-right whitespace-nowrap">Amount</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((item, index) => {
              const product = item.product_id
                ? products.find((p) => String(p.id) === String(item.product_id))
                : null;
              const amount = lineSubtotal(item.quantity, item.rate);
              return (
                <tr key={index}>
                  <td className="col-sn text-center tabular-nums text-slate-500 font-medium">
                    {index + 1}
                  </td>
                  <td className="col-item">
                    <select
                      className="line-item-row-input"
                      value={item.product_id}
                      onChange={(e) => updateRow(index, 'product_id', e.target.value)}
                      title={product ? formatProductOptionLabel(product) : 'Select product'}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {getOptionLabel
                            ? getOptionLabel(p)
                            : formatProductOptionLabel(p, { stock: p.stock_quantity })}
                        </option>
                      ))}
                    </select>
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
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="line-item-rate-input"
                      value={item.rate}
                      onChange={(e) => updateRow(index, 'rate', e.target.value)}
                    />
                  </td>
                  <td className="col-amount">
                    <span className="line-item-cell-amount">
                      {item.product_id ? formatInrAmount(amount) : '—'}
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
        {addLabel}
      </button>
      <div className="invoice-summary-box lg:ml-auto min-w-[280px] mb-6">
        <div className="invoice-summary-row invoice-summary-total">
          <span>Total amount</span>
          <span className="tabular-nums">{formatInrAmount(money(total))}</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Sum of all line amounts (rate × quantity).</p>
      </div>
    </div>
  );
}
