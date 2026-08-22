import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { partiesAPI, purchasesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import ExportMenu from '../components/ExportMenu';
import EmptyState from '../components/EmptyState';
import ListSearchInput, { matchesListSearch } from '../components/ListSearchInput';
import { PARTY_EXPORT_COLUMNS, mapPartyExportRow } from '../config/exportColumns';
import ErrorModal from '../components/ErrorModal';
import DeletePartyModal from '../components/DeletePartyModal';
import FormShell from '../components/forms/FormShell';
import { FormField, inputClassName } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SegmentedControl from '../components/forms/SegmentedControl';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync, removeById } from '../lib/dataSync';
import {
  validatePartyForm,
  digitsOnly,
  sanitizeGstinInput,
  sanitizeDecimalInput,
} from '../utils/formValidation';

const PARTY_TYPE_OPTIONS = [
  { value: 'retailer', label: 'Retailer' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'manufacturer', label: 'Manufacturer' },
];

function partyTypeBadgeClass(type) {
  if (type === 'retailer') return 'badge-green';
  if (type === 'wholesaler') return 'badge-blue';
  if (type === 'manufacturer') return 'badge-orange';
  return 'badge-blue';
}

function partyTypeLabel(type) {
  return PARTY_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export default function Parties() {
  const [searchParams] = useSearchParams();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(() => {
    const status = searchParams.get('status');
    return status === 'active' || status === 'inactive' ? status : 'all';
  });
  const [listSearch, setListSearch] = useState('');
  const [partyPurchases, setPartyPurchases] = useState([]);
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    partyId: null,
    partyName: '',
    invoices: [],
    purchases: [],
    loading: false,
    confirming: false,
  });
  const [form, setForm] = useState({
    name: '',
    type: 'retailer',
    contact: '',
    address: '',
    gst_number: '',
    balance: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formWarnings, setFormWarnings] = useState({});

  function showErrorModal(message, title = 'Unable to delete') {
    setErrorModal({
      open: true,
      title,
      message: message || 'Something went wrong. Please try again.',
    });
  }

  function closeErrorModal() {
    setErrorModal({ open: false, title: '', message: '' });
  }

  function closeDeleteModal() {
    if (deleteModal.confirming) return;
    setDeleteModal({
      open: false,
      partyId: null,
      partyName: '',
      invoices: [],
      purchases: [],
      loading: false,
      confirming: false,
    });
  }

  useEffect(() => {
    loadParties();
  }, [filter, statusFilter]);

  useEffect(() => {
    const status = searchParams.get('status');
    const next = status === 'active' || status === 'inactive' ? status : 'all';
    setStatusFilter((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  useDataSync('parties', () => loadParties(true));

  /** Default ("All types") view hides Retailer parties to keep the directory
   * focused on Wholesalers/Manufacturers — retail customers created via
   * pre-bookings would otherwise flood this list. Select the "Retailer" tab
   * explicitly to view them; Sales invoice's customer picker is unaffected
   * since it loads parties independently. */
  const visibleParties = useMemo(() => {
    if (filter === 'all') {
      return parties.filter((party) => party.type !== 'retailer');
    }
    return parties;
  }, [parties, filter]);

  const displayedParties = useMemo(
    () => visibleParties.filter((party) => matchesListSearch(listSearch, party.name, party.contact)),
    [visibleParties, listSearch]
  );

  async function loadParties(silent = false) {
    try {
      if (!silent) setLoading(true);
      const opts = {};
      if (filter !== 'all') opts.type = filter;
      if (statusFilter === 'active') opts.status = 'active';
      else if (statusFilter === 'inactive') opts.status = 'inactive';
      const data = await partiesAPI.getAll(opts);
      setParties(data);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setPartyPurchases([]);
    setForm({ name: '', type: 'retailer', contact: '', address: '', gst_number: '', balance: '' });
    setFormErrors({});
    setFormWarnings({});
    setShowForm(true);
  }

  async function openEditForm(party) {
    setEditingId(party.id);
    setForm({
      name: party.name,
      type: party.type,
      contact: party.contact || '',
      address: party.address || '',
      gst_number: party.gst_number || '',
      balance: party.balance,
    });
    setFormErrors({});
    setFormWarnings({});
    setShowForm(true);
    try {
      const purchases = await purchasesAPI.getAll({ partyId: party.id });
      setPartyPurchases(purchases.slice(0, 5));
    } catch {
      setPartyPurchases([]);
    }
  }

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    if (keys.length) {
      setFormErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
      setFormWarnings((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  }

  function runPartyValidation() {
    const { errors, warnings } = validatePartyForm(form, { parties, editingId });
    setFormErrors(errors);
    setFormWarnings(warnings);
    return Object.keys(errors).length === 0;
  }

  // Live duplicate-GSTIN caution (same helper as submit — Add & Edit)
  const liveGstWarning = useMemo(() => {
    if (formErrors.gst_number) return null;
    const { errors, warnings } = validatePartyForm(form, { parties, editingId });
    if (errors.gst_number) return null;
    return warnings.gst_number || null;
  }, [form, parties, editingId, formErrors.gst_number]);

  async function handleSubmit(e) {
    e.preventDefault();
    // Same path for Add and Edit — shared validatePartyForm
    if (!runPartyValidation()) return;

    try {
      const data = {
        name: form.name.trim(),
        type: form.type,
        contact: String(form.contact || '').trim(),
        address: form.address,
        gst_number: String(form.gst_number || '')
          .trim()
          .toUpperCase(),
        balance: parseFloat(form.balance) || 0,
      };

      if (editingId) {
        await partiesAPI.update(editingId, data);
      } else {
        await partiesAPI.create(data);
      }

      setShowForm(false);
      setFormErrors({});
      setFormWarnings({});
      notifyDataSync('parties');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this party? It will be hidden from new invoices but past records stay intact.')) return;
    try {
      await partiesAPI.deactivate(id);
      if (statusFilter === 'active') {
        setParties((prev) => removeById(prev, id));
      } else {
        setParties((prev) =>
          prev.map((party) => (party.id === id ? { ...party, is_active: false } : party))
        );
      }
      notifyDataSync('parties');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReactivate(id) {
    try {
      await partiesAPI.reactivate(id);
      if (statusFilter === 'inactive') {
        setParties((prev) => removeById(prev, id));
      } else {
        setParties((prev) =>
          prev.map((party) => (party.id === id ? { ...party, is_active: true } : party))
        );
      }
      notifyDataSync('parties');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(party) {
    const id = party.id;

    try {
      const linked = await partiesAPI.getLinkedRecords(id);
      const invoices = linked.invoices || [];
      const purchases = linked.purchases || [];
      const totalCount = linked.totalCount ?? invoices.length + purchases.length;

      // No linked records → normal delete (no cascade modal).
      if (totalCount === 0) {
        if (!confirm(`Permanently delete party "${party.name}"?`)) return;
        const result = await partiesAPI.delete(id);
        setParties((prev) => removeById(prev, id));
        notifyDataSync('parties');
        showErrorModal(result.message || 'Party deleted successfully.', 'Party deleted');
        return;
      }

      setDeleteModal({
        open: true,
        partyId: id,
        partyName: linked.party?.name || party.name,
        invoices,
        purchases,
        loading: false,
        confirming: false,
      });
    } catch (err) {
      showErrorModal(err.message, 'Cannot delete party');
    }
  }

  async function confirmCascadeDelete() {
    const id = deleteModal.partyId;
    if (!id) return;

    try {
      setDeleteModal((prev) => ({ ...prev, confirming: true }));
      const result = await partiesAPI.deleteCascade(id);
      setParties((prev) => removeById(prev, id));
      notifyDataSync('parties');
      notifyDataSync('sales');
      notifyDataSync('products');
      setDeleteModal({
        open: false,
        partyId: null,
        partyName: '',
        invoices: [],
        purchases: [],
        loading: false,
        confirming: false,
      });
      showErrorModal(
        result.message ||
          `Party deleted. Removed ${result.sales_deleted ?? 0} invoice(s) and ${result.purchases_deleted ?? 0} purchase(s).`,
        'Party deleted'
      );
    } catch (err) {
      setDeleteModal((prev) => ({ ...prev, confirming: false }));
      showErrorModal(err.message, 'Cannot delete party');
    }
  }

  if (loading && parties.length === 0) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Parties"
        description="Retailers, wholesalers, manufacturers, and customer accounts."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <ExportMenu
              filePrefix="parties"
              successLabel="Parties"
              columns={PARTY_EXPORT_COLUMNS}
              getRows={() => displayedParties.map(mapPartyExportRow)}
            />
            <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add party
            </button>
          </div>
        }
      />

      <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Wholesale & Mfr.' },
            ...PARTY_TYPE_OPTIONS,
          ]}
        />
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Users}
            title={editingId ? 'Edit party' : 'New party'}
            subtitle="Manage retailer, wholesaler, or manufacturer contact, GST, and opening balance."
          >
            <form onSubmit={handleSubmit} className="form-grid" noValidate>
              <FormField label="Party name" required error={formErrors.name} className="md:col-span-2">
                <input
                  className={inputClassName(formErrors.name)}
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="Business or person name"
                />
              </FormField>
              <FormField label="Type" required error={formErrors.type}>
                <select
                  className={inputClassName(formErrors.type)}
                  value={form.type}
                  onChange={(e) => updateForm({ type: e.target.value })}
                >
                  {PARTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Contact" required error={formErrors.contact} hint="10-digit mobile number">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  className={inputClassName(formErrors.contact)}
                  value={form.contact}
                  onChange={(e) => updateForm({ contact: digitsOnly(e.target.value, 10) })}
                  placeholder="9876543210"
                  maxLength={10}
                />
              </FormField>
              <FormField
                label="GST number"
                error={formErrors.gst_number}
                warning={formWarnings.gst_number || liveGstWarning}
                hint="Optional · 15-character GSTIN if provided"
              >
                <input
                  type="text"
                  className={inputClassName(formErrors.gst_number)}
                  value={form.gst_number}
                  onChange={(e) => updateForm({ gst_number: sanitizeGstinInput(e.target.value) })}
                  placeholder="27AAAAA0000A1Z5"
                  maxLength={15}
                />
              </FormField>
              <FormField label="Opening balance (₹)">
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClassName()}
                  value={form.balance}
                  onChange={(e) => updateForm({ balance: sanitizeDecimalInput(e.target.value) })}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Positive = party owes you. Sales increase balance; purchases from this party decrease it.
                </p>
              </FormField>
              {editingId && partyPurchases.length > 0 && (
                <div className="surface-inset md:col-span-2 lg:col-span-3 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] dark:text-slate-400 mb-3">
                    Recent purchases from this party
                  </p>
                  <ul className="space-y-2 text-sm">
                    {partyPurchases.map((purchase) => (
                      <li key={purchase.id} className="flex justify-between gap-3">
                        <span className="text-slate-700">{purchase.purchase_date}</span>
                        <span className="font-semibold tabular-nums text-indigo-700">
                          ₹{Number(purchase.total_amount).toLocaleString('en-IN')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <FormField label="Address" className="md:col-span-2 lg:col-span-3">
                <textarea
                  className={inputClassName(false, 'min-h-[96px] resize-y')}
                  rows={2}
                  value={form.address}
                  onChange={(e) => updateForm({ address: e.target.value })}
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update party' : 'Save party'}
                  onCancel={() => {
                    setShowForm(false);
                    setFormErrors({});
                    setFormWarnings({});
                  }}
                />
              </div>
            </form>
          </FormShell>
        </div>
      )}

      <div className="table-wrap">
        <div className="table-wrap-header flex-wrap">
          <div className="min-w-0">
            <h3 className="card-section-title mb-0">Party directory</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {displayedParties.length} part{displayedParties.length === 1 ? 'y' : 'ies'}
              {listSearch.trim() ? ' matching search' : ''}
            </p>
          </div>
          <ListSearchInput
            value={listSearch}
            onChange={setListSearch}
            placeholder="Search parties..."
            aria-label="Search parties by name or contact number"
          />
        </div>
        {displayedParties.length === 0 ? (
          <EmptyState
            icon={Users}
            title={listSearch.trim() ? 'No matching parties' : 'No parties found'}
            description={
              listSearch.trim()
                ? 'Try another party name or contact number.'
                : 'Add a retailer, wholesaler, or manufacturer to start invoicing and purchases.'
            }
            actionLabel={listSearch.trim() ? undefined : 'Add party'}
            onAction={listSearch.trim() ? undefined : openAddForm}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>GST No.</th>
                  <th className="col-num">Balance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedParties.map((party) => {
                  const isActive = party.is_active !== false;
                  return (
                    <tr key={party.id} className={!isActive ? 'opacity-80' : undefined}>
                      <td>
                        <p className="list-primary">{party.name}</p>
                        {party.address && (
                          <p className="list-secondary truncate max-w-[220px]" title={party.address}>
                            {party.address}
                          </p>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${partyTypeBadgeClass(party.type)}`}>
                          {partyTypeLabel(party.type)}
                        </span>
                      </td>
                      <td>
                        {isActive ? (
                          <span className="badge badge-green">Active</span>
                        ) : (
                          <span className="badge badge-red">Inactive</span>
                        )}
                      </td>
                      <td>{party.contact || '—'}</td>
                      <td className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {party.gst_number || '—'}
                      </td>
                      <td className="col-num font-semibold">
                        ₹{Number(party.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        <div className="list-actions">
                          <button type="button" onClick={() => openEditForm(party)} className="link-action">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(party.id)}
                              className="link-action-muted"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivate(party.id)}
                              className="link-action-muted"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(party)}
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

      <DeletePartyModal
        open={deleteModal.open}
        partyName={deleteModal.partyName}
        invoices={deleteModal.invoices}
        purchases={deleteModal.purchases}
        loading={deleteModal.loading}
        confirming={deleteModal.confirming}
        onClose={closeDeleteModal}
        onConfirmCascade={confirmCascadeDelete}
      />

      <ErrorModal
        open={errorModal.open}
        title={errorModal.title}
        message={errorModal.message}
        onClose={closeErrorModal}
      />
    </div>
  );
}