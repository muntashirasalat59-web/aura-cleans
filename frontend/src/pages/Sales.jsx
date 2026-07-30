import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Plus, Trash2, X, Eye, FileDown, FileText, Pencil } from 'lucide-react';
import { salesAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import InvoiceLetterPreview from '../components/forms/InvoiceLetterPreview';
import GstTaxSummary from '../components/invoice/GstTaxSummary';
import InvoiceLineItemsTable from '../components/invoice/InvoiceLineItemsTable';
import { computeGstTotals } from '../utils/invoiceGst';
import { formatInrAmount, formatLineGstDisplay, enrichInvoiceLine } from '../utils/invoiceLineItems';
import { formatProductNameWithSize, formatProductOptionLabel } from '../utils/productDisplay';
import {
  SALES_PARTY_TYPES,
  SALES_QUICK_ADD_TYPES,
} from '../utils/partyTypes';
import { refreshPartiesAfterCreate } from '../utils/partyList';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState('');
  const [editStockBaseline, setEditStockBaseline] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [form, setForm] = useState({
    party_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    gst_percent: 18,
    items: [{ product_id: '', quantity: 1, rate: 0 }],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [salesData, partiesData, productsData] = await Promise.all([
        salesAPI.getAll(),
        partiesAPI.getAll({ activeOnly: true }),
        productsAPI.getAll({ activeOnly: true }),
      ]);
      setSales(salesData);
      setParties(partiesData);
      setProducts(productsData);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function addItemRow() {
    setForm({
      ...form,
      items: [...form.items, { product_id: '', quantity: 1, rate: 0 }],
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
      const product = products.find((p) => p.id === parseInt(value, 10));
      if (product) {
        newItems[index].rate = product.price;
      }
    }

    setForm({ ...form, items: newItems });
  }

  const gstTotals = computeGstTotals(form.items, form.gst_percent);
  const calculateSubtotal = () => gstTotals.subtotal;
  const calculateGST = () => gstTotals.gstAmount;
  const calculateTotal = () => gstTotals.total;

  function getSelectedParty() {
    return parties.find((p) => p.id === parseInt(form.party_id, 10));
  }

  function resetForm() {
    setEditingId(null);
    setEditingInvoiceNumber('');
    setEditStockBaseline({});
    setForm({
      party_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      gst_percent: 18,
      items: [{ product_id: '', quantity: 1, rate: 0 }],
    });
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  /** While editing, qty on this invoice is still "reserved" until save — show effective stock in dropdown */
  function getDisplayStock(productId) {
    const id = parseInt(productId, 10);
    if (!id) return 0;
    const product = products.find((p) => p.id === id);
    if (!product) return 0;
    const restored = editStockBaseline[id] || 0;
    return Number(product.stock_quantity) + restored;
  }

  async function ensurePartyInList(partyId) {
    if (!partyId || parties.some((p) => String(p.id) === String(partyId))) return;
    try {
      const party = await partiesAPI.getOne(partyId);
      setParties((prev) => [...prev, party]);
    } catch {
      /* party may have been hard-deleted */
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
          'Customer saved, but the list could not reload. Pick them from the dropdown or refresh the page.'
      );
    }
  }

  async function ensureProductsInList(productIds) {
    const missing = productIds.filter((id) => id && !products.some((p) => p.id === id));
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

  async function openEditInvoice(id) {
    try {
      const data = await salesAPI.getOne(id);
      await ensurePartyInList(data.party_id);
      await ensureProductsInList(data.items.map((item) => item.product_id));
      const baseline = {};
      for (const item of data.items) {
        baseline[item.product_id] = (baseline[item.product_id] || 0) + item.quantity;
      }
      setEditingId(data.id);
      setEditingInvoiceNumber(data.invoice_number);
      setEditStockBaseline(baseline);
      setForm({
        party_id: String(data.party_id),
        invoice_date: data.invoice_date,
        gst_percent: data.gst_percent,
        items: data.items.map((item) => ({
          product_id: String(item.product_id),
          quantity: item.quantity,
          rate: item.rate,
        })),
      });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alert('Error loading invoice: ' + err.message);
    }
  }

  function getPreviewLineItems() {
    return form.items
      .filter((item) => item.product_id)
      .map((item) => {
        const product = products.find((p) => p.id === parseInt(item.product_id, 10));
        return {
          name: product?.name || 'Product',
          unit_size: product?.unit_size,
          unit_type: product?.unit_type,
          hsn_sac: product?.hsn_sac || '',
          quantity: item.quantity,
          rate: item.rate,
        };
      });
  }

  function getProductHsn(productId) {
    const product = products.find((p) => p.id === parseInt(productId, 10));
    return product?.hsn_sac?.trim() || '—';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.party_id) {
      alert('Please select a customer / party.');
      return;
    }

    const validItems = form.items.filter((item) => item.product_id);
    if (validItems.length === 0) {
      alert('Add at least one product');
      return;
    }

    for (const item of validItems) {
      const productId = parseInt(item.product_id, 10);
      const product = products.find((p) => p.id === productId);
      const qty = parseInt(item.quantity, 10);
      const available = getDisplayStock(productId);
      if (qty > available) {
        const name = product?.name || 'Product';
        alert(`Insufficient stock for ${name}. Available: ${available}, requested: ${qty}.`);
        return;
      }
    }

    try {
      const payload = {
        party_id: parseInt(form.party_id),
        invoice_date: form.invoice_date,
        gst_percent: parseFloat(form.gst_percent),
        items: validItems.map((item) => ({
          product_id: parseInt(item.product_id),
          quantity: parseInt(item.quantity),
          rate: parseFloat(item.rate),
        })),
      };

      if (editingId) {
        await salesAPI.update(editingId, payload);
        alert('Invoice updated! Stock and totals recalculated.');
      } else {
        await salesAPI.create(payload);
        alert('Invoice created! Stock updated automatically.');
      }

      closeForm();
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function viewInvoiceDetails(id) {
    try {
      const data = await salesAPI.getOne(id);
      setViewInvoice(data);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function downloadPDF(id) {
    try {
      await salesAPI.downloadPDF(id);
    } catch (err) {
      alert('Error downloading PDF: ' + err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sales & invoices"
        description="Create GST invoices, track revenue, and download PDFs."
        action={
          <button
            onClick={() => (showForm ? closeForm() : openCreateForm())}
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
                New invoice
              </>
            )}
          </button>
        }
      />

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={FileText}
            title={editingId ? 'Edit invoice' : 'Invoice builder'}
            subtitle={
              editingId
                ? `Update line items, party, or tax — ${editingInvoiceNumber}. Stock adjusts on save.`
                : 'Create a GST tax invoice — preview before you save.'
            }
          >
            <form onSubmit={handleSubmit}>
              <p className="form-section-label">Invoice header</p>
              <div className="form-grid mb-8">
                <FormField label="Invoice date" required>
                  <input
                    type="date"
                    className="input input-premium"
                    value={form.invoice_date}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="GST rate (%)">
                  <input
                    type="number"
                    className="input input-premium"
                    value={form.gst_percent}
                    onChange={(e) => setForm({ ...form, gst_percent: e.target.value })}
                  />
                </FormField>
                <FormField label="Invoice no.">
                  <input
                    className="input input-premium bg-slate-50"
                    value={editingId ? editingInvoiceNumber : 'Auto-generated on save'}
                    readOnly
                    disabled
                  />
                </FormField>
              </div>

              <p className="form-section-label">Bill to — party</p>
              <div className="form-grid mb-8">
                <PartySelectField
                  label="Customer / party"
                  required
                  className="md:col-span-2"
                  value={form.party_id}
                  onChange={(partyId) => setForm((prev) => ({ ...prev, party_id: partyId }))}
                  parties={parties}
                  onPartyCreated={handlePartyCreated}
                  defaultTypes={SALES_PARTY_TYPES}
                  showAllLabel="Show all party types (including manufacturers)"
                  quickAddLabel="New Customer"
                  quickAddTitle="New customer"
                  quickAddDefaultType="retailer"
                  quickAddAllowedTypes={SALES_QUICK_ADD_TYPES}
                  placeholder="Search customer…"
                />
              </div>

              <p className="form-section-label">Product line items</p>
              <div className="overflow-x-auto mb-2">
                <table className="line-items-table min-w-[1080px]">
                  <thead>
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="min-w-[200px]">Item Name</th>
                      <th className="min-w-[88px] whitespace-nowrap">HSN/SAC</th>
                      <th className="col-qty text-right">Qty</th>
                      <th className="col-rate text-right whitespace-nowrap">Price/Unit (₹)</th>
                      <th className="min-w-[120px] text-right whitespace-nowrap">GST</th>
                      <th className="min-w-[130px] text-right whitespace-nowrap">Amount (excl. GST)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => {
                      const product = item.product_id
                        ? products.find((p) => p.id === parseInt(item.product_id, 10))
                        : null;
                      const line = product
                        ? enrichInvoiceLine(
                            {
                              quantity: item.quantity,
                              rate: item.rate,
                              name: product.name,
                              unit_size: product.unit_size,
                              unit_type: product.unit_type,
                              hsn_sac: getProductHsn(item.product_id),
                            },
                            index,
                            form.gst_percent
                          )
                        : null;
                      return (
                        <tr key={index}>
                          <td className="text-center tabular-nums text-slate-500 font-medium">{index + 1}</td>
                          <td>
                            {product && (
                              <p className="font-medium text-slate-900 mb-1.5">
                                {formatProductNameWithSize(product, 'inline')}
                              </p>
                            )}
                            <select
                              className="line-item-row-input min-w-[180px]"
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {formatProductOptionLabel(p, { stock: getDisplayStock(p.id) })}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="font-mono text-xs text-slate-600 whitespace-nowrap">
                            {item.product_id ? getProductHsn(item.product_id) : '—'}
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
                          <td className="tabular-nums text-xs text-slate-700 whitespace-nowrap">
                            {line ? formatLineGstDisplay(line) : '—'}
                          </td>
                          <td className="font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                            {line ? formatInrAmount(line.taxable) : '—'}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 mb-4">
                Line amounts exclude GST. GST updates automatically when qty, rate, or invoice GST % changes.
              </p>

              <button type="button" onClick={addItemRow} className="link-action text-sm mb-8">
                <Plus className="h-4 w-4" />
                Add line item
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-2">
                <div className="hidden lg:block">
                  <p className="form-section-label mb-3">Live preview</p>
                  <InvoiceLetterPreview
                    compact
                    invoiceNumber={editingId ? editingInvoiceNumber : 'INV-DRAFT'}
                    invoiceDate={form.invoice_date}
                    party={getSelectedParty()}
                    items={getPreviewLineItems()}
                    gstPercent={form.gst_percent}
                    subtotal={calculateSubtotal()}
                    gstAmount={calculateGST()}
                    total={calculateTotal()}
                  />
                </div>
                <div className="invoice-summary-box lg:max-w-none">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Tax summary</p>
                  <GstTaxSummary
                    gstPercent={form.gst_percent}
                    gstAmount={calculateGST()}
                    subtotal={calculateSubtotal()}
                    total={calculateTotal()}
                  />
                </div>
              </div>

              <FormActions
                submitLabel={editingId ? 'Update invoice' : 'Create invoice'}
                onCancel={closeForm}
                extra={
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg hidden lg:inline-flex"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg lg:hidden"
                      onClick={() => setShowPreview(true)}
                    >
                      <Eye className="h-4 w-4" />
                      Preview invoice
                    </button>
                  </>
                }
              />
            </form>
          </FormShell>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-slate-100 surface-light w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Preview invoice</h3>
              <button type="button" className="btn-icon" onClick={() => setShowPreview(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <InvoiceLetterPreview
              invoiceNumber={editingId ? editingInvoiceNumber : 'INV-DRAFT'}
              invoiceDate={form.invoice_date}
              party={getSelectedParty()}
              items={getPreviewLineItems()}
              gstPercent={form.gst_percent}
              subtotal={calculateSubtotal()}
              gstAmount={calculateGST()}
              total={calculateTotal()}
            />
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white surface-light rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{viewInvoice.invoice_number}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{viewInvoice.invoice_date}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewInvoice(null)}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <p className="font-semibold text-slate-900">{viewInvoice.party_name}</p>
                {viewInvoice.contact && <p className="text-sm text-slate-600 mt-1">{viewInvoice.contact}</p>}
                {viewInvoice.gst_number && (
                  <p className="text-sm text-slate-500 mt-0.5">GST: {viewInvoice.gst_number}</p>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-100 mb-5">
                <InvoiceLineItemsTable
                  items={viewInvoice.items.map((item) => ({
                    product_name: item.product_name,
                    unit_size: item.unit_size,
                    unit_type: item.unit_type,
                    hsn_sac: item.hsn_sac,
                    quantity: item.quantity,
                    rate: item.rate,
                  }))}
                  gstPercent={viewInvoice.gst_percent}
                  className="invoice-lines w-full text-sm"
                  emptyMessage="No line items"
                />
              </div>

              <div className="invoice-summary-box mb-6 text-sm">
                <GstTaxSummary
                  gstPercent={viewInvoice.gst_percent}
                  gstAmount={viewInvoice.gst_amount}
                  subtotal={viewInvoice.subtotal}
                  total={viewInvoice.total_amount}
                />
              </div>

              <button onClick={() => downloadPDF(viewInvoice.id)} className="btn btn-primary w-full">
                <FileDown className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="card-section-title mb-0">Invoice history</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Party</th>
                <th>Subtotal</th>
                <th>GST</th>
                <th>Total</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No invoices yet. Create your first invoice above.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-medium text-slate-900">{sale.invoice_number}</td>
                    <td>{sale.invoice_date}</td>
                    <td>{sale.party_name}</td>
                    <td>₹{sale.subtotal.toLocaleString('en-IN')}</td>
                    <td>₹{sale.gst_amount.toLocaleString('en-IN')}</td>
                    <td className="font-semibold text-emerald-600">₹{sale.total_amount.toLocaleString('en-IN')}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => openEditInvoice(sale.id)} className="link-action">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button type="button" onClick={() => viewInvoiceDetails(sale.id)} className="link-action">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button type="button" onClick={() => downloadPDF(sale.id)} className="link-action">
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </div>
                    </td>
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
