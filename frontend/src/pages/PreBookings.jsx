import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Pencil, FileText, Ban, Trash2, ChevronDown, IndianRupee } from 'lucide-react';
import { preBookingsAPI, partiesAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import PreBookingForm from '../components/forms/PreBookingForm';
import { emptyProductLine } from '../components/forms/ProductLineItemsEditor';
import SegmentedControl from '../components/forms/SegmentedControl';
import { formatDisplayDate } from '../utils/invoicePayment';
import { formatInrAmount } from '../utils/invoiceLineItems';
import { refreshPartiesAfterCreate } from '../utils/partyList';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync } from '../lib/dataSync';
import {
  todayISO,
  dateOnly,
  DEFAULT_GST_RATE,
  bookingDisplayStatus,
  bookingStatusLabel,
  bookingStatusBadgeClass,
} from '../utils/preBookings';

const emptyForm = () => ({
  party_id: '',
  delivery_date: todayISO(),
  notes: '',
  items: [emptyProductLine()],
});

export default function PreBookings() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('upcoming');
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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
    setFormError('');
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function bookingToForm(row) {
    const items = (row?.items || [])
      .filter((item) => item?.product_id)
      .map((item) => ({
        product_id: String(item.product_id),
        quantity: String(item.quantity ?? '1'),
        rate: String(item.rate ?? ''),
        gst_percent: String(
          item.gst_percent === 0 || item.gst_percent ? item.gst_percent : DEFAULT_GST_RATE
        ),
      }));
    return {
      party_id: row?.party_id ? String(row.party_id) : '',
      delivery_date: dateOnly(row?.delivery_date) || todayISO(),
      notes: row?.notes || '',
      items: items.length > 0 ? items : [emptyProductLine()],
    };
  }

  function openEditForm(row) {
    if ((row?.status || 'upcoming') !== 'upcoming') return;
    setFormError('');
    setEditingId(row.id);
    setForm(bookingToForm(row));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
    setForm(emptyForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.party_id) {
      setFormError('Party is required');
      return;
    }
    const items = (form.items || [])
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        gst_percent: item.gst_percent === '' ? 18 : Number(item.gst_percent),
      }));
    if (items.length === 0) {
      setFormError('Add at least one product');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setFormError('Each product needs a quantity greater than 0');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.rate) || item.rate < 0)) {
      setFormError('Each product needs a rate');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.gst_percent) || item.gst_percent < 0)) {
      setFormError('GST % cannot be negative');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        party_id: form.party_id,
        delivery_date: form.delivery_date,
        notes: form.notes.trim(),
        items,
      };
      if (editingId) {
        await preBookingsAPI.update(editingId, payload);
      } else {
        await preBookingsAPI.create(payload);
      }
      closeForm();
      notifyDataSync('pre_bookings');
      notifyDataSync('pre_booking_items');
      await loadBookings(true);
    } catch (err) {
      setFormError(err.message || (editingId ? 'Could not update this pre-booking.' : 'Could not save this pre-booking.'));
    } finally {
      setSaving(false);
    }
  }

  function createInvoice(row) {
    if ((row?.status || 'upcoming') !== 'upcoming') return;
    navigate(`/sales?fromPreBooking=${row.id}`);
  }

  async function deleteBooking(id) {
    if (
      !confirm(
        "Delete this pre-booking record? This won't affect the invoice already created."
      )
    ) {
      return;
    }
    try {
      setBusyId(id);
      await preBookingsAPI.delete(id);
      notifyDataSync('pre_bookings');
      notifyDataSync('pre_booking_items');
      await loadBookings(true);
    } catch (err) {
      alert(err.message || 'Could not delete this pre-booking.');
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
      alert(err.message || 'Could not cancel this pre-booking.');
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
        acc.gst += Number(row.gst_total) || 0;
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
        <PreBookingForm
          mode={editingId ? 'edit' : 'create'}
          form={form}
          onChange={setForm}
          parties={parties}
          products={products}
          onPartyCreated={handlePartyCreated}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          error={formError}
          saving={saving}
        />
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
                <th>Party</th>
                <th>Delivery date</th>
                <th>Items</th>
                <th className="col-num">Total amount</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
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
                      <td className="font-medium text-slate-900 max-w-[180px] truncate">
                        {row.party_name || '—'}
                      </td>
                      <td className="tabular-nums whitespace-nowrap">
                        {formatDisplayDate(row.delivery_date)}
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
                      <td className="col-num font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatInrAmount(row.total_amount)}
                      </td>
                      <td>
                        <span className={bookingStatusBadgeClass(display)}>
                          {bookingStatusLabel(display)}
                        </span>
                      </td>
                      <td className="text-right">
                        {upcoming ? (
                          <div className="list-actions justify-end">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => openEditForm(row)}
                              className="link-action"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => createInvoice(row)}
                              className="link-action"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Create Invoice
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
                          <div className="list-actions justify-end">
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => deleteBooking(row.id)}
                              className="link-action-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                  if (!open) return [main];
                  return [
                    main,
                    <tr key={`${row.id}-items`}>
                      <td colSpan="6" className="bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                        {items.length === 0 ? (
                          <p className="text-sm text-slate-500">No line items on this booking.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="py-1 pr-3">Product</th>
                                <th className="py-1 pr-3 text-right">Qty</th>
                                <th className="py-1 pr-3 text-right">Rate</th>
                                <th className="py-1 pr-3 text-right">GST %</th>
                                <th className="py-1 text-right">Amount</th>
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
                                    {Number(item.gst_percent || 0).toLocaleString('en-IN')}%
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
