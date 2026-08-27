import { useState, useEffect, useMemo } from 'react';
import { Plus, X, Pencil, Trash2, Tag } from 'lucide-react';
import { offersAPI, productsAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import OfferForm from '../components/forms/OfferForm';
import { emptyComboLine, todayISODate } from '../utils/offers';
import SegmentedControl from '../components/forms/SegmentedControl';
import { formatDisplayDate } from '../utils/invoicePayment';
import { formatInrAmount } from '../utils/invoiceLineItems';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync } from '../lib/dataSync';
import { bookingStatusLabel, bookingStatusBadgeClass } from '../utils/preBookings';

const emptyForm = () => ({
  offer_name: '',
  combo_price: '',
  valid_from: todayISODate(),
  valid_to: '',
  items: [emptyComboLine()],
});

export default function Offers() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadProducts(true);
    loadOffers();
  }, []);

  useDataSync('offers', () => loadOffers(true));
  useDataSync('offer_items', () => loadOffers(true));
  useDataSync('pre_bookings', () => loadOffers(true));
  useDataSync('products', () => loadProducts(true));

  async function loadProducts(silent = false) {
    try {
      const data = await productsAPI.getAll({ activeOnly: true });
      setProducts(data || []);
    } catch (err) {
      if (!silent) alert('Error loading products: ' + err.message);
    }
  }

  async function loadOffers(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await offersAPI.getAll();
      setRows(data || []);
    } catch (err) {
      if (!silent) alert('Error loading offers: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function openCreateForm() {
    setFormError('');
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function offerToForm(row) {
    const items = (row?.items || [])
      .filter((item) => item?.product_id)
      .map((item) => ({
        product_id: String(item.product_id),
        quantity: String(item.quantity ?? '1'),
      }));
    return {
      offer_name: row?.offer_name || '',
      combo_price: row?.combo_price != null ? String(row.combo_price) : '',
      valid_from: row?.valid_from || '',
      valid_to: row?.valid_to || '',
      items: items.length > 0 ? items : [emptyComboLine()],
    };
  }

  function openEditForm(row) {
    setFormError('');
    setEditingId(row.id);
    setForm(offerToForm(row));
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
    if (!form.offer_name.trim()) {
      setFormError('Offer name is required');
      return;
    }
    const combo = Number(form.combo_price);
    if (!Number.isFinite(combo) || combo < 0) {
      setFormError('Combo price cannot be negative');
      return;
    }
    const items = (form.items || [])
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
      }));
    if (items.length === 0) {
      setFormError('Add at least one product to the combo');
      return;
    }
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setFormError('Each product needs a quantity greater than 0');
      return;
    }
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to) {
      setFormError('Valid from cannot be after valid to');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        offer_name: form.offer_name.trim(),
        combo_price: combo,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        items,
      };
      if (editingId) {
        await offersAPI.update(editingId, payload);
      } else {
        await offersAPI.create(payload);
      }
      closeForm();
      notifyDataSync('offers');
      notifyDataSync('offer_items');
      await loadOffers(true);
    } catch (err) {
      setFormError(err.message || (editingId ? 'Could not update this offer.' : 'Could not save this offer.'));
    } finally {
      setSaving(false);
    }
  }

  async function deactivateOffer(id) {
    try {
      setBusyId(id);
      await offersAPI.deactivate(id);
      notifyDataSync('offers');
      await loadOffers(true);
    } catch (err) {
      alert(err.message || 'Could not deactivate this offer.');
    } finally {
      setBusyId(null);
    }
  }

  async function reactivateOffer(id) {
    try {
      setBusyId(id);
      await offersAPI.reactivate(id);
      notifyDataSync('offers');
      await loadOffers(true);
    } catch (err) {
      alert(err.message || 'Could not reactivate this offer.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOffer(id) {
    if (
      !confirm(
        'Delete this offer? Existing pre-bookings stay, but they will no longer show this offer name.'
      )
    ) {
      return;
    }
    try {
      setBusyId(id);
      await offersAPI.delete(id);
      notifyDataSync('offers');
      notifyDataSync('offer_items');
      await loadOffers(true);
    } catch (err) {
      alert(err.message || 'Could not delete this offer.');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    return (rows || []).filter((row) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return row.is_active !== false;
      return row.is_active === false;
    });
  }, [rows, statusFilter]);

  function formatValidity(row) {
    const from = row.valid_from ? formatDisplayDate(row.valid_from) : '—';
    const to = row.valid_to ? formatDisplayDate(row.valid_to) : '—';
    if (!row.valid_from && !row.valid_to) return 'Always';
    return `${from} → ${to}`;
  }

  if (loading && rows.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers & Promotions"
        description="Fixed combo packages. Selecting an offer on a pre-booking auto-fills its products."
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
                New offer
              </>
            )}
          </button>
        }
      />

      {showForm && (
        <OfferForm
          mode={editingId ? 'edit' : 'create'}
          form={form}
          onChange={setForm}
          products={products}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          error={formError}
          saving={saving}
        />
      )}

      <SegmentedControl
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
      />

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Offer name</th>
                <th className="col-num">Items</th>
                <th className="col-num">Combo price</th>
                <th>Valid dates</th>
                <th>Status</th>
                <th className="col-num">Bookings</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    {rows.length === 0
                      ? 'No offers yet. Create a combo like ₹349 Combo with its fixed products.'
                      : 'No data in this filter.'}
                  </td>
                </tr>
              ) : (
                filtered.flatMap((row) => {
                  const open = expandedId === row.id;
                  const bookings = row.bookings || [];
                  const main = (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setExpandedId(open ? null : row.id)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {row.offer_name}
                          </span>
                        </div>
                      </td>
                      <td className="col-num tabular-nums">{row.item_count || 0}</td>
                      <td className="col-num font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatInrAmount(row.combo_price)}
                      </td>
                      <td className="whitespace-nowrap text-sm">{formatValidity(row)}</td>
                      <td>
                        {row.is_active !== false ? (
                          <span className="badge badge-green">Active</span>
                        ) : (
                          <span className="badge badge-red">Inactive</span>
                        )}
                      </td>
                      <td className="col-num tabular-nums font-medium">{row.bookings_count || 0}</td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
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
                          {row.is_active !== false ? (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => deactivateOffer(row.id)}
                              className="link-action-muted"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => reactivateOffer(row.id)}
                              className="link-action-muted"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => deleteOffer(row.id)}
                            className="link-action-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  if (!open) return [main];
                  return [
                    main,
                    <tr key={`${row.id}-bookings`}>
                      <td colSpan="7" className="bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                        {bookings.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No pre-bookings have used this offer yet.
                          </p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                                <th className="py-1 pr-3">Customer</th>
                                <th className="py-1 pr-3">Date</th>
                                <th className="py-1 pr-3">Status</th>
                                <th className="py-1 pr-3 text-right">Amount</th>
                                <th className="py-1">Invoice</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookings.map((booking) => (
                                <tr key={booking.id}>
                                  <td className="py-1 pr-3 font-medium text-slate-800 dark:text-slate-100">
                                    {booking.party_name}
                                  </td>
                                  <td className="py-1 pr-3 tabular-nums whitespace-nowrap">
                                    {formatDisplayDate(booking.delivery_date)}
                                  </td>
                                  <td className="py-1 pr-3">
                                    <span className={bookingStatusBadgeClass(booking.status)}>
                                      {bookingStatusLabel(booking.status)}
                                    </span>
                                  </td>
                                  <td className="py-1 pr-3 text-right tabular-nums font-semibold">
                                    {formatInrAmount(booking.total_amount)}
                                  </td>
                                  <td className="py-1 text-slate-600 dark:text-slate-300">
                                    {booking.converted_invoice_id
                                      ? `Invoice #${booking.converted_invoice_id}`
                                      : '—'}
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
