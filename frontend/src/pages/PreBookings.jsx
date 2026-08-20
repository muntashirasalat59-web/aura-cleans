import { useState, useEffect, useMemo } from 'react';
import { Plus, X, CalendarClock, Check, Ban } from 'lucide-react';
import { preBookingsAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import SegmentedControl from '../components/forms/SegmentedControl';
import { formatDisplayDate } from '../utils/invoicePayment';
import { formatInrAmount } from '../utils/invoiceLineItems';
import { formatProductOptionLabel, formatProductNameWithSize } from '../utils/productDisplay';
import { SALES_PARTY_TYPES, SALES_QUICK_ADD_TYPES } from '../utils/partyTypes';
import { refreshPartiesAfterCreate } from '../utils/partyList';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync } from '../lib/dataSync';
import {
  todayISO,
  bookingDisplayStatus,
  bookingStatusLabel,
  bookingStatusBadgeClass,
} from '../utils/preBookings';

const emptyForm = () => ({
  party_id: '',
  product_id: '',
  quantity: '1',
  rate: '',
  delivery_date: todayISO(),
  notes: '',
});

export default function PreBookings() {
  const [rows, setRows] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [statusFilter, setStatusFilter] = useState('upcoming');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadLookups(true);
    loadBookings();
  }, []);

  useDataSync('pre_bookings', () => loadBookings(true));
  useDataSync('parties', () => loadLookups(true));
  useDataSync('products', () => loadLookups(true));

  async function loadLookups(silent = false) {
    try {
      const [partyRows, productRows] = await Promise.all([
        partiesAPI.getAll({ activeOnly: true }),
        productsAPI.getAll({ activeOnly: true }),
      ]);
      setParties(partyRows);
      setProducts(productRows);
    } catch (err) {
      if (!silent) alert('Error loading parties/products: ' + err.message);
    }
  }

  async function loadBookings(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await preBookingsAPI.getAll();
      setRows(data || []);
    } catch (err) {
      if (!silent) alert('Error loading pre-bookings: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handlePartyCreated(party) {
    const { party: saved, parties: fresh } = await refreshPartiesAfterCreate(partiesAPI, party);
    setParties(fresh);
    return saved;
  }

  function openCreateForm() {
    setForm(emptyForm());
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm());
  }

  function applyProduct(productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    setForm((prev) => ({
      ...prev,
      product_id: productId,
      rate: product ? String(product.price ?? '') : '',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.party_id) {
      alert('Party is required');
      return;
    }
    if (!form.product_id) {
      alert('Product is required');
      return;
    }
    const quantity = Number(form.quantity);
    const rate = Number(form.rate);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }
    if (form.rate === '' || !Number.isFinite(rate) || rate < 0) {
      alert('Rate is required');
      return;
    }
    try {
      await preBookingsAPI.create({
        party_id: form.party_id,
        product_id: form.product_id,
        quantity,
        rate,
        delivery_date: form.delivery_date,
        notes: form.notes.trim(),
      });
      closeForm();
      notifyDataSync('pre_bookings');
      await loadBookings(true);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function markDelivered(id) {
    if (!confirm('Mark this pre-booking as delivered?')) return;
    try {
      setBusyId(id);
      await preBookingsAPI.markDelivered(id);
      notifyDataSync('pre_bookings');
      await loadBookings(true);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(id) {
    if (!confirm('Cancel this pre-booking?')) return;
    try {
      setBusyId(id);
      await preBookingsAPI.cancel(id);
      notifyDataSync('pre_bookings');
      await loadBookings(true);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    return (rows || []).filter((row) => {
      if (statusFilter === 'all') return true;
      return (row.status || 'upcoming') === statusFilter;
    });
  }, [rows, statusFilter]);

  const formTotal = useMemo(() => {
    const qty = Number(form.quantity);
    const rate = Number(form.rate);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) return 0;
    return Math.round(qty * rate * 100) / 100;
  }, [form.quantity, form.rate]);

  if (loading && rows.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-bookings"
        description="Record future orders when stock is short — a simple reminder list, not an invoice."
        action={
          <button
            type="button"
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
                New Pre-booking
              </>
            )}
          </button>
        }
      />

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={CalendarClock}
            title="New pre-booking"
            subtitle="Party, product, quantity, rate, and the date you promised to deliver."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <PartySelectField
                label="Party"
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
              <FormField label="Product" required>
                <select
                  className="input input-premium"
                  value={form.product_id}
                  onChange={(e) => applyProduct(e.target.value)}
                  required
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatProductOptionLabel(p, { stock: p.stock_quantity })}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Quantity" required>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  className="input input-premium"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Delivery date" required>
                <input
                  type="date"
                  className="input input-premium"
                  value={form.delivery_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, delivery_date: e.target.value }))}
                  required
                />
              </FormField>
              <FormField
                label="Rate (₹ / unit)"
                required
                hint="Filled from the product price — change it if you negotiated."
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-premium"
                  value={form.rate}
                  onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Total amount" hint="Rate × quantity">
                <input
                  className="input input-premium bg-slate-50 dark:bg-slate-800/60"
                  value={formatInrAmount(formTotal)}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </FormField>
              <FormField label="Notes (optional)" className="md:col-span-2 lg:col-span-3">
                <textarea
                  className="input input-premium min-h-[88px] resize-y"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Colour, size, reminder for the warehouse…"
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions submitLabel="Save pre-booking" onCancel={closeForm} />
              </div>
            </form>
          </FormShell>
        </div>
      )}

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
        ]}
      />

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Party</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Delivery date</th>
                <th>Status</th>
                <th>Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? 'No pre-bookings yet. Add one when a customer orders for a later date.'
                      : 'No data in this filter.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const display = bookingDisplayStatus(row);
                  const upcoming = (row.status || 'upcoming') === 'upcoming';
                  return (
                    <tr key={row.id}>
                      <td className="tabular-nums text-slate-700 whitespace-nowrap">
                        {formatDisplayDate(row.booking_date)}
                      </td>
                      <td className="font-medium text-slate-900 max-w-[180px] truncate">
                        {row.party_name || '—'}
                      </td>
                      <td className="max-w-[220px] truncate">
                        {row.product_name || formatProductNameWithSize(row.products) || '—'}
                      </td>
                      <td className="tabular-nums">{Number(row.quantity).toLocaleString('en-IN')}</td>
                      <td className="tabular-nums whitespace-nowrap">
                        {formatDisplayDate(row.delivery_date)}
                      </td>
                      <td>
                        <span className={bookingStatusBadgeClass(display)}>
                          {bookingStatusLabel(display)}
                        </span>
                      </td>
                      <td className="font-semibold tabular-nums whitespace-nowrap">
                        {formatInrAmount(row.total_amount)}
                      </td>
                      <td className="text-right">
                        {upcoming ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => markDelivered(row.id)}
                              className="link-action"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark as delivered
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => cancelBooking(row.id)}
                              className="link-action-danger"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
