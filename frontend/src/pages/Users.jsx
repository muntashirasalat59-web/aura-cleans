import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, UserCog } from 'lucide-react';
import { usersAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import { roleLabel } from '../config/permissions';
import { useAuth } from '../context/AuthContext';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync, removeById } from '../lib/dataSync';

export default function Users() {
  const { profile } = useAuth();
  const isPlatformAdmin = Boolean(profile?.is_platform_admin);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useDataSync('user_profiles', () => loadUsers(true));

  async function loadUsers(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await usersAPI.getAll();
      setUsers(data);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await usersAPI.create({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setShowForm(false);
      setForm({ full_name: '', email: '', password: '', role: 'staff' });
      notifyDataSync('user_profiles');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDelete(user) {
    const msg = isPlatformAdmin
      ? `Delete business "${user.full_name}" (${user.email})?\n\nThis will permanently delete the business and its owner account. All associated data (sales, purchases, products, etc.) will also be deleted.`
      : `Remove user ${user.full_name} (${user.email})?`;
    if (!confirm(msg)) return;
    try {
      await usersAPI.delete(user.id);
      setUsers((prev) => removeById(prev, user.id));
      notifyDataSync('user_profiles');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleMarkPaid(user) {
    try {
      await usersAPI.markBusinessPaid(user.id);
      loadUsers(true);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (loading && users.length === 0) return <LoadingState />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="Create staff logins and assign Admin or Staff roles."
        action={
          <button onClick={() => setShowForm(true)} className="btn btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add user
          </button>
        }
      />

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={UserCog}
            title="New user"
            subtitle="Creates Supabase Auth login + profile with role."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Full name" required className="md:col-span-2">
                <input
                  className="input input-premium"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Email" required className="md:col-span-2">
                <input
                  type="email"
                  className="input input-premium"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Password" required>
                <input
                  type="password"
                  minLength={6}
                  className="input input-premium"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Role" required>
                <select
                  className="input input-premium"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions submitLabel="Create user" onCancel={() => setShowForm(false)} />
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
                <th>Email</th>
                <th>Role</th>
                {isPlatformAdmin && <th>Subscription</th>}
                <th>Added</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-500">
                    No team users yet. Add staff or another admin.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium text-slate-900">{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`badge ${user.role === 'admin' ? 'badge-blue' : 'badge-green'} inline-flex items-center gap-1`}
                      >
                        <Shield className="h-3 w-3" />
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    {isPlatformAdmin && (
                      <td>
                        {user.payment_status === 'paid' ? (
                          <span className="badge badge-green">Paid</span>
                        ) : (
                          <span className="badge badge-red">Unpaid ₹{user.subscription_amount ?? 999}</span>
                        )}
                      </td>
                    )}
                    <td className="text-sm text-slate-500 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="text-right">
                      {isPlatformAdmin && user.payment_status !== 'paid' && (
                        <button type="button" onClick={() => handleMarkPaid(user)} className="link-action-primary mr-3">
                          Mark Paid
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(user)} className="link-action-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
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