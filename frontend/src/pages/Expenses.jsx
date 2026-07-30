import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Banknote, CalendarRange } from 'lucide-react';
import { expensesAPI } from '../api';
import LoadingState from '../components/LoadingState';
import PageHeader from '../components/PageHeader';
import FormShell from '../components/forms/FormShell';
import { FormField } from '../components/forms/FormField';
import FormActions from '../components/forms/FormActions';

const CATEGORIES = [
  'Rent',
  'Salary',
  'Electricity',
  'Transport',
  'Maintenance',
  'Marketing',
  'Other',
];

const PAYMENT_METHODS = ['Cash', 'Bank', 'UPI'];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function yearStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
}

const emptyForm = () => ({
  title: '',
  category: 'Other',
  amount: '',
  expense_date: todayISO(),
  payment_method: 'Cash',
  notes: '',
});

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      setLoading(true);
      const data = await expensesAPI.getAll();
      setExpenses(data);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const { monthTotal, yearTotal } = useMemo(() => {
    const monthStart = monthStartISO();
    const yearStart = yearStartISO();
    let month = 0;
    let year = 0;
    for (const row of expenses) {
      const amt = Number(row.amount) || 0;
      if (row.expense_date >= yearStart) year += amt;
      if (row.expense_date >= monthStart) month += amt;
    }
    return { monthTotal: month, yearTotal: year };
  }, [expenses]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEditForm(expense) {
    setEditingId(expense.id);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      notes: expense.notes || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        notes: form.notes.trim(),
      };

      if (editingId) {
        await expensesAPI.update(editingId, payload);
      } else {
        await expensesAPI.create(payload);
      }

      setShowForm(false);
      loadExpenses();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      loadExpenses();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  if (loading && expenses.length === 0) return <LoadingState />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        description="Track rent, salaries, utilities, and other operating costs."
        action={
          <button onClick={openAddForm} className="btn btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="premium-glass-card p-5 sm:p-6 border border-indigo-200/40 bg-gradient-to-br from-indigo-50/60 via-white to-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total expenses this month
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
                ₹{monthTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-700 to-indigo-950 text-amber-200 shadow-md">
              <CalendarRange className="h-5 w-5" />
            </div>
          </div>
        </div>
        <div className="premium-glass-card p-5 sm:p-6 border border-violet-200/40 bg-gradient-to-br from-violet-50/50 via-white to-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total expenses this year
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
                ₹{yearTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-900 text-white shadow-md">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="form-panel">
          <FormShell
            icon={Banknote}
            title={editingId ? 'Edit expense' : 'New expense'}
            subtitle="Record operating costs with category, amount, and payment method."
          >
            <form onSubmit={handleSubmit} className="form-grid">
              <FormField label="Expense title" required className="md:col-span-2">
                <input
                  className="input input-premium"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Shop rent — March"
                  required
                />
              </FormField>
              <FormField label="Category" required>
                <select
                  className="input input-premium"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Amount (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-premium"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Date" required>
                <input
                  type="date"
                  className="input input-premium"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Payment method" required>
                <select
                  className="input input-premium"
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Notes (optional)" className="md:col-span-2 lg:col-span-3">
                <textarea
                  className="input input-premium min-h-[88px] resize-y"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Reference, invoice no., remarks…"
                />
              </FormField>
              <div className="md:col-span-2 lg:col-span-3">
                <FormActions
                  submitLabel={editingId ? 'Update expense' : 'Save expense'}
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
                <th>Date</th>
                <th>Category</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Payment</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    No expenses yet. Add rent, salary, or other costs to track spending.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="tabular-nums text-slate-700 whitespace-nowrap">
                      {new Date(expense.expense_date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <span className="badge badge-blue">{expense.category}</span>
                    </td>
                    <td className="font-medium text-slate-900 max-w-[200px] sm:max-w-none truncate">
                      {expense.title}
                    </td>
                    <td className="font-semibold tabular-nums text-rose-700">
                      ₹{Number(expense.amount).toLocaleString('en-IN')}
                    </td>
                    <td>{expense.payment_method}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => openEditForm(expense)} className="link-action">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(expense.id)} className="link-action-danger">
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
