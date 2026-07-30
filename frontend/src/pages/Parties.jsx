import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { partiesAPI, purchasesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SegmentedControl from '../components/forms/SegmentedControl';

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
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partyPurchases, setPartyPurchases] = useState([]);
  const [form, setForm] = useState({
    name: '',
    type: 'retailer',
    contact: '',
    address: '',
    gst_number: '',
    balance: '',
  });

  useEffect(() => {
    loadParties();
  }, [filter, statusFilter]);

  async function loadParties() {
    try {
      setLoading(true);
      const opts = {};
      if (filter !== 'all') opts.type = filter;
      if (statusFilter === 'active') opts.status = 'active';
      else if (statusFilter === 'inactive') opts.status = 'inactive';
      const data = await partiesAPI.getAll(opts);
      setParties(data);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setPartyPurchases([]);
    setForm({ name: '', type: 'retailer', contact: '', address: '', gst_number: '', balance: '' });
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
    setShowForm(true);
    try {
      const purchases = await purchasesAPI.getAll({ partyId: party.id });
      setPartyPurchases(purchases.slice(0, 5));
    } catch {
      setPartyPurchases([]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const data = {
        name: form.name,
        type: form.type,
        contact: form.contact,
        address: form.address,
        gst_number: form.gst_number,
        balance: parseFloat(form.balance) || 0,
      };

      if (editingId) {
        await partiesAPI.update(editingId, data);
      } else {
        await partiesAPI.create(data);
      }

      setShowForm(false);
      loadParties();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this party? It will be hidden from new invoices but past records stay intact.')) return;
    try {
      await partiesAPI.deactivate(id);
      loadParties();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReactivate(id) {
    try {
      await partiesAPI.reactivate(id);
      loadParties();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this party? This only works if no invoices or purchases are linked.')) return;
    try {
      await partiesAPI.delete(id);
      loadParties();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading && parties.length === 0) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Parties"
        description="Retailers, wholesalers, manufacturers, and customer accounts."
        action={
          <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add party
          </button>
        }
      />

      <div className="mb-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All types' },
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
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Party name" required className="md:col-span-2">
                <input
                  className="input input-premium"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Type" required>
                <select
                  className="input input-premium"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {PARTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Contact">
                <input
                  className="input input-premium"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="Phone / email"
                />
              </FormField>
              <FormField label="GST number">
                <input
                  className="input input-premium"
                  value={form.gst_number}
                  onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                />
              </FormField>
              <FormField label="Opening balance (₹)">
                <input
                  type="number"
                  step="0.01"
                  className="input input-premium"
                  value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Positive = party owes you. Sales increase balance; purchases from this party decrease it.
                </p>
              </FormField>
              {editingId && partyPurchases.length > 0 && (
                <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
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
                  className="input input-premium min-h-[96px] resize-y"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update party' : 'Save party'}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </form>
          </FormShell>
        </div>
      )}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Contact</th>
                <th>GST No.</th>
                <th>Balance</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No parties found. Add a retailer, wholesaler, or manufacturer to begin.
                  </td>
                </tr>
              ) : (
                parties.map((party) => {
                  const isActive = party.is_active !== false;
                  return (
                  <tr key={party.id} className={!isActive ? 'opacity-75' : undefined}>
                    <td className="font-medium text-slate-900">{party.name}</td>
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
                    <td className="font-mono text-xs">{party.gst_number || '—'}</td>
                    <td className="font-medium">₹{party.balance.toLocaleString('en-IN')}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3 flex-wrap">
                        <button type="button" onClick={() => openEditForm(party)} className="link-action">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {isActive ? (
                          <button type="button" onClick={() => handleDeactivate(party.id)} className="link-action">
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleReactivate(party.id)} className="link-action">
                            Reactivate
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(party.id)} className="link-action-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
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
