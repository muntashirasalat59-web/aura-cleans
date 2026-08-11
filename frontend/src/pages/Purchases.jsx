import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Plus, Trash2, X, ShoppingCart, Banknote, Pencil } from 'lucide-react';
import { purchasesAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import EmptyState from '../components/EmptyState';
import { PURCHASE_EXPORT_COLUMNS, mapPurchaseExportRow } from '../config/exportColumns';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import PurchasePaymentFields from '../components/forms/PurchasePaymentFields';
import MarkPaidModal from '../components/invoice/MarkPaidModal';
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
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync } from '../lib/dataSync';
import {
  emptyPaymentDetails,
  paymentToPayload,
  paymentFromSale,
  formatDisplayDate,
} from '../utils/invoicePayment';
import { enrichPaymentFields, paymentStatus, balanceDue } from '../utils/invoiceReceivables';

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

const emptyPurchaseForm = () => ({
  party_id: '',
  purchase_date: new Date().toISOString().split('T')[0],
  notes: '',
  gst_percent: 18,
  items: [emptyItem()],
  payment: emptyPaymentDetails(),
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
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyPurchaseForm());
  const [markPaidTarget, setMarkPaidTarget] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useDataSync(['purchases', 'parties', 'products'], () => loadData(true));

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      const [purchasesData, partiesData, productsData] = await Promise.all([
        purchasesAPI.getAll(),
        partiesAPI.getAll({ activeOnly: true }),
        productsAPI.getAll({ activeOnly: true }),
      ]);
      setPurchases(purchasesData);
      setParties(partiesData);
      setProducts(productsData);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyPurchaseForm());
  }

  function openNewPurchase() {
    setEditingId(null);
    setForm(emptyPurchaseForm());
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function ensurePartyInList(partyId) {
    if (!partyId) return;
    if (parties.some((p) => String(p.id) === String(partyId))) return;
    try {
      const party = await partiesAPI.getOne(partyId);
      if (party) {
        setParties((prev) =>
          prev.some((p) => String(p.id) === String(party.id)) ? prev : [...prev, party]
        );
      }
    } catch {
      /* ignore — dropdown may still work after refresh */
    }
  }

  async function ensureProductsInList(productIds) {
    const missing = [...new Set(productIds.filter(Boolean))].filter(
      (id) => !products.some((p) => String(p.id) === String(id))
    );
    if (missing.length === 0) return;
    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          return await productsAPI.getOne(id);
        } catch {
          return null;
        }
      })
    );
    const valid = fetched.filter(Boolean);
    if (valid.length > 0) {
      setProducts((prev) => [...prev, ...valid]);
    }
  }

  async function openEditPurchase(id) {
    try {
      const data = await purchasesAPI.getOne(id);
      await ensurePartyInList(data.party_id);
      await ensureProductsInList((data.items || []).map((item) => item.product_id));
      setEditingId(data.id);
      setForm({
        party_id: String(data.party_id),
        purchase_date: data.purchase_date,
        notes: data.notes || '',
        gst_percent: data.gst_percent ?? 18,
        items:
          data.items?.length > 0
            ? data.items.map((item) => ({
                product_id: String(item.product_id),
                product_name: '',
                pack_size: '500 ML',
                fragrance: 'Unscented',
                custom_fragrance: '',
                quantity: item.quantity,
                rate: item.rate,
              }))
            : [emptyItem()],
        payment: paymentFromSale(data),
      });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Error loading purchase: ' + err.message);
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
      if (form.payment?.collection === 'pending' && !form.payment?.due_date) {
        alert('Please set a due date for pending supplier payment.');
        return;
      }

      const payload = {
        party_id: parseInt(form.party_id, 10),
        purchase_date: form.purchase_date,
        notes: form.notes,
        gst_percent: parseFloat(form.gst_percent) || 18,
        payment: paymentToPayload(form.payment),
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
      };

      if (editingId) {
        await purchasesAPI.update(editingId, payload);
        alert('Purchase updated! Stock, GST totals, and party balance recalculated.');
      } else {
        await purchasesAPI.create(payload);
        alert(
          'Purchase saved! Stock and party balance updated. New products appear in Products list.'
        );
      }

      closeForm();
      notifyDataSync('purchases');
      notifyDataSync('products');
      notifyDataSync('parties');
    } catch (err) {
      alert(err.message);
    }
  }

  function openMarkPaid(purchase) {
    const payment = enrichPaymentFields(purchase);
    setMarkPaidTarget({
      id: purchase.id,
      documentLabel: `purchase on ${purchase.purchase_date}`,
      partyName: purchase.party_name,
      amountDue: payment.balance_due,
    });
  }

  function closeMarkPaid() {
    if (markingPaid) return;
    setMarkPaidTarget(null);
  }

  async function confirmMarkPaid({ payment_date, payment_method }) {
    if (!markPaidTarget) return;
    try {
      setMarkingPaid(true);
      const updated = await purchasesAPI.markPaid(markPaidTarget.id, {
        payment_date,
        payment_method,
      });
      setPurchases((prev) =>
        prev.map((p) => (p.id === markPaidTarget.id ? { ...p, ...updated } : p))
      );
      setMarkPaidTarget(null);
      notifyDataSync('purchases');
      notifyDataSync('parties');
    } catch (err) {
      alert(err.message || 'Failed to mark purchase as paid.');
    } finally {
      setMarkingPaid(false);
    }
  }

  async function deletePurchase(id) {
    const purchase = purchases.find((p) => p.id === id);
    const label = purchase
      ? `purchase on ${purchase.purchase_date} from ${purchase.party_name}`
      : 'this purchase';

    if (
      !confirm(
        `Delete ${label}? This will subtract the purchased quantities from product stock.`
      )
    ) {
      return;
    }

    try {
      const result = await purchasesAPI.delete(id);
      alert(result.message || 'Purchase deleted.');
      if (editingId === id) closeForm();
      notifyDataSync('purchases');
      notifyDataSync('products');
      notifyDataSync('parties');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (loading && purchases.length === 0) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Record stock from suppliers — existing products gain stock; new products are created automatically."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ExportMenu
              filePrefix="purchases"
              successLabel="Purchases"
              columns={PURCHASE_EXPORT_COLUMNS}
              getRows={() =>
                purchases.map((p) =>
                  mapPurchaseExportRow(p, { paymentStatus, balanceDue })
                )
              }
            />
            <button
              onClick={() => (showForm ? closeForm() : openNewPurchase())}
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
          </div>
        }
      />

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={ShoppingCart}
            title={editingId ? 'Edit purchase' : 'New purchase'}
            subtitle={
              editingId
                ? 'Update supplier, line items, GST, or notes — stock and balances recalculate on save.'
                : 'Select existing products or add new ones — inventory and party ledger update on save.'
            }
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
                Existing products show name, pack size, and fragrance. New products need all three —
                each size/fragrance combo is a separate SKU with its own stock.
              </p>
              <div className="invoice-form-table-scroll mb-4">
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th className="col-item">Product</th>
                      <th className="col-qty text-right">Qty</th>
                      <th className="col-rate text-right whitespace-nowrap">Rate (₹)</th>
                      <th className="col-taxable text-right whitespace-nowrap">Taxable (₹)</th>
                      <th className="col-actions" />
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
                                  onChange={(e) =>
                                    updateItem(index, 'custom_fragrance', e.target.value)
                                  }
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
                        <td className="col-taxable">
                          <span className="line-item-cell-amount">
                            ₹{lineSubtotal(item.quantity, item.rate).toFixed(2)}
                          </span>
                        </td>
                        <td className="col-actions">
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

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
                <div className="invoice-summary-box lg:ml-auto min-w-[280px]">
                  <GstTaxSummary
                    gstPercent={form.gst_percent}
                    gstAmount={gstAmount}
                    subtotal={subtotal}
                    total={total}
                  />
                </div>
              </div>

              <PurchasePaymentFields
                payment={form.payment}
                onChange={(payment) => setForm((prev) => ({ ...prev, payment }))}
              />

              <FormActions
                submitLabel={editingId ? 'Update purchase' : 'Save purchase'}
                onCancel={closeForm}
              />
            </form>
          </FormShell>
        </div>
      )}
      <div className="table-wrap">
        <div className="table-wrap-header">
          <h3 className="card-section-title mb-0">Purchase history</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {purchases.length} record{purchases.length === 1 ? '' : 's'}
          </p>
        </div>
        {purchases.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchases yet"
            description="Record a stock purchase from a supplier to update inventory and balances."
            actionLabel="New purchase"
            onAction={openNewPurchase}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th className="col-num">Subtotal</th>
                  <th className="col-num">GST</th>
                  <th className="col-num">Total</th>
                  <th>Notes</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const status = purchase.payment_status || paymentStatus(purchase);
                  const due =
                    purchase.balance_due != null
                      ? Number(purchase.balance_due)
                      : balanceDue(purchase);
                  return (
                    <tr key={purchase.id}>
                      <td className="tabular-nums whitespace-nowrap">{purchase.purchase_date}</td>
                      <td>
                        <p className="list-primary">{purchase.party_name}</p>
                        {(status === 'pending' || status === 'partial' || due > 0) && (
                          <p className="list-secondary">
                            Due ₹{due.toLocaleString('en-IN')}
                            {purchase.payment_due_date
                              ? ` · by ${formatDisplayDate(purchase.payment_due_date)}`
                              : ''}
                            {status === 'partial' ? ' · partial' : ''}
                          </p>
                        )}
                      </td>
                      <td className="col-num">
                        ₹{Number(purchase.subtotal ?? purchase.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="col-num text-slate-600 dark:text-slate-400">
                        ₹{Number(purchase.gst_amount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="col-num font-semibold text-indigo-700 dark:text-indigo-300">
                        ₹{Number(purchase.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {purchase.notes || '—'}
                      </td>
                      <td className="text-right">
                        <div className="list-actions">
                          <button
                            type="button"
                            onClick={() => openEditPurchase(purchase.id)}
                            className="link-action"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Paid
                            </span>
                          ) : status === 'pending' || status === 'partial' ? (
                            <button
                              type="button"
                              onClick={() => openMarkPaid(purchase)}
                              className="link-action text-violet-700 hover:text-violet-600 dark:text-violet-300"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              Mark as paid
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deletePurchase(purchase.id)}
                            className="link-action-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MarkPaidModal
        open={Boolean(markPaidTarget)}
        documentLabel={markPaidTarget?.documentLabel}
        partyName={markPaidTarget?.partyName}
        amountDue={markPaidTarget?.amountDue}
        onClose={closeMarkPaid}
        onConfirm={confirmMarkPaid}
        confirming={markingPaid}
      />
    </div>
  );
}
