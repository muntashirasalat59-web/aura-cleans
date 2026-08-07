import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Briefcase, Users, Wallet, CheckCircle2 } from 'lucide-react';
import { employeesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';
import SummaryStatCard from '../components/ui/SummaryStatCard';
import { useDataSync } from '../hooks/useDataSync';
import { notifyDataSync, removeById } from '../lib/dataSync';

const ROLES = ['Salesman', 'Manager', 'Accountant', 'Delivery Boy'];
const STATUSES = ['Active', 'Inactive'];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

const emptyForm = () => ({
  name: '',
  role: 'Salesman',
  contact: '',
  salary: '',
  joining_date: todayISO(),
  status: 'Active',
});

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    loadEmployees();
  }, []);

  useDataSync('employees', () => loadEmployees(true));

  async function loadEmployees(silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await employeesAPI.getAll();
      setEmployees(data);
    } catch (err) {
      if (!silent) alert('Error: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'Active').length;
    const monthlySalary = employees
      .filter((e) => e.status === 'Active')
      .reduce((acc, e) => acc + Number(e.salary || 0), 0);
    return { total, active, monthlySalary };
  }, [employees]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(employee) {
    setEditingId(employee.id);
    setForm({
      name: employee.name,
      role: employee.role,
      contact: employee.contact || '',
      salary: employee.salary,
      joining_date: employee.joining_date,
      status: employee.status,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        contact: form.contact.trim(),
        salary: parseFloat(form.salary) || 0,
        joining_date: form.joining_date,
        status: form.status,
      };

      if (editingId) {
        await employeesAPI.update(editingId, payload);
      } else {
        await employeesAPI.create(payload);
      }

      setShowForm(false);
      notifyDataSync('employees');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this employee? Payroll history will be preserved.')) return;
    try {
      await employeesAPI.deactivate(id);
      setEmployees((prev) =>
        prev.map((employee) => (employee.id === id ? { ...employee, status: 'Inactive' } : employee))
      );
      notifyDataSync('employees');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleReactivate(id) {
    try {
      await employeesAPI.reactivate(id);
      setEmployees((prev) =>
        prev.map((employee) => (employee.id === id ? { ...employee, status: 'Active' } : employee))
      );
      notifyDataSync('employees');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this employee? Only allowed if no salary payment history exists.')) return;
    try {
      await employeesAPI.delete(id);
      setEmployees((prev) => removeById(prev, id));
      notifyDataSync('employees');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleMarkSalaryPaid(employee) {
    if (employee.status !== 'Active') return;
    if (!confirm(`Mark salary paid for ${employee.name} (₹${Number(employee.salary).toLocaleString('en-IN')}) for this month?`)) {
      return;
    }
    try {
      setPayingId(employee.id);
      await employeesAPI.markSalaryPaid(employee.id);
      notifyDataSync('employees');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setPayingId(null);
    }
  }

  if (loading && employees.length === 0) return <LoadingState />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Employees"
        description="Team roster, monthly salary, and simple salary payment tracking."
        action={
          <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add employee
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryStatCard title="Total employees" value={summary.total} icon={Briefcase} tone="indigo" />
        <SummaryStatCard title="Active employees" value={summary.active} icon={Users} tone="emerald" />
        <SummaryStatCard
          title="Total monthly salary expense"
          value={`₹${summary.monthlySalary.toLocaleString('en-IN')}`}
          subtitle="Active staff only"
          icon={Wallet}
          tone="violet"
        />
      </div>

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Briefcase}
            title={editingId ? 'Edit employee' : 'New employee'}
            subtitle="Name, role, contact, salary, and employment status."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Employee name" required className="md:col-span-2">
                <input
                  className="input input-premium"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Role / designation" required>
                <select
                  className="input input-premium"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Contact number">
                <input
                  className="input input-premium"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="Mobile number"
                />
              </FormField>
              <FormField label="Monthly salary (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-premium"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Joining date" required>
                <input
                  type="date"
                  className="input input-premium"
                  value={form.joining_date}
                  onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Status" required>
                <select
                  className="input input-premium"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update employee' : 'Save employee'}
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
                <th>Role</th>
                <th>Contact</th>
                <th>Salary</th>
                <th>Joining date</th>
                <th>Status</th>
                <th>Salary (this month)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No employees yet. Add your team to track roles and monthly salary.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-medium text-slate-900">{employee.name}</td>
                    <td>
                      <span className="badge badge-blue">{employee.role}</span>
                    </td>
                    <td>{employee.contact || '—'}</td>
                    <td className="font-semibold tabular-nums">
                      ₹{Number(employee.salary).toLocaleString('en-IN')}
                    </td>
                    <td className="tabular-nums whitespace-nowrap">
                      {new Date(employee.joining_date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      {employee.status === 'Active' ? (
                        <span className="badge badge-green">Active</span>
                      ) : (
                        <span className="badge badge-red">Inactive</span>
                      )}
                    </td>
                    <td>
                      {employee.salary_paid_this_month ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Paid
                          {employee.salary_payment?.month && (
                            <span className="text-slate-500 font-normal">
                              ({formatMonthLabel(employee.salary_payment.month)})
                            </span>
                          )}
                        </span>
                      ) : employee.status === 'Active' ? (
                        <button
                          type="button"
                          className="btn btn-secondary text-xs py-1.5 px-3"
                          disabled={payingId === employee.id}
                          onClick={() => handleMarkSalaryPaid(employee)}
                        >
                          {payingId === employee.id ? 'Saving…' : 'Mark salary paid'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3 flex-wrap">
                        <button type="button" onClick={() => openEditForm(employee)} className="link-action">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        {employee.status === 'Active' ? (
                          <button type="button" onClick={() => handleDeactivate(employee.id)} className="link-action">
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleReactivate(employee.id)} className="link-action">
                            Reactivate
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(employee.id)} className="link-action-danger">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
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
