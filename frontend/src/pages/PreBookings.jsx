import { useState, useEffect, useMemo } from 'react';
import { Plus, X, CalendarClock, Check, Ban, ChevronDown, IndianRupee } from 'lucide-react';
import { preBookingsAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import PartySelectField from '../components/forms/PartySelectField';
import ProductLineItemsEditor, { emptyProductLine } from '../components/forms/ProductLineItemsEditor';
import SegmentedControl from '../components/forms/SegmentedControl';
import { formatDisplayDate } from '../utils/invoicePayment';
import { formatInrAmount } from '../utils/invoiceLineItems';
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

const DEFAULT_GST_RATE = 18;

const emptyForm = () => ({
  party_id: '',
  delivery_date: todayISO(),
  gst_percent: DEFAULT_GST_RATE,
  notes: '',
  items: [emptyProductLine()],
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
  const [expandedId, setExpandedId] = useState(null);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [savedGstPercent, setSavedGstPercent] = useState(DEFAULT_GST_RATE);

  useEffect(() => {
    loadLookups(true);
    loadBookings();
  }, []);

  useDataSync('pre_bookings', () => loadBookings(true));
  useDataSync('pre_booking_items', () => loadBookings(true));
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
    setGstEnabled(true);
    setSavedGstPercent(DEFAULT_GST_RATE);
    setForm(emptyForm());
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setGstEnabled(true);
    setForm(emptyForm());
  }

  function handleToggleGst() {
    if (gstEnabled) {
      setSavedGstPercent(Number(form.gst_percent) || DEFAULT_GST_RATE);
      setGstEnabled(false);
      setForm((prev) => ({ ...prev, gst_percent: 0 }));
    } else {
      setGstEnabled(true);
      setForm((prev) => ({ ...prev, gst_percent: savedGstPercent || DEFAULT_GST_RATE }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.party_id) {
      alert('Party is required');
      return;
    }
    const items = (form.items || [])
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      }));
    if (items.length === 0) {
      alert('Add at least one product');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      alert('Each product needs a quantity greater than 0');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.rate) || item.rate < 0)) {
      alert('Each product needs a rate');
      return;
    }
    try {
      await preBookingsAPI.create({
        party_id: form.party_id,
        delivery_date: form.delivery_date,
        gst_percent: gstEnabled ? parseFloat(form.gst_percent) || 0 : 0,
        notes: form.notes.trim(),
        items,
      });
      closeForm();
      notifyDataSync('pre_bookings');
      notifyDataSync('pre_booking_items');
      await loadBookings(true);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function markDelivered(id) {
    if (!confirm('Mark this whole pre-booking as delivered (all products)?')) return;
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

  const upcomingValue = useMemo(() => {
    const upcoming = (rows || []).filter((row) => (row.status || 'upcoming') === 'upcoming');
    return upcoming.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.subtotal += Number(row.subtotal) || 0;
        acc.gst += Number(row.gst_total ?? row.gst_amount) || 0;
        acc.total += Number(row.total_amount) || 0;
        return acc;
      },
      { count: 0, subtotal: 0, gst: 0, total: 0 }
    );
  }, [rows]);

  const filtered = useMemo(() => {
    return (rows || []).filter((row) => {
      if (statusFilter === 'all') return true;
      return (row.status || 'upcoming') === statusFilter;
    });
  }, [rows, statusFilter]);

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
            subtitle="One customer and delivery date, with as many products as they ordered."
          >
            <form onSubmit={handleSubmit}>
              <div className="form-grid mb-6">
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
                <FormField label="Delivery date" required>
                  <input
                    type="date"
                    className="input input-premium"
                    value={form.delivery_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_date: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="GST">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleToggleGst}
                      className={`btn shrink-0 ${gstEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {gstEnabled ? 'GST ON' : 'GST OFF'}
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input input-premium"
                      value={form.gst_percent}
                      disabled={!gstEnabled}
                      onChange={(e) => setForm((prev) => ({ ...prev, gst_percent: e.target.value }))}
                    />
                  </div>
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
              </div>

              <p className="form-section-label">Line items</p>
              <p className="text-xs text-slate-500 mb-3">
                Catalog price fills Rate — change it if you negotiated. Line amounts exclude GST.
              </p>
              <ProductLineItemsEditor
                items={form.items}
                products={products}
                gstPercent={gstEnabled ? form.gst_percent : 0}
                onChange={(items) => setForm((prev) => ({ ...prev, items }))}
                addLabel="Add another product"
              />

              <FormActions submitLabel="Save pre-booking" onCancel={closeForm} />
            </form>
          </FormShell>
        </div>
      )}

      <div className="group rounded-[var(--aura-radius-card)] border border-aura-border bg-aura-card p-6 shadow-soft">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--aura-type-caption)] font-semibold uppercase tracking-wider text-aura-muted">
              Total Pre-bookings Value
            </p>
            <p className="mt-2 truncate text-[length:var(--aura-type-h3)] font-bold tracking-tight tabular-nums text-aura-text">
              {formatInrAmount(upcomingValue.total)}
            </p>
            <p className="mt-2 text-[length:var(--aura-type-body)] text-aura-text-secondary">
              {upcomingValue.count} upcoming booking{upcomingValue.count === 1 ? '' : 's'} (delivered
              and cancelled excluded)
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subtotal</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatInrAmount(upcomingValue.subtotal)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">GST</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatInrAmount(upcomingValue.gst)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grand total</p>
                <p className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatInrAmount(upcomingValue.total)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--aura-radius-button)] bg-[color-mix(in_srgb,var(--aura-primary)_16%,transparent)] text-aura-primary shadow-soft">
            <IndianRupee className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
      </div>

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
                <th>Items</th>
                <th>Delivery date</th>
                <th>Status</th>
                <th className="col-num">Subtotal</th>
                <th className="col-num">GST</th>
                <th className="col-num">Total</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? 'No pre-bookings yet. Add one when a customer orders for a later date.'
                      : 'No data in this filter.'}
                  </td>
                </tr>
              ) : (
                filtered.flatMap((row) => {
                  const display = bookingDisplayStatus(row);
                  const upcoming = (row.status || 'upcoming') === 'upcoming';
                  const items = row.items || [];
                  const open = expandedId === row.id;
                  const main = (
                    <tr key={row.id}>
                      <td className="tabular-nums text-slate-700 whitespace-nowrap">
                        {formatDisplayDate(row.booking_date || row.created_at)}
                      </td>
                      <td className="font-medium text-slate-900 max-w-[180px] truncate">
                        {row.party_name || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          onClick={() => setExpandedId(open ? null : row.id)}
                          aria-expanded={open}
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                          />
                          {items.length || row.item_count || 0} item
                          {(items.length || row.item_count || 0) === 1 ? '' : 's'}
                        </button>
                      </td>
                      <td className="tabular-nums whitespace-nowrap">
                        {formatDisplayDate(row.delivery_date)}
                      </td>
                      <td>
                        <span className={bookingStatusBadgeClass(display)}>
                          {bookingStatusLabel(display)}
                        </span>
                      </td>
                      <td className="col-num">{formatInrAmount(row.subtotal)}</td>
                      <td className="col-num">{formatInrAmount(row.gst_total ?? row.gst_amount)}</td>
                      <td className="col-num font-semibold text-emerald-600 dark:text-emerald-400">
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
                  if (!open) return [main];
                  return [
                    main,
                    <tr key={`${row.id}-items`}>
                      <td colSpan="9" className="bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                        {items.length === 0 ? (
                          <p className="text-sm text-slate-500">No line items on this booking.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="py-1 pr-3">Product</th>
                                <th className="py-1 pr-3 text-right">Qty</th>
                                <th className="py-1 pr-3 text-right">Rate</th>
                                <th className="py-1 pr-3 text-right">GST</th>
                                <th className="py-1 text-right">Amount (excl. GST)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id || `${item.product_id}-${item.product_name}`}>
                                  <td className="py-1 pr-3 font-medium text-slate-800 dark:text-slate-100">
                                    {item.product_name}
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums">
                                    {Number(item.quantity).toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums">
                                    {formatInrAmount(item.rate)}
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums">
                                    {formatInrAmount(item.gst_amount)}
                                  </td>
                                  <td className="py-1 text-right font-semibold tabular-nums">
                                    {formatInrAmount(item.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>,
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
