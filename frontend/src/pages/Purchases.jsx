import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Plus, Trash2, X, ShoppingCart } from 'lucide-react';
import { purchasesAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import GstTaxSummary from '../components/invoice/GstTaxSummary';
import { computeGstTotals, lineSubtotal } from '../utils/invoiceGst';
import { formatProductOptionLabel } from '../utils/productDisplay';
import {
  PACK_SIZE_OPTIONS,
  FRAGRANCE_OPTIONS,
  resolveFragranceValue,
} from '../utils/productCatalog';
import {
  PURCHASE_PARTY_TYPES,
  PURCHASE_QUICK_ADD_TYPES,
} from '../utils/partyTypes';
import { refreshPartiesAfterCreate } from '../utils/partyList';

const NEW_PRODUCT = '__new__';

const emptyItem = () => ({
  product_id: '',
  product_name: '',
  pack_size: '500 ML',
  fragrance: 'Unscented',
  custom_fragrance: '',
  quantity: 1,
  rate: 0,
});

function isNewProductRow(item) {
  return item.product_id === NEW_PRODUCT;
}

function isValidPurchaseItem(item) {
  if (isNewProductRow(item)) return Boolean(item.product_name?.trim());
  return Boolean(item.product_id);
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    party_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
    gst_percent: 18,
    items: [emptyItem()],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [purchasesData, partiesData, productsData] = await Promise.all([
        purchasesAPI.getAll(),
        partiesAPI.getAll({ activeOnly: true }),
        productsAPI.getAll({ activeOnly: true }),
      ]);
      setPurchases(purchasesData);
      setParties(partiesData);
      setProducts(productsData);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePartyCreated(party) {
    try {
      const { party: saved, parties: fresh } = await refreshPartiesAfterCreate(
        partiesAPI,
        party
      );
      flushSync(() => {
        setParties(fresh);
      });
      return saved;
    } catch (err) {
      flushSync(() => {
        setParties((prev) =>
          prev.some((p) => String(p.id) === String(party?.id)) ? prev : [...prev, party]
        );
      });
      throw new Error(
        err.message ||
          'Supplier saved, but the list could not reload. Pick them from the dropdown or refresh the page.'
      );
    }
  }

  function addItemRow() {
    setForm({
      ...form,
      items: [...form.items, emptyItem()],
    });
  }

  function removeItemRow(index) {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  }

  function updateItem(index, field, value) {
    const newItems = [...form.items];
    newItems[index][field] = value;

    if (field === 'product_id') {
      if (value === NEW_PRODUCT) {
        newItems[index].product_name = '';
        newItems[index].pack_size = '500 ML';
        newItems[index].fragrance = 'Unscented';
        newItems[index].custom_fragrance = '';
      } else {
        newItems[index].product_name = '';
        const product = products.find((p) => p.id === parseInt(value, 10));
        if (product) {
          newItems[index].rate = product.cost_price ?? product.price ?? 0;
        }
      }
    }

    if (field === 'fragrance' && value !== 'Other') {
      newItems[index].custom_fragrance = '';
    }

    setForm({ ...form, items: newItems });
  }

  const { subtotal, gstAmount, total } = computeGstTotals(form.items, form.gst_percent);

  async function handleSubmit(e) {
    e.preventDefault();

    const validItems = form.items.filter(isValidPurchaseItem);
    if (validItems.length === 0) {
      alert('Add at least one product (select existing or enter a new product name)');
      return;
    }

    for (const item of validItems) {
      if (isNewProductRow(item)) {
        const fragrance = resolveFragranceValue(item.fragrance, item.custom_fragrance);
        if (!fragrance) {
          alert('Please enter a custom fragrance name or choose a preset fragrance.');
          return;
        }
        if (!item.product_name?.trim()) {
          alert('Enter a product name for each new product line.');
          return;
        }
      }
    }

    try {
      await purchasesAPI.create({
        party_id: parseInt(form.party_id, 10),
        purchase_date: form.purchase_date,
        notes: form.notes,
        gst_percent: parseFloat(form.gst_percent) || 18,
        items: validItems.map((item) => {
          if (isNewProductRow(item)) {
            return {
              product_name: item.product_name.trim(),
              pack_size: item.pack_size,
              fragrance: resolveFragranceValue(item.fragrance, item.custom_fragrance),
              quantity: parseInt(item.quantity, 10),
              rate: parseFloat(item.rate),
            };
          }
          return {
            product_id: parseInt(item.product_id, 10),
            quantity: parseInt(item.quantity, 10),
            rate: parseFloat(item.rate),
          };
        }),
      });

      setShowForm(false);
      setForm({
        party_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        notes: '',
        gst_percent: 18,
        items: [emptyItem()],
      });
      await loadData();
      alert('Purchase saved! Stock and party balance updated. New products appear in Products list.');
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Record stock from suppliers — existing products gain stock; new products are created automatically."
        action={
          <button
            onClick={() => setShowForm(!showForm)}
            className={`btn w-full sm:w-auto ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          >
            {showForm ? (
              <>
                <X className="h-4 w-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                New purchase
              </>
            )}
          </button>
        }
      />

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={ShoppingCart}
            title="New purchase"
            subtitle="Select existing products or add new ones — inventory and party ledger update on save."
          >
            <form onSubmit={handleSubmit}>
              <p className="form-section-label">Supplier details</p>
              <div className="form-grid mb-8">
                <PartySelectField
                  label="Supplier (party)"
                  required
                  value={form.party_id}
                  onChange={(partyId) => setForm((prev) => ({ ...prev, party_id: partyId }))}
                  parties={parties}
                  onPartyCreated={handlePartyCreated}
                  defaultTypes={PURCHASE_PARTY_TYPES}
                  showAllLabel="Show all party types (including retailers)"
                  quickAddLabel="New Supplier"
                  quickAddTitle="New supplier"
                  quickAddDefaultType="manufacturer"
                  quickAddAllowedTypes={PURCHASE_QUICK_ADD_TYPES}
                  placeholder="Search supplier…"
                />
                <FormField label="Purchase date" required>
                  <input
                    type="date"
                    className="input input-premium"
                    value={form.purchase_date}
                    onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Notes">
                  <input
                    className="input input-premium"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="GST rate (%)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input input-premium"
                    value={form.gst_percent}
                    onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
                  />
                </FormField>
              </div>

              <p className="form-section-label">Line items</p>
              <p className="text-xs text-slate-500 mb-3">
                Existing products show name, pack size, and fragrance. New products need all three — each size/fragrance combo is a separate SKU with its own stock.
              </p>
              <div className="overflow-x-auto mb-4">
                <table className="line-items-table min-w-[880px]">
                  <thead>
                    <tr>
                      <th className="min-w-[280px]">Product</th>
                      <th className="col-qty text-right">Qty</th>
                      <th className="col-rate text-right whitespace-nowrap">Rate (₹)</th>
                      <th className="col-taxable text-right whitespace-nowrap">Taxable (₹)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <select
                            className="line-item-row-input mb-2"
                            value={item.product_id}
                            onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {formatProductOptionLabel(p, { stock: p.stock_quantity })}
                              </option>
                            ))}
                            <option value={NEW_PRODUCT}>+ Add new product…</option>
                          </select>
                          {isNewProductRow(item) && (
                            <div className="space-y-2 mt-2 p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
                              <input
                                className="line-item-row-input"
                                placeholder="Product name (e.g. Hand Wash)"
                                value={item.product_name}
                                onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                                required
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select
                                  className="line-item-row-input text-sm"
                                  value={item.pack_size}
                                  onChange={(e) => updateItem(index, 'pack_size', e.target.value)}
                                >
                                  {PACK_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>
                                      {size}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="line-item-row-input text-sm"
                                  value={item.fragrance}
                                  onChange={(e) => updateItem(index, 'fragrance', e.target.value)}
                                >
                                  {FRAGRANCE_OPTIONS.map((f) => (
                                    <option key={f} value={f}>
                                      {f}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {item.fragrance === 'Other' && (
                                <input
                                  className="line-item-row-input text-sm"
                                  placeholder="Custom fragrance name"
                                  value={item.custom_fragrance}
                                  onChange={(e) => updateItem(index, 'custom_fragrance', e.target.value)}
                                  required
                                />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="col-qty">
                          <input
                            type="number"
                            min="1"
                            className="line-item-qty-input"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          />
                        </td>
                        <td className="col-rate">
                          <input
                            type="number"
                            step="0.01"
                            className="line-item-rate-input"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', e.target.value)}
                          />
                        </td>
                        <td className="col-taxable font-semibold tabular-nums text-slate-900 text-right whitespace-nowrap">
                          ₹{lineSubtotal(item.quantity, item.rate).toFixed(2)}
                        </td>
                        <td>
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(index)}
                              className="btn-icon text-red-500 hover:bg-red-50"
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button" onClick={addItemRow} className="link-action text-sm mb-8">
                <Plus className="h-4 w-4" />
                Add line item
              </button>

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div className="invoice-summary-box lg:ml-auto min-w-[280px]">
                  <GstTaxSummary
                    gstPercent={form.gst_percent}
                    gstAmount={gstAmount}
                    subtotal={subtotal}
                    total={total}
                  />
                </div>
              </div>

              <FormActions submitLabel="Save purchase" onCancel={() => setShowForm(false)} />
            </form>
          </FormShell>
        </div>
      )}
      <div className="table-wrap">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="card-section-title mb-0">Purchase history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Subtotal</th>
                <th>GST</th>
                <th>Total</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    No purchases recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.purchase_date}</td>
                    <td className="font-medium text-slate-900">{purchase.party_name}</td>
                    <td className="tabular-nums">
                      ₹{Number(purchase.subtotal ?? purchase.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="tabular-nums text-slate-600">
                      ₹{Number(purchase.gst_amount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="font-semibold text-indigo-700 tabular-nums">
                      ₹{Number(purchase.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="text-slate-500 max-w-xs truncate">{purchase.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
